import { addDays, format, isAfter, isBefore, parseISO, startOfDay } from 'date-fns';

import {
  isProjectedChoreId,
  isRotatingSeries,
  nextDueDate,
  parseDueDate,
} from '@/lib/chores';
import { getSupabase } from '@/lib/supabase';
import type { Chore } from '@/types';

export function choreLedgerSeriesId(chore: Pick<Chore, 'series_id' | 'id'>): string {
  return chore.series_id ?? chore.id;
}

/** Local calendar date key for a due date string. */
export function dueDateKey(dueDate: string): string {
  return format(parseDueDate(dueDate), 'yyyy-MM-dd');
}

/** Local calendar date key for an ISO completion timestamp. */
export function completionDateKey(completedAtIso: string): string {
  const d = new Date(completedAtIso);
  return format(new Date(d.getFullYear(), d.getMonth(), d.getDate()), 'yyyy-MM-dd');
}

export function isOnTimeCompletion(dueDate: string, completedAtIso: string): boolean {
  return completionDateKey(completedAtIso) <= dueDateKey(dueDate);
}

function isRpcUnavailable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = error.message ?? '';
  return (
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    msg.includes('apply_point_event') ||
    msg.includes('get_household_points') ||
    msg.includes('Could not find the function')
  );
}

function isTableUnavailable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = error.message ?? '';
  return (
    error.code === '42P01' ||
    msg.includes('point_ledger') ||
    msg.includes('household_points')
  );
}

async function applyPointEventDirect(
  groupId: string,
  userId: string,
  seriesId: string,
  dueDate: string,
  delta: -1 | 1,
  reason: 'on_time' | 'missed'
): Promise<boolean> {
  const { data: inserted, error: ledgerError } = await getSupabase()
    .from('point_ledger')
    .insert({
      group_id: groupId,
      user_id: userId,
      series_id: seriesId,
      due_date: dueDate,
      delta,
      reason,
    })
    .select('id')
    .maybeSingle();

  if (ledgerError) {
    if (ledgerError.code === '23505') return false;
    if (isTableUnavailable(ledgerError)) return false;
    throw ledgerError;
  }
  if (!inserted?.id) return false;

  const { data: existing, error: readError } = await getSupabase()
    .from('household_points')
    .select('points')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();

  if (readError && !isTableUnavailable(readError)) throw readError;

  if (existing) {
    const { error: updateError } = await getSupabase()
      .from('household_points')
      .update({
        points: existing.points + delta,
        updated_at: new Date().toISOString(),
      })
      .eq('group_id', groupId)
      .eq('user_id', userId);
    if (updateError) throw updateError;
  } else {
    const { error: insertError } = await getSupabase().from('household_points').insert({
      group_id: groupId,
      user_id: userId,
      points: delta,
    });
    if (insertError) throw insertError;
  }

  return true;
}

export async function applyPointEvent(
  groupId: string,
  userId: string,
  seriesId: string,
  dueDate: string,
  delta: -1 | 1,
  reason: 'on_time' | 'missed'
): Promise<boolean> {
  const { error } = await getSupabase().rpc('apply_point_event', {
    p_group_id: groupId,
    p_user_id: userId,
    p_series_id: seriesId,
    p_due_date: dueDate,
    p_delta: delta,
    p_reason: reason,
  });

  if (!error) return true;

  if (isRpcUnavailable(error) || isTableUnavailable(error)) {
    return applyPointEventDirect(groupId, userId, seriesId, dueDate, delta, reason);
  }

  throw error;
}

export async function recordOnTimePoint(
  groupId: string,
  userId: string,
  seriesId: string,
  dueDate: string
): Promise<boolean> {
  return applyPointEvent(groupId, userId, seriesId, dueDate, 1, 'on_time');
}

export async function fetchHouseholdScores(
  groupId: string,
  memberIds: string[]
): Promise<Map<string, number>> {
  const byId = new Map<string, number>();
  for (const id of memberIds) byId.set(id, 0);

  const { data, error } = await getSupabase().rpc('get_household_points', {
    p_group_id: groupId,
  });

  if (!error) {
    for (const row of (data ?? []) as { user_id: string; points: number }[]) {
      byId.set(row.user_id, row.points);
    }
    return byId;
  }

  if (!isRpcUnavailable(error)) throw error;

  const { data: rows, error: tableError } = await getSupabase()
    .from('household_points')
    .select('user_id, points')
    .eq('group_id', groupId);

  if (tableError) {
    if (isTableUnavailable(tableError)) return byId;
    throw tableError;
  }

  for (const row of rows ?? []) {
    byId.set(row.user_id, row.points);
  }
  return byId;
}

function isOccurrenceComplete(chores: Chore[], seriesId: string, dateKey: string): boolean {
  const row = chores.find(
    (c) =>
      (c.series_id ?? c.id) === seriesId &&
      c.due_date === dateKey &&
      !isProjectedChoreId(c.id)
  );
  return row?.completed === true;
}

/** Missed one-time and non-rotating recurring chores (rotating series use carry-over). */
export async function processMissedChorePoints(
  groupId: string,
  chores: Chore[]
): Promise<void> {
  const today = startOfDay(new Date());
  const yesterday = addDays(today, -1);

  for (const chore of chores) {
    if (chore.recurrence_type !== 'once' || chore.completed) continue;
    const due = startOfDay(parseDueDate(chore.due_date));
    if (!isBefore(due, today)) continue;
    await applyPointEvent(
      groupId,
      chore.assigned_to,
      choreLedgerSeriesId(chore),
      chore.due_date,
      -1,
      'missed'
    );
  }

  const seriesIds = new Set<string>();
  for (const c of chores) {
    if (c.recurrence_type === 'once' || isRotatingSeries(c)) continue;
    seriesIds.add(c.series_id ?? c.id);
  }

  for (const sid of seriesIds) {
    const inSeries = chores.filter((c) => (c.series_id ?? c.id) === sid);
    if (inSeries.length === 0) continue;

    const template =
      inSeries.find((c) => !c.completed) ?? inSeries[inSeries.length - 1];
    const anchor = inSeries.reduce(
      (min, c) => (c.due_date < min ? c.due_date : min),
      inSeries[0].due_date
    );

    let cursor = startOfDay(parseDueDate(anchor));
    while (!isAfter(cursor, yesterday)) {
      const dateKey = format(cursor, 'yyyy-MM-dd');
      if (!isOccurrenceComplete(chores, sid, dateKey)) {
        await applyPointEvent(
          groupId,
          template.assigned_to,
          sid,
          dateKey,
          -1,
          'missed'
        );
      }
      cursor = parseISO(nextDueDate(dateKey, template.recurrence_type));
    }
  }
}
