import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useGroup } from '@/context/GroupContext';
import { fetchHouseholdScores } from '@/lib/points';
import type { HouseholdPointRow } from '@/types';

interface PointsContextValue {
  loading: boolean;
  scores: HouseholdPointRow[];
  refreshScores: () => Promise<void>;
}

const PointsContext = createContext<PointsContextValue | null>(null);

export function PointsProvider({ children }: { children: React.ReactNode }) {
  const { activeGroup, members } = useGroup();
  const [loading, setLoading] = useState(false);
  const [scores, setScores] = useState<HouseholdPointRow[]>([]);

  const refreshScores = useCallback(async () => {
    if (!activeGroup?.id) {
      setScores([]);
      return;
    }
    setLoading(true);
    try {
      const memberIds = members.map((m) => m.id);
      const byId = await fetchHouseholdScores(activeGroup.id, memberIds);
      setScores(
        members.map((m) => ({
          user_id: m.id,
          points: byId.get(m.id) ?? 0,
        }))
      );
    } catch {
      setScores(members.map((m) => ({ user_id: m.id, points: 0 })));
    } finally {
      setLoading(false);
    }
  }, [activeGroup?.id, members]);

  useEffect(() => {
    refreshScores().catch(() => setScores([]));
  }, [refreshScores]);

  const value = useMemo(
    () => ({
      loading,
      scores,
      refreshScores,
    }),
    [loading, scores, refreshScores]
  );

  return <PointsContext.Provider value={value}>{children}</PointsContext.Provider>;
}

export function usePoints() {
  const ctx = useContext(PointsContext);
  if (!ctx) throw new Error('usePoints must be used within PointsProvider');
  return ctx;
}
