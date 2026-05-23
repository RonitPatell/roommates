import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from '@/context/AuthContext';
import { deferAsync, withTimeout } from '@/lib/async';
import { firstAvailableColor, isMemberColor } from '@/constants/memberColors';
import {
  cancelHouseholdInvite,
  fetchPendingInvitesForGroup,
  fetchPendingInvitesForMe,
  respondHouseholdInvite,
  sendHouseholdInvite,
} from '@/lib/householdInvites';
import { getSupabase, memberColor } from '@/lib/supabase';
import type {
  Group,
  GroupMember,
  HouseholdInviteIncoming,
  HouseholdInviteOutgoing,
  MemberView,
  Profile,
} from '@/types';

const ACTIVE_GROUP_KEY = '@roommates_active_group';
const GROUP_ACTION_TIMEOUT_MS = 20_000;

interface GroupContextValue {
  loading: boolean;
  groups: Group[];
  activeGroup: Group | null;
  members: MemberView[];
  refreshGroups: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  setActiveGroup: (groupId: string | null) => Promise<void>;
  createGroup: (name: string) => Promise<string>;
  /** @deprecated Use sendHouseholdInvite */
  addMemberByUsername: (username: string) => Promise<void>;
  sendHouseholdInvite: (username: string) => Promise<void>;
  incomingInvites: HouseholdInviteIncoming[];
  outgoingInvites: HouseholdInviteOutgoing[];
  refreshInvites: () => Promise<void>;
  respondToHouseholdInvite: (requestId: string, accept: boolean) => Promise<string | null>;
  cancelOutgoingInvite: (requestId: string) => Promise<void>;
  leaveGroup: () => Promise<void>;
  /** Permanently delete a household (creator only; enforced by RLS). */
  deleteGroup: (groupId: string) => Promise<void>;
  getMember: (userId: string) => MemberView | undefined;
}

const GroupContext = createContext<GroupContextValue | null>(null);

function buildMemberViews(profiles: Profile[]): MemberView[] {
  const taken: string[] = [];
  const views: MemberView[] = [];

  const withSaved = profiles.filter(
    (p) => p.accent_color && isMemberColor(p.accent_color)
  );
  const needsColor = profiles.filter(
    (p) => !p.accent_color || !isMemberColor(p.accent_color)
  );

  for (const profile of withSaved) {
    const displayName = profile.display_name || profile.username;
    let color = profile.accent_color!;
    if (taken.includes(color)) {
      color = firstAvailableColor(taken) ?? memberColor(profile.id);
    }
    taken.push(color);
    views.push({
      id: profile.id,
      username: profile.username,
      displayName,
      color,
      initial: displayName.charAt(0).toUpperCase(),
    });
  }

  for (const profile of needsColor) {
    if (views.some((v) => v.id === profile.id)) continue;
    const displayName = profile.display_name || profile.username;
    const color = firstAvailableColor(taken) ?? memberColor(profile.id);
    taken.push(color);
    views.push({
      id: profile.id,
      username: profile.username,
      displayName,
      color,
      initial: displayName.charAt(0).toUpperCase(),
    });
  }

  return views;
}

export function GroupProvider({ children }: { children: React.ReactNode }) {
  const { session, configured } = useAuth();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberView[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<HouseholdInviteIncoming[]>([]);
  const [outgoingInvites, setOutgoingInvites] = useState<HouseholdInviteOutgoing[]>([]);

  const activeGroup = useMemo(
    () => groups.find((g) => g.id === activeGroupId) ?? null,
    [groups, activeGroupId]
  );

  const refreshGroups = useCallback(async () => {
    if (!session?.user.id) return;
    const { data: memberships, error: mErr } = await getSupabase()
      .from('group_members')
      .select('group_id')
      .eq('user_id', session.user.id);
    if (mErr) throw mErr;
    const ids = (memberships ?? []).map((m) => m.group_id);
    if (ids.length === 0) {
      setGroups([]);
      return;
    }
    const { data, error } = await getSupabase().from('groups').select('*').in('id', ids);
    if (error) throw error;
    setGroups((data ?? []) as Group[]);
  }, [session?.user.id]);

  const refreshMembers = useCallback(async () => {
    if (!activeGroupId) {
      setMembers([]);
      return;
    }
    const { data: memberships, error: mErr } = await getSupabase()
      .from('group_members')
      .select('user_id, role')
      .eq('group_id', activeGroupId);
    if (mErr) throw mErr;

    const userIds = (memberships ?? []).map((m) => m.user_id);
    if (userIds.length === 0) {
      setMembers([]);
      return;
    }

    const { data: profiles, error: pErr } = await getSupabase()
      .from('profiles')
      .select('*')
      .in('id', userIds);
    if (pErr) throw pErr;

    setMembers(buildMemberViews((profiles ?? []) as Profile[]));
  }, [activeGroupId]);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }

    if (!session) {
      setActiveGroupId(null);
      setGroups([]);
      setMembers([]);
      AsyncStorage.removeItem(ACTIVE_GROUP_KEY).catch(() => {});
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const saved = await AsyncStorage.getItem(ACTIVE_GROUP_KEY);
        await withTimeout(refreshGroups(), 12_000, 'Load groups');
        if (saved) setActiveGroupId(saved);
      } catch {
        setGroups([]);
        setActiveGroupId(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [configured, session, refreshGroups]);

  const refreshInvites = useCallback(async () => {
    if (!session?.user.id) {
      setIncomingInvites([]);
      setOutgoingInvites([]);
      return;
    }
    try {
      const incoming = await fetchPendingInvitesForMe();
      setIncomingInvites(incoming);
      if (activeGroupId) {
        const outgoing = await fetchPendingInvitesForGroup(activeGroupId);
        setOutgoingInvites(outgoing);
      } else {
        setOutgoingInvites([]);
      }
    } catch {
      setIncomingInvites([]);
      setOutgoingInvites([]);
    }
  }, [session?.user.id, activeGroupId]);

  useEffect(() => {
    if (activeGroupId) refreshMembers().catch(() => setMembers([]));
  }, [activeGroupId, refreshMembers]);

  useEffect(() => {
    refreshInvites().catch(() => {});
  }, [refreshInvites]);

  const setActiveGroup = useCallback(async (groupId: string | null) => {
    setActiveGroupId(groupId);
    if (groupId) await AsyncStorage.setItem(ACTIVE_GROUP_KEY, groupId);
    else await AsyncStorage.removeItem(ACTIVE_GROUP_KEY);
  }, []);

  const createGroup = useCallback(
    async (name: string) => {
      if (!session?.user.id) {
        throw new Error('You must be signed in to create a group');
      }

      const trimmed = name.trim();
      let groupId: string;

      try {
        const { data, error } = await withTimeout(
          getSupabase().rpc('create_group_with_owner', { gname: trimmed }),
          GROUP_ACTION_TIMEOUT_MS,
          'Create group'
        );

        if (error) {
          const msg = error.message ?? '';
          if (error.code === 'PGRST202' || msg.includes('create_group_with_owner')) {
            throw new Error(
              'Create group is not set up on the server. Run supabase/schema.sql in the Supabase SQL Editor.'
            );
          }
          throw new Error(msg || 'Could not create group');
        }

        if (!data) throw new Error('Server did not return a group id');
        groupId = data as string;
      } catch (e) {
        if (e instanceof Error && e.message.includes('timed out')) {
          throw new Error(
            'Could not reach Supabase. Check Wi‑Fi and your .env keys, then try again.'
          );
        }
        throw e;
      }

      const optimistic: Group = {
        id: groupId,
        name: trimmed,
        created_by: session.user.id,
        created_at: new Date().toISOString(),
      };

      setGroups((prev) => {
        const rest = prev.filter((g) => g.id !== groupId);
        return [...rest, optimistic];
      });

      await setActiveGroup(groupId);
      deferAsync(() => refreshGroups().catch(() => {}));

      return groupId;
    },
    [session?.user.id, refreshGroups, setActiveGroup]
  );

  const sendHouseholdInviteByUsername = useCallback(
    async (username: string) => {
      if (!activeGroupId) throw new Error('No active group');
      await sendHouseholdInvite(activeGroupId, username);
      await refreshInvites();
    },
    [activeGroupId, refreshInvites]
  );

  const addMemberByUsername = sendHouseholdInviteByUsername;

  const respondToHouseholdInvite = useCallback(
    async (requestId: string, accept: boolean) => {
      const invite = incomingInvites.find((i) => i.id === requestId);
      await respondHouseholdInvite(requestId, accept);
      await refreshInvites();
      await refreshGroups();
      if (accept && invite) {
        await setActiveGroup(invite.group_id);
        return invite.group_id;
      }
      return null;
    },
    [incomingInvites, refreshInvites, refreshGroups, setActiveGroup]
  );

  const cancelOutgoingInvite = useCallback(
    async (requestId: string) => {
      await cancelHouseholdInvite(requestId);
      await refreshInvites();
    },
    [refreshInvites]
  );

  const leaveGroup = useCallback(async () => {
    if (!activeGroupId || !session?.user.id) return;
    await getSupabase()
      .from('group_members')
      .delete()
      .eq('group_id', activeGroupId)
      .eq('user_id', session.user.id);
    await setActiveGroup(null);
    await refreshGroups();
  }, [activeGroupId, session?.user.id, setActiveGroup, refreshGroups]);

  const deleteGroup = useCallback(
    async (groupId: string) => {
      if (!session?.user.id) throw new Error('You must be signed in');

      const group = groups.find((g) => g.id === groupId);
      if (!group) throw new Error('Household not found');
      if (group.created_by !== session.user.id) {
        throw new Error('Only the person who created this household can delete it');
      }

      const supabase = getSupabase();

      const { error: rpcError } = await withTimeout(
        supabase.rpc('delete_group_as_creator', { gid: groupId }),
        GROUP_ACTION_TIMEOUT_MS,
        'Delete household'
      );

      if (rpcError) {
        const msg = rpcError.message ?? '';
        const missingRpc =
          rpcError.code === 'PGRST202' || msg.includes('delete_group_as_creator');

        if (!missingRpc) {
          throw new Error(msg || 'Could not delete household');
        }

        const { data: deleted, error: delError } = await withTimeout(
          supabase.from('groups').delete().eq('id', groupId).select('id'),
          GROUP_ACTION_TIMEOUT_MS,
          'Delete household'
        );
        if (delError) throw new Error(delError.message || 'Could not delete household');
        if (!deleted?.length) {
          throw new Error(
            'Delete did not apply. Run supabase/delete-group-migration.sql in the Supabase SQL Editor.'
          );
        }
      }

      if (activeGroupId === groupId) {
        setMembers([]);
        await setActiveGroup(null);
      }

      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      await refreshGroups();
    },
    [session?.user.id, groups, activeGroupId, setActiveGroup, refreshGroups]
  );

  const getMember = useCallback(
    (userId: string) => members.find((m) => m.id === userId),
    [members]
  );

  const value = useMemo<GroupContextValue>(
    () => ({
      loading,
      groups,
      activeGroup,
      members,
      refreshGroups,
      refreshMembers,
      setActiveGroup,
      createGroup,
      addMemberByUsername,
      sendHouseholdInvite: sendHouseholdInviteByUsername,
      incomingInvites,
      outgoingInvites,
      refreshInvites,
      respondToHouseholdInvite,
      cancelOutgoingInvite,
      leaveGroup,
      deleteGroup,
      getMember,
    }),
    [
      loading,
      groups,
      activeGroup,
      members,
      refreshGroups,
      refreshMembers,
      setActiveGroup,
      createGroup,
      addMemberByUsername,
      sendHouseholdInviteByUsername,
      incomingInvites,
      outgoingInvites,
      refreshInvites,
      respondToHouseholdInvite,
      cancelOutgoingInvite,
      leaveGroup,
      deleteGroup,
      getMember,
    ]
  );

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
}

export function useGroup() {
  const ctx = useContext(GroupContext);
  if (!ctx) throw new Error('useGroup must be used within GroupProvider');
  return ctx;
}
