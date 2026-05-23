import { getSupabase } from '@/lib/supabase';
import type { HouseholdInviteIncoming, HouseholdInviteOutgoing } from '@/types';

function isInvitesUnavailable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = error.message ?? '';
  return (
    error.code === 'PGRST202' ||
    error.code === '42P01' ||
    msg.includes('household_join_requests') ||
    msg.includes('send_household_invite')
  );
}

function mapIncoming(row: Record<string, unknown>): HouseholdInviteIncoming {
  return {
    id: row.id as string,
    group_id: row.group_id as string,
    group_name: row.group_name as string,
    invited_by: row.invited_by as string,
    inviter_username: row.inviter_username as string,
    inviter_display_name: (row.inviter_display_name as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

function mapOutgoing(row: Record<string, unknown>): HouseholdInviteOutgoing {
  return {
    id: row.id as string,
    invited_user_id: row.invited_user_id as string,
    invitee_username: row.invitee_username as string,
    invitee_display_name: (row.invitee_display_name as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

export async function sendHouseholdInvite(
  groupId: string,
  username: string
): Promise<string> {
  const { data, error } = await getSupabase().rpc('send_household_invite', {
    gid: groupId,
    uname: username.trim().toLowerCase(),
  });
  if (error) {
    if (isInvitesUnavailable(error)) {
      throw new Error(
        'Household invites are not set up yet. Run supabase/household-invites-migration.sql in Supabase.'
      );
    }
    throw error;
  }
  return data as string;
}

export async function respondHouseholdInvite(
  requestId: string,
  accept: boolean
): Promise<void> {
  const { error } = await getSupabase().rpc('respond_household_invite', {
    p_request_id: requestId,
    p_accept: accept,
  });
  if (error) throw error;
}

export async function cancelHouseholdInvite(requestId: string): Promise<void> {
  const { error } = await getSupabase().rpc('cancel_household_invite', {
    p_request_id: requestId,
  });
  if (error) throw error;
}

export async function fetchPendingInvitesForMe(): Promise<HouseholdInviteIncoming[]> {
  const { data, error } = await getSupabase().rpc('get_pending_invites_for_me');
  if (error) {
    if (isInvitesUnavailable(error)) return [];
    throw error;
  }
  return ((data ?? []) as Record<string, unknown>[]).map(mapIncoming);
}

export async function fetchPendingInvitesForGroup(
  groupId: string
): Promise<HouseholdInviteOutgoing[]> {
  const { data, error } = await getSupabase().rpc('get_pending_invites_for_group', {
    p_group_id: groupId,
  });
  if (error) {
    if (isInvitesUnavailable(error)) return [];
    throw error;
  }
  return ((data ?? []) as Record<string, unknown>[]).map(mapOutgoing);
}
