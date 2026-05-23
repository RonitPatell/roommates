import * as Haptics from 'expo-haptics';
import React, { useCallback } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import type { CustomerInfo } from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';

import { useGroup } from '@/context/GroupContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { purchaseErrorMessage } from '@/lib/purchases/errors';
import { syncEntitlementToHousehold } from '@/lib/purchases';

type Props = {
  onUnlocked?: () => void;
  onDismiss?: () => void;
};

/**
 * Embedded RevenueCat Paywall (configured in RevenueCat dashboard).
 * Falls back to nothing on web — parent should show custom paywall instead.
 */
export function RevenueCatPaywallView({ onUnlocked, onDismiss }: Props) {
  const { activeGroup } = useGroup();
  const { refreshSubscription } = useSubscription();
  const groupId = activeGroup?.id;

  const afterCustomerInfo = useCallback(
    async (info: CustomerInfo) => {
      if (!groupId) return;
      await syncEntitlementToHousehold(groupId, info);
      await refreshSubscription();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onUnlocked?.();
    },
    [groupId, refreshSubscription, onUnlocked]
  );

  if (Platform.OS === 'web') {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <RevenueCatUI.Paywall
        options={{ displayCloseButton: true }}
        onPurchaseCompleted={({ customerInfo }) => {
          void afterCustomerInfo(customerInfo);
        }}
        onRestoreCompleted={({ customerInfo }) => {
          void afterCustomerInfo(customerInfo);
        }}
        onPurchaseError={({ error }) => {
          Alert.alert('Purchase failed', purchaseErrorMessage(error));
        }}
        onRestoreError={({ error }) => {
          Alert.alert('Restore failed', purchaseErrorMessage(error));
        }}
        onDismiss={onDismiss}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minHeight: 420, flex: 1 },
});
