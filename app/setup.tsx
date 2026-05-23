import { Link } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenBackground } from '@/components/ScreenBackground';
import { colors, spacing, typography } from '@/constants/theme';

export default function SetupScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScreenBackground>
      <View style={[styles.wrap, { paddingTop: insets.top + 40 }]}>
        <Text style={styles.emoji}>🏠</Text>
        <Text style={styles.title}>Connect your backend</Text>
        <Text style={styles.body}>
          Copy `.env.example` to `.env` and add your Supabase URL and anon key. Then run the SQL
          in `supabase/schema.sql` in your Supabase dashboard.
        </Text>
        <Text style={styles.hint}>
          Google in Expo Go: Supabase Site URL must be your{' '}
          <Text style={styles.mono}>exp://…/--/auth/callback</Text> URL (from the sign-in
          error), not rumi://.
        </Text>
        <Link href="https://supabase.com/dashboard" style={styles.link}>
          <Text style={styles.linkText}>Open Supabase Dashboard →</Text>
        </Link>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: spacing.xl },
  emoji: { fontSize: 56, marginBottom: spacing.lg },
  title: { ...typography.largeTitle, color: colors.text, marginBottom: spacing.md },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  hint: {
    ...typography.subhead,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  mono: { fontFamily: 'Outfit_500Medium', color: colors.tint },
  link: { marginTop: spacing.md },
  linkText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 17,
    color: colors.tint,
  },
});
