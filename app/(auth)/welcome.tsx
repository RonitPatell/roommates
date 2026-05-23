import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppleButton } from '@/components/AppleButton';
import { RumiLogo } from '@/components/RumiLogo';
import { APP_NAME } from '@/constants/app';
import { ScreenBackground } from '@/components/ScreenBackground';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Try again';
      Alert.alert('Sign in failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenBackground>
      <View
        style={[
          styles.wrap,
          { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 },
        ]}
      >
        <View style={styles.hero}>
          <RumiLogo size="xl" />
          <Text style={styles.title}>{APP_NAME}</Text>
          <Text style={styles.tagline}>Chores, shared fairly</Text>
          <Text style={styles.subtitle}>
            Your shared home for chores — split tasks fairly, stay in sync.
          </Text>
        </View>

        <View style={styles.actions}>
          <AppleButton label="Continue with Google" onPress={handleGoogle} loading={loading} />
          <AppleButton
            label="Create account"
            onPress={() => router.push('/(auth)/signup')}
            variant="secondary"
          />
          <AppleButton
            label="Sign in with email"
            onPress={() => router.push('/(auth)/login')}
            variant="ghost"
          />
        </View>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    ...typography.largeTitle,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  tagline: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 15,
    color: colors.chromeMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 26,
    textAlign: 'center',
    maxWidth: 300,
  },
  actions: { gap: spacing.sm },
});
