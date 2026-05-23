import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useGroup } from '@/context/GroupContext';
import { routes } from '@/lib/routes';

const STARTUP_TIMEOUT_MS = 15_000;

export default function Index() {
  const { loading: authLoading, configured, session, needsUsername, needsPasswordReset } =
    useAuth();
  const { loading: groupLoading, activeGroup } = useGroup();
  const [timedOut, setTimedOut] = useState(false);

  const waiting = authLoading || (session ? groupLoading : false);

  useEffect(() => {
    if (!waiting) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), STARTUP_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  if (!configured) return <Redirect href={routes.setup} />;

  if (needsPasswordReset) return <Redirect href={routes.resetPassword} />;

  if (waiting && !timedOut) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.tint} />
        <Text style={styles.hint}>Loading…</Text>
      </View>
    );
  }

  if (waiting && timedOut) {
    return (
      <View style={styles.center}>
        <Text style={styles.timeoutTitle}>Taking longer than expected</Text>
        <Text style={styles.timeoutBody}>
          Check your Wi‑Fi and Supabase settings in .env, then try again.
        </Text>
        <Pressable style={styles.retryBtn} onPress={() => setTimedOut(false)}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
        {!session ? <Redirect href={routes.welcome} /> : null}
      </View>
    );
  }

  if (!session) return <Redirect href={routes.welcome} />;
  if (needsUsername) return <Redirect href={routes.setupUsername} />;
  if (!activeGroup) return <Redirect href={routes.groups} />;
  return <Redirect href={routes.tabs} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
    gap: spacing.md,
  },
  hint: {
    ...typography.subhead,
    color: colors.textTertiary,
  },
  timeoutTitle: {
    ...typography.headline,
    color: colors.text,
    textAlign: 'center',
  },
  timeoutBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  retryBtn: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderChrome,
  },
  retryText: {
    ...typography.headline,
    color: colors.chromeBright,
  },
});
