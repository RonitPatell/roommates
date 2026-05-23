import { Platform } from 'react-native';

import {
  FREE_TIER,
  type PremiumFeature,
  REVENUECAT_ENTITLEMENT_ID,
} from '@/constants/subscription';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

export type HouseholdSubscriptionRow = {
  group_id: string;
  status: string;
  product_id: string | null;
  store: string | null;
  expires_at: string | null;
  updated_at: string;
};

export function revenueCatAppUserIdForGroup(groupId: string): string {
  return `household_${groupId}`;
}

export function isDevSubscriptionUnlock(): boolean {
  return process.env.EXPO_PUBLIC_SUBSCRIPTION_DEV_PRO === 'true';
}

export function isPurchasesConfigured(): boolean {
  if (isDevSubscriptionUnlock()) return true;
  const shared = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY?.trim();
  const ios = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim();
  const android = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim();
  if (Platform.OS === 'ios') return Boolean(ios || shared);
  if (Platform.OS === 'android') return Boolean(android || shared);
  return Boolean(ios || android || shared);
}

export async function fetchHouseholdSubscription(
  groupId: string | null | undefined
): Promise<HouseholdSubscriptionRow | null> {
  if (!groupId || !isSupabaseConfigured) return null;

  const { data, error } = await getSupabase()
    .from('household_subscriptions')
    .select('group_id, status, product_id, store, expires_at, updated_at')
    .eq('group_id', groupId)
    .maybeSingle();

  if (error) throw error;
  return data as HouseholdSubscriptionRow | null;
}

export function isSubscriptionRowActive(row: HouseholdSubscriptionRow | null): boolean {
  if (!row || row.status !== 'active') return false;
  if (!row.expires_at) return true;
  return new Date(row.expires_at).getTime() > Date.now();
}

export async function fetchHouseholdProStatus(groupId: string | null | undefined): Promise<boolean> {
  if (!groupId) return false;
  if (isDevSubscriptionUnlock()) return true;

  const { data, error } = await getSupabase().rpc('is_household_pro', {
    p_group_id: groupId,
  });

  if (error) {
    const row = await fetchHouseholdSubscription(groupId);
    return isSubscriptionRowActive(row);
  }

  return Boolean(data);
}

export async function syncHouseholdSubscriptionToDatabase(params: {
  groupId: string;
  productId?: string | null;
  store?: string | null;
  expiresAt?: string | null;
  revenueCatAppUserId?: string | null;
}): Promise<void> {
  const { error } = await getSupabase().rpc('upsert_household_subscription', {
    p_group_id: params.groupId,
    p_product_id: params.productId ?? null,
    p_store: params.store ?? null,
    p_expires_at: params.expiresAt ?? null,
    p_revenuecat_app_user_id: params.revenueCatAppUserId ?? null,
  });

  if (error) throw error;
}

export function canUsePremiumFeature(
  feature: PremiumFeature,
  opts: {
    isPro: boolean;
    memberCount: number;
    activeChoreCount: number;
  }
): boolean {
  if (opts.isPro) return true;

  switch (feature) {
    case 'swap':
    case 'points':
    case 'nudge':
    case 'fair_rotation':
      return false;
    case 'unlimited_members':
      return opts.memberCount <= FREE_TIER.maxMembers;
    case 'unlimited_chores':
      return opts.activeChoreCount < FREE_TIER.maxActiveChores;
    default:
      return false;
  }
}

export function blockedFeatureMessage(feature: PremiumFeature): string {
  return `Upgrade your household to unlock ${feature.replace(/_/g, ' ')}.`;
}

/** @internal Used by purchases layer */
export const ENTITLEMENT_ID = REVENUECAT_ENTITLEMENT_ID;
