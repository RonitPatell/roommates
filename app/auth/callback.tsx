import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/constants/theme';
import { applyOAuthRedirectUrl } from '@/lib/auth';
import { routes } from '@/lib/routes';
import { getSupabase } from '@/lib/supabase';

/**
 * Handles deep links: rumi://auth/callback#access_token=...
 * Expo Router opens this screen when OAuth redirects back to the app.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const incomingUrl = Linking.useURL();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const url = incomingUrl ?? (await Linking.getInitialURL());
        if (!url) {
          if (!cancelled) router.replace('/');
          return;
        }

        const isOAuthReturn =
          url.includes('access_token') ||
          url.includes('code=') ||
          url.includes('error=');

        if (isOAuthReturn) {
          await applyOAuthRedirectUrl(url);
        }

        const { data } = await getSupabase().auth.getSession();
        if (isOAuthReturn && !data.session) {
          throw new Error('Sign-in finished but no session was saved. Check Supabase redirect URLs.');
        }

        if (!cancelled) router.replace('/');
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Sign-in failed');
          setTimeout(() => router.replace(routes.welcome), 2500);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [incomingUrl, router]);

  return (
    <View style={styles.center}>
      {error ? (
        <>
          <Text style={styles.errorTitle}>Sign-in issue</Text>
          <Text style={styles.errorText}>{error}</Text>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color={colors.chrome} />
          <Text style={styles.label}>Finishing sign-in…</Text>
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
  },
  errorTitle: {
    ...typography.headline,
    color: colors.text,
    marginBottom: 8,
  },
  errorText: {
    ...typography.subhead,
    color: colors.destructive,
    textAlign: 'center',
  },
});
