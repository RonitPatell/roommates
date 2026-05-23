import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text } from 'react-native';

import { AppleButton } from '@/components/AppleButton';
import { colors, spacing, typography } from '@/constants/theme';
import { useGroup } from '@/context/GroupContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { presentCustomerCenter } from '@/lib/purchases';

type Props = {
  variant?: 'primary' | 'ghost';
};

/** Opens RevenueCat Customer Center (manage subscription, restore, cancel). */
export function CustomerCenterButton({ variant = 'ghost' }: Props) {
  const { activeGroup } = useGroup();
  const { purchasesAvailable, refreshSubscription } = useSubscription();
  const [busy, setBusy] = useState(false);

  const handlePress = async () => {
    if (!activeGroup?.id) {
      Alert.alert('No household', 'Join or create a household first.');
      return;
    }
    if (Platform.OS === 'web') {
      Alert.alert('Not available', 'Customer Center requires the iOS or Android app.');
      return;
    }
    if (!purchasesAvailable) {
      Alert.alert('Not configured', 'Add your RevenueCat API key to .env and use a development build.');
      return;
    }

    setBusy(true);
    try {
      await presentCustomerCenter(activeGroup.id);
      await refreshSubscription();
    } catch (e) {
      Alert.alert(
        'Could not open',
        e instanceof Error ? e.message : 'Customer Center is unavailable.'
      );
    } finally {
      setBusy(false);
    }
  };

  if (variant === 'primary') {
    return (
      <AppleButton
        label={busy ? 'Opening…' : 'Manage subscription'}
        onPress={() => void handlePress()}
        loading={busy}
        variant="secondary"
      />
    );
  }

  return (
    <Pressable onPress={() => void handlePress()} disabled={busy} hitSlop={8}>
      {busy ? (
        <ActivityIndicator color={colors.chrome} />
      ) : (
        <Text style={styles.link}>Manage subscription</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    ...typography.subhead,
    color: colors.chrome,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
});
