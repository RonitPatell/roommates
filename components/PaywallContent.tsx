import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';

import { AppleButton } from '@/components/AppleButton';
import { CustomerCenterButton } from '@/components/CustomerCenterButton';
import { RevenueCatPaywallView } from '@/components/RevenueCatPaywallView';
import { RumiLogo } from '@/components/RumiLogo';
import { APP_PRO_NAME } from '@/constants/app';
import {
  PREMIUM_FEATURE_COPY,
  SUBSCRIPTION_DISPLAY,
  type PremiumFeature,
} from '@/constants/subscription';
import { useGroup } from '@/context/GroupContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { purchaseErrorMessage } from '@/lib/purchases/errors';
import {
  getOfferings,
  hasEntitlement,
  pickPackages,
  purchasePackage,
  restorePurchases,
} from '@/lib/purchases';

const HIGHLIGHT_FEATURES: PremiumFeature[] = [
  'swap',
  'points',
  'nudge',
  'fair_rotation',
];

type Plan = 'monthly' | 'yearly';

function PaywallFeatureList() {
  return (
    <View style={styles.features}>
      {HIGHLIGHT_FEATURES.map((key) => {
        const copy = PREMIUM_FEATURE_COPY[key];
        return (
          <View key={key} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>{copy.title}</Text>
              <Text style={styles.featureDesc}>{copy.description}</Text>
            </View>
          </View>
        );
      })}
      <View style={styles.featureRow}>
        <Ionicons name="checkmark-circle" size={20} color={colors.success} />
        <Text style={styles.featureTitle}>Unlimited roommates & chores</Text>
      </View>
    </View>
  );
}

/** Manual plan picker when RevenueCat UI is unavailable (web / misconfigured). */
function LegacyPaywallFallback({ onSuccess }: { onSuccess?: () => void }) {
  const { activeGroup } = useGroup();
  const { refreshSubscription } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<Plan>('yearly');
  const [monthlyPkg, setMonthlyPkg] = useState<PurchasesPackage | null>(null);
  const [yearlyPkg, setYearlyPkg] = useState<PurchasesPackage | null>(null);

  const groupId = activeGroup?.id;

  const loadOfferings = useCallback(async () => {
    setLoading(true);
    try {
      const offerings = await getOfferings();
      const { monthly, yearly } = pickPackages(offerings);
      setMonthlyPkg(monthly);
      setYearlyPkg(yearly);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOfferings();
  }, [loadOfferings]);

  const selectedPkg = plan === 'yearly' ? yearlyPkg : monthlyPkg;
  const monthlyPrice =
    monthlyPkg?.product.priceString ?? SUBSCRIPTION_DISPLAY.monthly.price;
  const yearlyPrice = yearlyPkg?.product.priceString ?? SUBSCRIPTION_DISPLAY.yearly.price;

  const handlePurchase = async () => {
    if (!groupId) {
      Alert.alert('No household', 'Join or create a household first.');
      return;
    }
    if (!selectedPkg) {
      Alert.alert('Unavailable', 'Subscription products are not set up in RevenueCat yet.');
      return;
    }

    setBusy(true);
    try {
      const info = await purchasePackage(groupId, selectedPkg);
      if (hasEntitlement(info)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await refreshSubscription();
        onSuccess?.();
        Alert.alert('Welcome to Pro', `Everyone in ${activeGroup?.name} is unlocked.`);
      }
    } catch (e) {
      Alert.alert('Purchase failed', purchaseErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    if (!groupId) return;
    setBusy(true);
    try {
      const info = await restorePurchases(groupId);
      await refreshSubscription();
      if (hasEntitlement(info)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSuccess?.();
        Alert.alert('Restored', 'Your household subscription is active.');
      } else {
        Alert.alert('No subscription found', 'No active Rumi Pro plan for this household.');
      }
    } catch (e) {
      Alert.alert('Restore failed', purchaseErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {loading ? (
        <ActivityIndicator color={colors.chrome} style={{ marginVertical: spacing.lg }} />
      ) : (
        <View style={styles.plans}>
          <Pressable
            style={[styles.planCard, plan === 'yearly' && styles.planCardSelected]}
            onPress={() => setPlan('yearly')}
          >
            <View style={styles.planHeader}>
              <Text style={styles.planLabel}>{SUBSCRIPTION_DISPLAY.yearly.label}</Text>
              {SUBSCRIPTION_DISPLAY.yearly.badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{SUBSCRIPTION_DISPLAY.yearly.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.planPrice}>{yearlyPrice}</Text>
            <Text style={styles.planPeriod}>
              per year · {SUBSCRIPTION_DISPLAY.yearly.savings}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.planCard, plan === 'monthly' && styles.planCardSelected]}
            onPress={() => setPlan('monthly')}
          >
            <Text style={styles.planLabel}>{SUBSCRIPTION_DISPLAY.monthly.label}</Text>
            <Text style={styles.planPrice}>{monthlyPrice}</Text>
            <Text style={styles.planPeriod}>per month</Text>
          </Pressable>
        </View>
      )}

      <AppleButton
        label={busy ? 'Please wait…' : 'Subscribe'}
        onPress={() => void handlePurchase()}
        loading={busy}
        disabled={busy || loading}
      />

      <Pressable onPress={() => void handleRestore()} disabled={busy}>
        <Text style={styles.restore}>Restore purchases</Text>
      </Pressable>
    </>
  );
}

export function PaywallContent({ onSuccess }: { onSuccess?: () => void }) {
  const { activeGroup } = useGroup();
  const { isPro, purchasesAvailable, devUnlock } = useSubscription();

  const useRevenueCatUi =
    Platform.OS !== 'web' && purchasesAvailable && !devUnlock;

  if (isPro) {
    return (
      <View style={styles.centered}>
        <RumiLogo size="md" />
        <Text style={styles.proActiveTitle}>You&apos;re on {APP_PRO_NAME}</Text>
        <Text style={styles.proActiveBody}>
          {activeGroup?.name ?? 'This household'} has full access for every roommate.
        </Text>
        <CustomerCenterButton variant="primary" />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <RumiLogo size="md" />
      <Text style={styles.title}>{APP_PRO_NAME}</Text>
      <Text style={styles.subtitle}>
        One subscription for the whole household — any roommate can subscribe.
      </Text>

      <PaywallFeatureList />

      {useRevenueCatUi ? (
        <RevenueCatPaywallView onUnlocked={onSuccess} />
      ) : (
        <LegacyPaywallFallback onSuccess={onSuccess} />
      )}

      {useRevenueCatUi ? <CustomerCenterButton /> : null}

      <Text style={styles.legal}>
        Payment is charged to your App Store or Google Play account. Subscriptions renew
        automatically unless cancelled at least 24 hours before the end of the period.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  centered: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  title: { ...typography.largeTitle, color: colors.text, textAlign: 'center' },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  features: { gap: spacing.md, marginVertical: spacing.sm },
  featureRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  featureText: { flex: 1 },
  featureTitle: { ...typography.headline, color: colors.text },
  featureDesc: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  plans: { gap: spacing.sm },
  planCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  planCardSelected: {
    borderColor: colors.chrome,
    backgroundColor: `${colors.chrome}12`,
  },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  planLabel: { ...typography.headline, color: colors.text },
  badge: {
    backgroundColor: colors.chrome,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  badgeText: { ...typography.caption, color: colors.background, fontWeight: '600' },
  planPrice: { ...typography.title1, color: colors.text, marginTop: spacing.xs },
  planPeriod: { ...typography.caption, color: colors.textSecondary },
  restore: {
    ...typography.subhead,
    color: colors.chrome,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  legal: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  proActiveTitle: { ...typography.title2, color: colors.text },
  proActiveBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});
