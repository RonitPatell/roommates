import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useGroup } from '@/context/GroupContext';
import { getSupabase } from '@/lib/supabase';
import type { LockInMessage } from '@/types';

interface LockInContextValue {
  initialLoading: boolean;
  refreshing: boolean;
  /** @deprecated Use initialLoading or refreshing */
  loading: boolean;
  inbox: LockInMessage[];
  unreadCount: number;
  refresh: (opts?: { pull?: boolean }) => Promise<void>;
  sendNudge: (recipientId: string, body: string) => Promise<void>;
  markRead: (messageId: string) => Promise<void>;
}

const LockInContext = createContext<LockInContextValue | null>(null);

export function LockInProvider({ children }: { children: React.ReactNode }) {
  const { activeGroup } = useGroup();
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inbox, setInbox] = useState<LockInMessage[]>([]);

  const refresh = useCallback(async (opts?: { pull?: boolean }) => {
    if (!activeGroup?.id) {
      setInbox([]);
      return;
    }
    if (opts?.pull) {
      setRefreshing(true);
    } else {
      setInitialLoading(true);
    }
    try {
      const { data, error } = await getSupabase().rpc('get_lock_in_inbox', {
        p_group_id: activeGroup.id,
      });
      if (error) throw error;
      setInbox((data ?? []) as LockInMessage[]);
    } finally {
      if (opts?.pull) {
        setRefreshing(false);
      } else {
        setInitialLoading(false);
      }
    }
  }, [activeGroup?.id]);

  useEffect(() => {
    refresh().catch(() => setInbox([]));
  }, [refresh]);

  const sendNudge = useCallback(
    async (recipientId: string, body: string) => {
      if (!activeGroup?.id) throw new Error('No active group');
      const { error } = await getSupabase().rpc('send_lock_in_message', {
        p_group_id: activeGroup.id,
        p_recipient_id: recipientId,
        p_body: body.trim(),
      });
      if (error) throw error;
    },
    [activeGroup?.id]
  );

  const markRead = useCallback(async (messageId: string) => {
    const { error } = await getSupabase().rpc('mark_lock_in_read', {
      p_message_id: messageId,
    });
    if (error) throw error;
    setInbox((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, read_at: m.read_at ?? new Date().toISOString() } : m
      )
    );
  }, []);

  const unreadCount = useMemo(() => inbox.filter((m) => !m.read_at).length, [inbox]);

  const value = useMemo<LockInContextValue>(
    () => ({
      initialLoading,
      refreshing,
      loading: initialLoading || refreshing,
      inbox,
      unreadCount,
      refresh,
      sendNudge,
      markRead,
    }),
    [initialLoading, refreshing, inbox, unreadCount, refresh, sendNudge, markRead]
  );

  return <LockInContext.Provider value={value}>{children}</LockInContext.Provider>;
}

export function useLockIn() {
  const ctx = useContext(LockInContext);
  if (!ctx) throw new Error('useLockIn must be used within LockInProvider');
  return ctx;
}
