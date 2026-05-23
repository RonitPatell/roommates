import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { CustomerInfo } from 'react-native-purchases';

import { FREE_TIER, type PremiumFeature } from '@/constants/subscription';
import { useGroup } from '@/context/GroupContext';
import { useChores } from '@/context/ChoresContext';
import {
  canUsePremiumFeature,
  fetchHouseholdProStatus,
  fetchHouseholdSubscription,
  isDevSubscriptionUnlock,
  isPurchasesConfigured,
  isSubscriptionRowActive,
  type HouseholdSubscriptionRow,
} from '@/lib/subscription';
import {
  addCustomerInfoListener,
  configurePurchases,
  getCustomerInfoForGroup,
  hasEntitlement,
  loginPurchasesForGroup,
  logoutPurchases,
  presentPaywallIfNeeded,
  presentRevenueCatPaywall,
  syncEntitlementToHousehold,
  type PaywallFlowResult,
} from '@/lib/purchases';

interface SubscriptionContextValue {
  loading: boolean;
  isPro: boolean;
  customerInfo: CustomerInfo | null;
  subscription: HouseholdSubscriptionRow | null;
  memberCount: number;
  activeChoreCount: number;
  freeLimits: typeof FREE_TIER;
  purchasesAvailable: boolean;
  devUnlock: boolean;
  refreshSubscription: () => Promise<void>;
  canUse: (feature: PremiumFeature) => boolean;
  presentPaywall: () => Promise<PaywallFlowResult>;
  presentPaywallIfNeeded: () => Promise<PaywallFlowResult>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { activeGroup, members } = useGroup();
  const { chores } = useChores();
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [subscription, setSubscription] = useState<HouseholdSubscriptionRow | null>(null);

  const groupId = activeGroup?.id ?? null;
  const memberCount = members.length;
  const activeChoreCount = chores.length;
  const devUnlock = isDevSubscriptionUnlock();
  const purchasesAvailable = isPurchasesConfigured();

  const refreshSubscription = useCallback(async () => {
    if (!groupId) {
      setIsPro(false);
      setCustomerInfo(null);
      setSubscription(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (devUnlock) {
        setIsPro(true);
        setCustomerInfo(null);
        setSubscription(null);
        return;
      }

      await configurePurchases();
      await loginPurchasesForGroup(groupId);

      const [row, proFromRpc, info] = await Promise.all([
        fetchHouseholdSubscription(groupId),
        fetchHouseholdProStatus(groupId),
        purchasesAvailable ? getCustomerInfoForGroup(groupId) : Promise.resolve(null),
      ]);

      setSubscription(row);
      setCustomerInfo(info);

      let pro = proFromRpc || isSubscriptionRowActive(row) || hasEntitlement(info);

      if (!pro && info && hasEntitlement(info)) {
        await syncEntitlementToHousehold(groupId, info);
        pro = true;
        const updated = await fetchHouseholdSubscription(groupId);
        setSubscription(updated);
      }

      setIsPro(pro);
    } catch {
      setIsPro(false);
      setCustomerInfo(null);
    } finally {
      setLoading(false);
    }
  }, [groupId, devUnlock, purchasesAvailable]);

  useEffect(() => {
    void refreshSubscription();
  }, [refreshSubscription]);

  useEffect(() => {
    if (!groupId || devUnlock || !purchasesAvailable) return;

    void configurePurchases().then(() => loginPurchasesForGroup(groupId));

    const remove = addCustomerInfoListener(groupId, (info) => {
      setCustomerInfo(info);
      setIsPro(hasEntitlement(info));
      void fetchHouseholdSubscription(groupId).then(setSubscription);
    });

    return remove;
  }, [groupId, devUnlock, purchasesAvailable]);

  useEffect(() => {
    if (!groupId && !devUnlock) {
      void logoutPurchases();
    }
  }, [groupId, devUnlock]);

  const presentPaywall = useCallback(async (): Promise<PaywallFlowResult> => {
    if (!groupId) return { status: 'unavailable' };
    const result = await presentRevenueCatPaywall(groupId);
    if (result.status === 'unlocked') await refreshSubscription();
    return result;
  }, [groupId, refreshSubscription]);

  const presentPaywallIfNeededFn = useCallback(async (): Promise<PaywallFlowResult> => {
    if (!groupId) return { status: 'unavailable' };
    const result = await presentPaywallIfNeeded(groupId);
    if (result.status === 'unlocked') await refreshSubscription();
    return result;
  }, [groupId, refreshSubscription]);

  const canUse = useCallback(
    (feature: PremiumFeature) =>
      canUsePremiumFeature(feature, { isPro, memberCount, activeChoreCount }),
    [isPro, memberCount, activeChoreCount]
  );

  const value = useMemo(
    () => ({
      loading,
      isPro,
      customerInfo,
      subscription,
      memberCount,
      activeChoreCount,
      freeLimits: FREE_TIER,
      purchasesAvailable,
      devUnlock,
      refreshSubscription,
      canUse,
      presentPaywall,
      presentPaywallIfNeeded: presentPaywallIfNeededFn,
    }),
    [
      loading,
      isPro,
      customerInfo,
      subscription,
      memberCount,
      activeChoreCount,
      purchasesAvailable,
      devUnlock,
      refreshSubscription,
      canUse,
      presentPaywall,
      presentPaywallIfNeededFn,
    ]
  );

  return (
    <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return ctx;
}
