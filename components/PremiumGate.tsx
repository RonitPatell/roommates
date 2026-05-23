import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppleButton } from '@/components/AppleButton';
import { RumiLogo } from '@/components/RumiLogo';
import { APP_PRO_NAME } from '@/constants/app';
import {
  PREMIUM_FEATURE_COPY,
  type PremiumFeature,
} from '@/constants/subscription';
import { useSubscription } from '@/context/SubscriptionContext';
import { colors, spacing, typography } from '@/constants/theme';
import { routes } from '@/lib/routes';

interface PremiumGateProps {
  feature: PremiumFeature;
  children: React.ReactNode;
  /** When true, show children with a dim overlay instead of replacing content. */
  overlay?: boolean;
}

export function PremiumGate({ feature, children, overlay = false }: PremiumGateProps) {
  const { canUse, loading, isPro } = useSubscription();
  const router = useRouter();

  if (loading || canUse(feature)) {
    return <>{children}</>;
  }

  const copy = PREMIUM_FEATURE_COPY[feature];

  const locked = (
    <View style={styles.locked}>
      <RumiLogo size="sm" />
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.description}>{copy.description}</Text>
      <Text style={styles.proLabel}>{APP_PRO_NAME}</Text>
      <AppleButton
        label="Upgrade household"
        onPress={() => router.push(routes.upgrade)}
      />
      {!isPro ? (
        <Text style={styles.hint}>
          One subscription unlocks everyone in this household.
        </Text>
      ) : null}
    </View>
  );

  if (overlay) {
    return (
      <View style={styles.wrap}>
        <View style={styles.dimmed} pointerEvents="none">
          {children}
        </View>
        <View style={styles.overlay}>{locked}</View>
      </View>
    );
  }

  return locked;
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  dimmed: { flex: 1, opacity: 0.35 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(9,9,11,0.85)',
  },
  locked: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.title2,
    color: colors.text,
    textAlign: 'center',
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  proLabel: {
    ...typography.caption,
    color: colors.chrome,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
