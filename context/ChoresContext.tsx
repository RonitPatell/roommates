import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from '@/context/AuthContext';
import { useGroup } from '@/context/GroupContext';
import { usePoints } from '@/context/PointsContext';
import {
  buildChoreReassignUpdate,
  canMarkChoreComplete,
  choreAppliesToUser,
  choreCompleteLockedMessage,
  formatChoreDbError,
  isProjectedChoreId,
  mergeChoresWithProjections,
  nextDueDate,
  normalizeChore,
  normalizeTradeOffer,
  resolvePrimaryAssignee,
} from '@/lib/chores';
import {
  choreLedgerSeriesId,
  isOnTimeCompletion,
  processMissedChorePoints,
  recordOnTimePoint,
} from '@/lib/points';
import {
  backfillSeriesRotations,
  ensureSeriesRotation,
  fetchSeriesRotations,
  processRotationCarryOvers,
  rotationLagForSeries,
} from '@/lib/rotation';
import { getSupabase } from '@/lib/supabase';
import type {
  Chore,
  ChoreSeriesRotation,
  RecurrenceType,
  RotationMode,
  RotationPeriod,
  TradeOffer,
} from '@/types';

interface AddChoreInput {
  title: string;
  notes?: string;
  assigneeIds: string[];
  dueDate: string;
  recurrenceType: RecurrenceType;
  rotationMode: RotationMode;
  rotationPeriod: RotationPeriod | null;
}

interface ChoresContextValue {
  /** First load for the active group. */
  initialLoading: boolean;
  /** Pull-to-refresh only — not set during add/toggle/delete. */
  refreshing: boolean;
  /** @deprecated Use initialLoading or refreshing */
  loading: boolean;
  chores: Chore[];
  trades: TradeOffer[];
  myChores: Chore[];
  pendingTradesForMe: TradeOffer[];
  /** Carry-over lag per rotating series (for calendar projection). */
  rotationLagBySeries: Record<string, number>;
  refresh: () => Promise<void>;
  addChore: (input: AddChoreInput) => Promise<void>;
  removeChore: (id: string) => Promise<void>;
  toggleComplete: (id: string) => Promise<void>;
  toggleCompleteForChore: (chore: Chore) => Promise<void>;
  proposeTrade: (
    offeredChoreIds: string[],
    requestedChoreIds: string[],
    toUserId: string
  ) => Promise<void>;
  respondToTrade: (tradeId: string, accept: boolean) => Promise<void>;
  getChoreById: (id: string) => Chore | undefined;
}

const ChoresContext = createContext<ChoresContextValue | null>(null);

function sortChores(list: Chore[]): Chore[] {
  return [...list].sort((a, b) => a.due_date.localeCompare(b.due_date));
}

export function ChoresProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const { activeGroup } = useGroup();
  const { refreshScores } = usePoints();
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chores, setChores] = useState<Chore[]>([]);
  const [trades, setTrades] = useState<TradeOffer[]>([]);
  const [seriesRotations, setSeriesRotations] = useState<ChoreSeriesRotation[]>([]);

  const rotationLagBySeries = useMemo(
    () =>
      Object.fromEntries(
        seriesRotations.map((r) => [r.series_id, r.rotation_lag] as const)
      ) as Record<string, number>,
    [seriesRotations]
  );

  const syncFromServer = useCallback(
    async (opts?: { pull?: boolean }) => {
      if (!activeGroup?.id) {
        setChores([]);
        setTrades([]);
        setSeriesRotations([]);
        return;
      }
      if (opts?.pull) {
        setRefreshing(true);
      }
      try {
        const [choresRes, tradesRes] = await Promise.all([
          getSupabase()
            .from('chores')
            .select('*')
            .eq('group_id', activeGroup.id)
            .order('due_date', { ascending: true }),
          getSupabase()
            .from('trade_offers')
            .select('*')
            .eq('group_id', activeGroup.id)
            .order('created_at', { ascending: false }),
        ]);
        if (choresRes.error) throw choresRes.error;
        if (tradesRes.error) throw tradesRes.error;
        const normalized = (choresRes.data ?? []).map((row) => normalizeChore(row as Chore));

        let rotations: ChoreSeriesRotation[] = [];
        let pointsDirty = false;
        try {
          await backfillSeriesRotations(activeGroup.id, normalized);
          rotations = await fetchSeriesRotations(activeGroup.id);
          await processRotationCarryOvers(activeGroup.id, normalized, rotations);
          rotations = await fetchSeriesRotations(activeGroup.id);
        } catch {
          rotations = [];
        }
        try {
          await processMissedChorePoints(activeGroup.id, normalized);
          pointsDirty = true;
        } catch {
          /* points migration may not be applied */
        }

        setChores(normalized);
        setSeriesRotations(rotations);
        setTrades((tradesRes.data ?? []).map((row) => normalizeTradeOffer(row as Record<string, unknown>)));
        if (pointsDirty) {
          refreshScores().catch(() => {});
        }
      } finally {
        if (opts?.pull) {
          setRefreshing(false);
        }
      }
    },
    [activeGroup?.id, refreshScores]
  );

  const refresh = useCallback(() => syncFromServer({ pull: true }), [syncFromServer]);

  useEffect(() => {
    let cancelled = false;
    setInitialLoading(true);
    syncFromServer()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setInitialLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [syncFromServer]);

  const spawnNextRecurring = useCallback(
    async (chore: Chore) => {
      if (chore.recurrence_type === 'once' || !activeGroup?.id || !session?.user.id) return;

      const assignees = chore.assignee_ids.length > 0 ? chore.assignee_ids : [chore.assigned_to];
      const seriesId = chore.series_id ?? chore.id;
      const inSeries = chores.filter((c) => (c.series_id ?? c.id) === seriesId);
      const anchorDate = inSeries.reduce(
        (min, c) => (c.due_date < min ? c.due_date : min),
        chore.due_date
      );
      const nextDate = nextDueDate(chore.due_date, chore.recurrence_type);
      const rotations = await fetchSeriesRotations(activeGroup.id);
      const lag = rotationLagForSeries(rotations, seriesId);
      const nextAssignee = resolvePrimaryAssignee(
        assignees,
        nextDate,
        chore.recurrence_type,
        chore.rotation_mode,
        chore.rotation_period,
        anchorDate,
        lag
      );

      const { data: inserted, error } = await getSupabase()
        .from('chores')
        .insert({
          group_id: activeGroup.id,
          title: chore.title,
          notes: chore.notes,
          assigned_to: nextAssignee,
          assignee_ids: assignees,
          recurrence_type: chore.recurrence_type,
          rotation_mode: chore.rotation_mode,
          rotation_period: chore.rotation_period,
          series_id: seriesId,
          due_date: nextDate,
          created_by: session.user.id,
        })
        .select('*')
        .single();

      if (error) throw error;
      if (inserted) {
        setChores((prev) => sortChores([...prev, normalizeChore(inserted as Chore)]));
      }
    },
    [activeGroup?.id, session?.user.id, chores]
  );

  const addChore = useCallback(
    async (input: AddChoreInput) => {
      if (!activeGroup?.id) {
        throw new Error('Join or create a group before adding chores.');
      }
      if (!session?.user.id) {
        throw new Error('You must be signed in to add chores.');
      }

      const assignees = input.assigneeIds.length > 0 ? input.assigneeIds : [session.user.id];
      const isRecurring = input.recurrenceType !== 'once';
      const assignedTo = resolvePrimaryAssignee(
        assignees,
        input.dueDate,
        input.recurrenceType,
        input.rotationMode,
        input.rotationPeriod,
        input.dueDate
      );

      const payload = {
        group_id: activeGroup.id,
        title: input.title.trim(),
        notes: input.notes?.trim() || null,
        assigned_to: assignedTo,
        assignee_ids: assignees,
        recurrence_type: input.recurrenceType,
        rotation_mode: input.rotationMode,
        rotation_period:
          isRecurring && input.rotationMode === 'random' && assignees.length > 1
            ? input.rotationPeriod
            : null,
        series_id: null as string | null,
        due_date: input.dueDate,
        created_by: session.user.id,
      };

      const { data: inserted, error } = await getSupabase()
        .from('chores')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        throw new Error(formatChoreDbError(error));
      }

      let row = normalizeChore(inserted as Chore);

      if (isRecurring && inserted?.id) {
        const { error: seriesError } = await getSupabase()
          .from('chores')
          .update({ series_id: inserted.id })
          .eq('id', inserted.id);
        if (seriesError) {
          throw new Error(formatChoreDbError(seriesError));
        }
        row = { ...row, series_id: inserted.id };
      }

      setChores((prev) => sortChores([...prev, row]));

      if (isRecurring && row.series_id) {
        try {
          await ensureSeriesRotation(row, activeGroup.id, row.series_id, input.dueDate);
          const rotations = await fetchSeriesRotations(activeGroup.id);
          setSeriesRotations(rotations);
        } catch {
          /* migration may not be applied yet */
        }
      }
    },
    [activeGroup?.id, session?.user.id]
  );

  const materializeChore = useCallback(
    async (chore: Chore): Promise<Chore> => {
      if (!activeGroup?.id || !session?.user.id) {
        throw new Error('Cannot save chore');
      }
      if (!isProjectedChoreId(chore.id)) return chore;

      const { data: inserted, error } = await getSupabase()
        .from('chores')
        .insert({
          group_id: activeGroup.id,
          title: chore.title,
          notes: chore.notes,
          assigned_to: chore.assigned_to,
          assignee_ids: chore.assignee_ids,
          recurrence_type: chore.recurrence_type,
          rotation_mode: chore.rotation_mode,
          rotation_period: chore.rotation_period,
          series_id: chore.series_id,
          due_date: chore.due_date,
          created_by: session.user.id,
        })
        .select('*')
        .single();

      if (error) throw new Error(formatChoreDbError(error));
      const row = normalizeChore(inserted as Chore);
      setChores((prev) =>
        sortChores([
          ...prev.filter(
            (c) =>
              !(
                (c.series_id ?? c.id) === (row.series_id ?? row.id) &&
                c.due_date === row.due_date &&
                c.id !== row.id
              )
          ),
          row,
        ])
      );
      return row;
    },
    [activeGroup?.id, session?.user.id]
  );

  const removeChore = useCallback(async (id: string) => {
    const previous = chores;
    setChores((prev) => prev.filter((c) => c.id !== id));

    const { error } = await getSupabase().from('chores').delete().eq('id', id);
    if (error) {
      setChores(previous);
      throw error;
    }
  }, [chores]);

  const toggleCompleteForChore = useCallback(
    async (inputChore: Chore) => {
      let chore = chores.find((c) => c.id === inputChore.id) ?? inputChore;
      if (isProjectedChoreId(chore.id)) {
        chore = await materializeChore(chore);
      }

      const completed = !chore.completed;
      if (completed && !canMarkChoreComplete(chore)) {
        throw new Error(choreCompleteLockedMessage(chore.due_date));
      }

      const snapshot = chores;
      const completedAt = completed ? new Date().toISOString() : null;

      setChores((prev) =>
        prev.map((c) =>
          c.id === chore.id
            ? {
                ...c,
                completed,
                completed_at: completedAt,
              }
            : c
        )
      );

      try {
        const { error } = await getSupabase()
          .from('chores')
          .update({
            completed,
            completed_at: completedAt,
          })
          .eq('id', chore.id);
        if (error) throw error;

        if (completed && activeGroup?.id && completedAt && session?.user.id) {
          const onTime = isOnTimeCompletion(chore.due_date, completedAt);
          if (onTime) {
            await recordOnTimePoint(
              activeGroup.id,
              session.user.id,
              choreLedgerSeriesId(chore),
              chore.due_date
            );
          }
          await refreshScores();
        }

        if (completed && chore.recurrence_type !== 'once') {
          await spawnNextRecurring(chore);
        }
      } catch (e) {
        setChores(snapshot);
        throw e;
      }
    },
    [chores, spawnNextRecurring, materializeChore, activeGroup?.id, session?.user.id, refreshScores]
  );

  const toggleComplete = useCallback(
    async (id: string) => {
      const chore = chores.find((c) => c.id === id);
      if (!chore) return;
      await toggleCompleteForChore(chore);
    },
    [chores, toggleCompleteForChore]
  );

  const proposeTrade = useCallback(
    async (offeredChoreIds: string[], requestedChoreIds: string[], toUserId: string) => {
      if (!activeGroup?.id || !session?.user.id) return;
      const offered = [...new Set(offeredChoreIds)];
      const requested = [...new Set(requestedChoreIds)];
      if (offered.length === 0 || requested.length === 0) {
        throw new Error('Select at least one chore on each side.');
      }

      const { error } = await getSupabase().from('trade_offers').insert({
        group_id: activeGroup.id,
        from_user_id: session.user.id,
        to_user_id: toUserId,
        offered_chore_ids: offered,
        requested_chore_ids: requested,
      });
      if (error) throw formatChoreDbError(error);
      await syncFromServer();
    },
    [activeGroup?.id, session?.user.id, syncFromServer]
  );

  const respondToTrade = useCallback(
    async (tradeId: string, accept: boolean) => {
      const trade = trades.find((t) => t.id === tradeId);
      if (!trade || trade.status !== 'pending') return;

      if (accept) {
        const fromUser = trade.from_user_id;
        const toUser = trade.to_user_id;

        for (const choreId of trade.offered_chore_ids) {
          const chore = chores.find((c) => c.id === choreId);
          if (!chore) continue;
          const { error } = await getSupabase()
            .from('chores')
            .update(buildChoreReassignUpdate(chore, toUser))
            .eq('id', choreId);
          if (error) throw error;
        }

        for (const choreId of trade.requested_chore_ids) {
          const chore = chores.find((c) => c.id === choreId);
          if (!chore) continue;
          const { error } = await getSupabase()
            .from('chores')
            .update(buildChoreReassignUpdate(chore, fromUser))
            .eq('id', choreId);
          if (error) throw error;
        }
      }

      const { error } = await getSupabase()
        .from('trade_offers')
        .update({ status: accept ? 'accepted' : 'declined' })
        .eq('id', tradeId);
      if (error) throw error;
      await syncFromServer();
    },
    [trades, chores, syncFromServer]
  );

  const userId = session?.user.id ?? '';
  const displayChores = useMemo(
    () => mergeChoresWithProjections(chores, rotationLagBySeries),
    [chores, rotationLagBySeries]
  );

  const getChoreById = useCallback(
    (id: string) => displayChores.find((c) => c.id === id),
    [displayChores]
  );

  const myChores = useMemo(
    () =>
      displayChores
        .filter((c) => choreAppliesToUser(c, userId))
        .sort((a, b) => {
          if (a.completed !== b.completed) return a.completed ? 1 : -1;
          return a.due_date.localeCompare(b.due_date);
        }),
    [displayChores, userId]
  );

  const pendingTradesForMe = useMemo(
    () => trades.filter((t) => t.status === 'pending' && t.to_user_id === userId),
    [trades, userId]
  );

  const value = useMemo<ChoresContextValue>(
    () => ({
      initialLoading,
      refreshing,
      loading: initialLoading || refreshing,
      chores,
      trades,
      myChores,
      pendingTradesForMe,
      rotationLagBySeries,
      refresh,
      addChore,
      removeChore,
      toggleComplete,
      toggleCompleteForChore,
      getChoreById,
      proposeTrade,
      respondToTrade,
    }),
    [
      initialLoading,
      refreshing,
      chores,
      trades,
      myChores,
      pendingTradesForMe,
      rotationLagBySeries,
      refresh,
      addChore,
      removeChore,
      toggleComplete,
      toggleCompleteForChore,
      getChoreById,
      proposeTrade,
      respondToTrade,
    ]
  );

  return <ChoresContext.Provider value={value}>{children}</ChoresContext.Provider>;
}

export function useChores() {
  const ctx = useContext(ChoresContext);
  if (!ctx) throw new Error('useChores must be used within ChoresProvider');
  return ctx;
}
