import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  type PurchasesOfferings,
  type PurchasesPackage,
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

import {
  REVENUECAT_ENTITLEMENT_ID,
  REVENUECAT_PACKAGE_IDS,
} from '@/constants/subscription';
import {
  isDevSubscriptionUnlock,
  isPurchasesConfigured,
  revenueCatAppUserIdForGroup,
  syncHouseholdSubscriptionToDatabase,
} from '@/lib/subscription';

let configured = false;

/** RevenueCat Test Store / cross-platform key (starts with `test_`). */
function getSharedApiKey(): string | null {
  return process.env.EXPO_PUBLIC_REVENUECAT_API_KEY?.trim() ?? null;
}

function getPlatformApiKey(): string | null {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() ?? null;
  }
  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim() ?? null;
  }
  return null;
}

export function getRevenueCatApiKey(): string | null {
  return getPlatformApiKey() ?? getSharedApiKey();
}

export async function configurePurchases(): Promise<boolean> {
  if (configured || isDevSubscriptionUnlock()) return isPurchasesConfigured();

  const apiKey = getRevenueCatApiKey();
  if (!apiKey) return false;

  if (__DEV__) {
    Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
  } else {
    Purchases.setLogLevel(Purchases.LOG_LEVEL.INFO);
  }

  Purchases.configure({ apiKey });
  configured = true;
  return true;
}

export async function loginPurchasesForGroup(groupId: string): Promise<void> {
  if (isDevSubscriptionUnlock()) return;
  const ready = await configurePurchases();
  if (!ready) return;

  const { customerInfo, created } = await Purchases.logIn(revenueCatAppUserIdForGroup(groupId));
  if (__DEV__ && created) {
    console.info('[RevenueCat] Created household subscriber', revenueCatAppUserIdForGroup(groupId));
  }
  await syncEntitlementToHousehold(groupId, customerInfo);
}

export async function logoutPurchases(): Promise<void> {
  if (!configured || isDevSubscriptionUnlock()) return;
  try {
    await Purchases.logOut();
  } catch {
    // Anonymous user — ignore
  }
}

export function hasEntitlement(info: CustomerInfo | null): boolean {
  if (isDevSubscriptionUnlock()) return true;
  if (!info) return false;
  return Boolean(info.entitlements.active[REVENUECAT_ENTITLEMENT_ID]);
}

function activeEntitlement(info: CustomerInfo) {
  return info.entitlements.active[REVENUECAT_ENTITLEMENT_ID] ?? null;
}

function expirationFromCustomerInfo(info: CustomerInfo): string | null {
  return activeEntitlement(info)?.expirationDate ?? null;
}

function storeFromCustomerInfo(info: CustomerInfo): string | null {
  const store = activeEntitlement(info)?.store;
  if (store === 'APP_STORE') return 'app_store';
  if (store === 'PLAY_STORE') return 'play_store';
  return null;
}

export async function syncEntitlementToHousehold(
  groupId: string,
  info: CustomerInfo
): Promise<boolean> {
  if (!hasEntitlement(info)) return false;

  await syncHouseholdSubscriptionToDatabase({
    groupId,
    productId: activeEntitlement(info)?.productIdentifier ?? null,
    store: storeFromCustomerInfo(info),
    expiresAt: expirationFromCustomerInfo(info),
    revenueCatAppUserId: revenueCatAppUserIdForGroup(groupId),
  });

  return true;
}

export function addCustomerInfoListener(
  groupId: string,
  onUpdate: (info: CustomerInfo) => void
): () => void {
  if (isDevSubscriptionUnlock()) return () => {};

  const listener = (info: CustomerInfo) => {
    void syncEntitlementToHousehold(groupId, info).finally(() => onUpdate(info));
  };

  Purchases.addCustomerInfoUpdateListener(listener);
  return () => Purchases.removeCustomerInfoUpdateListener(listener);
}

export async function getOfferings(): Promise<PurchasesOfferings | null> {
  if (isDevSubscriptionUnlock()) return null;
  const ready = await configurePurchases();
  if (!ready) return null;
  return Purchases.getOfferings();
}

export function pickPackages(offerings: PurchasesOfferings | null): {
  monthly: PurchasesPackage | null;
  yearly: PurchasesPackage | null;
} {
  const current = offerings?.current;
  if (!current) {
    return { monthly: null, yearly: null };
  }

  const findPackage = (id: string, type: 'MONTHLY' | 'ANNUAL') =>
    current.availablePackages.find(
      (p) => p.identifier === id || p.product.identifier === id
    ) ??
    current.availablePackages.find((p) => p.packageType === type) ??
    null;

  return {
    monthly:
      current.monthly ??
      findPackage(REVENUECAT_PACKAGE_IDS.monthly, 'MONTHLY'),
    yearly:
      current.annual ??
      findPackage(REVENUECAT_PACKAGE_IDS.yearly, 'ANNUAL'),
  };
}

export async function purchasePackage(
  groupId: string,
  pkg: PurchasesPackage
): Promise<CustomerInfo> {
  await loginPurchasesForGroup(groupId);
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  await syncEntitlementToHousehold(groupId, customerInfo);
  return customerInfo;
}

export async function restorePurchases(groupId: string): Promise<CustomerInfo> {
  await loginPurchasesForGroup(groupId);
  const info = await Purchases.restorePurchases();
  await syncEntitlementToHousehold(groupId, info);
  return info;
}

export async function getCustomerInfoForGroup(groupId: string): Promise<CustomerInfo | null> {
  if (isDevSubscriptionUnlock()) return null;
  await loginPurchasesForGroup(groupId);
  if (!isPurchasesConfigured()) return null;
  return Purchases.getCustomerInfo();
}

export type PaywallFlowResult =
  | { status: 'unlocked' }
  | { status: 'dismissed' }
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

function mapPaywallResult(result: PAYWALL_RESULT): PaywallFlowResult['status'] {
  switch (result) {
    case PAYWALL_RESULT.PURCHASED:
    case PAYWALL_RESULT.RESTORED:
      return 'unlocked';
    case PAYWALL_RESULT.NOT_PRESENTED:
      return 'unlocked';
    case PAYWALL_RESULT.CANCELLED:
      return 'dismissed';
    case PAYWALL_RESULT.ERROR:
    default:
      return 'error';
  }
}

/** Present RevenueCat-hosted paywall (modal). Requires dev/production build. */
export async function presentRevenueCatPaywall(groupId: string): Promise<PaywallFlowResult> {
  if (Platform.OS === 'web') {
    return { status: 'unavailable' };
  }
  if (isDevSubscriptionUnlock()) {
    return { status: 'unlocked' };
  }

  try {
    await loginPurchasesForGroup(groupId);
    const result = await RevenueCatUI.presentPaywall({
      displayCloseButton: true,
    });
    const status = mapPaywallResult(result);
    if (status === 'unlocked') {
      const info = await Purchases.getCustomerInfo();
      await syncEntitlementToHousehold(groupId, info);
      return { status: 'unlocked' };
    }
    if (status === 'dismissed') return { status: 'dismissed' };
    return { status: 'error', message: 'Could not load the paywall.' };
  } catch (e) {
    return {
      status: 'error',
      message: e instanceof Error ? e.message : 'Could not present paywall.',
    };
  }
}

/** Only shows paywall when household lacks Rumi Pro. */
export async function presentPaywallIfNeeded(groupId: string): Promise<PaywallFlowResult> {
  if (Platform.OS === 'web') {
    return { status: 'unavailable' };
  }
  if (isDevSubscriptionUnlock()) {
    return { status: 'unlocked' };
  }

  try {
    await loginPurchasesForGroup(groupId);
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: REVENUECAT_ENTITLEMENT_ID,
      displayCloseButton: true,
    });
    const status = mapPaywallResult(result);
    if (status === 'unlocked') {
      const info = await Purchases.getCustomerInfo();
      await syncEntitlementToHousehold(groupId, info);
      return { status: 'unlocked' };
    }
    if (status === 'dismissed') return { status: 'dismissed' };
    return { status: 'error', message: 'Could not load the paywall.' };
  } catch (e) {
    return {
      status: 'error',
      message: e instanceof Error ? e.message : 'Could not present paywall.',
    };
  }
}

/** Subscription management — cancel, restore, billing help (RevenueCat Customer Center). */
export async function presentCustomerCenter(groupId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await loginPurchasesForGroup(groupId);
  await RevenueCatUI.presentCustomerCenter();
}

export { PAYWALL_RESULT, RevenueCatUI };
