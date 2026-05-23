import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PaywallContent } from '@/components/PaywallContent';
import { ScreenBackground } from '@/components/ScreenBackground';
import { colors, spacing, typography } from '@/constants/theme';

export default function UpgradeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 32 },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <View style={styles.content}>
          <PaywallContent onSuccess={() => router.back()} />
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.lg },
  back: { ...typography.subhead, color: colors.chrome, marginBottom: spacing.md },
  content: { paddingBottom: spacing.xl },
});
