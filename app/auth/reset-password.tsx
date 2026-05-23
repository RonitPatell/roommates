import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/constants/theme';
import { bootstrapPasswordRecoverySession } from '@/lib/passwordRecoveryBootstrap';
import { routes } from '@/lib/routes';

/**
 * Deep link entry: rumi://auth/reset-password or exp://…/--/auth/reset-password
 * Must apply tokens before opening the reset form.
 */
export default function AuthResetPasswordDeepLink() {
  const router = useRouter();
  const incomingUrl = Linking.useURL();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const url = incomingUrl ?? (await Linking.getInitialURL());
      const ok = await bootstrapPasswordRecoverySession(url);

      if (cancelled) return;

      if (ok) {
        router.replace(routes.resetPassword);
        return;
      }

      setError(
        'Could not read the reset link. Add your exact Expo redirect URL in Supabase (exp://…/--/auth/reset-password), then request a new email.'
      );
      setTimeout(() => router.replace(routes.forgotPassword), 4000);
    })();

    return () => {
      cancelled = true;
    };
  }, [incomingUrl, router]);

  return (
    <View style={styles.center}>
      {error ? (
        <>
          <Text style={styles.errorTitle}>Reset link issue</Text>
          <Text style={styles.errorText}>{error}</Text>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color={colors.chrome} />
          <Text style={styles.label}>Opening password reset…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 24,
  },
  label: {
    ...typography.subhead,
    color: colors.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
  errorTitle: {
    ...typography.headline,
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    ...typography.subhead,
    color: colors.destructive,
    textAlign: 'center',
    lineHeight: 22,
  },
});
