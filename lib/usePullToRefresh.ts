import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useChores } from '@/context/ChoresContext';
import { useGroup } from '@/context/GroupContext';
import { useLockIn } from '@/context/LockInContext';

const MIN_REFRESH_MS = 550;

export type PullToRefreshOptions = {
  chores?: boolean;
  members?: boolean;
  profile?: boolean;
  nudges?: boolean;
};

const DEFAULT_OPTIONS: Required<PullToRefreshOptions> = {
  chores: true,
  members: true,
  profile: true,
  nudges: false,
};

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Pull-to-refresh that re-fetches server data and keeps the spinner visible briefly. */
export function usePullToRefresh(options: PullToRefreshOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { refresh: refreshChores, refreshing: choresRefreshing } = useChores();
  const { refreshMembers } = useGroup();
  const { refreshProfile } = useAuth();
  const { refresh: refreshNudges, refreshing: nudgesRefreshing } = useLockIn();

  const [holding, setHolding] = useState(false);

  const refreshing = choresRefreshing || nudgesRefreshing || holding;

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHolding(true);
    const started = Date.now();
    try {
      const tasks: Promise<unknown>[] = [];
      if (opts.chores) tasks.push(refreshChores());
      if (opts.members) tasks.push(refreshMembers());
      if (opts.profile) tasks.push(refreshProfile());
      if (opts.nudges) tasks.push(refreshNudges({ pull: true }));
      await Promise.allSettled(tasks);
    } finally {
      const remain = MIN_REFRESH_MS - (Date.now() - started);
      if (remain > 0) await delay(remain);
      setHolding(false);
    }
  }, [
    opts.chores,
    opts.members,
    opts.profile,
    opts.nudges,
    refreshChores,
    refreshMembers,
    refreshProfile,
    refreshNudges,
  ]);

  return { refreshing, onRefresh };
}
