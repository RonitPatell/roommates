import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppleButton } from '@/components/AppleButton';
import { InputField } from '@/components/InputField';
import { KeyboardAwareForm } from '@/components/KeyboardAwareForm';
import { RumiLogo } from '@/components/RumiLogo';
import { ScreenBackground } from '@/components/ScreenBackground';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { bootstrapPasswordRecoverySession } from '@/lib/passwordRecoveryBootstrap';
import { routes } from '@/lib/routes';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { updatePassword } = useAuth();
  const incomingUrl = Linking.useURL();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [ready, setReady] = useState(false);

  const bootstrap = useCallback(async (url?: string | null) => {
    const ok = await bootstrapPasswordRecoverySession(url ?? incomingUrl);
    setReady(ok);
    setBooting(false);
    if (!ok) {
      Alert.alert(
        'Link expired',
        'This reset link is invalid, missing tokens, or has expired. Request a new link and open it on the same device where you have the app installed.',
        [{ text: 'OK', onPress: () => router.replace(routes.forgotPassword) }]
      );
    }
  }, [incomingUrl, router]);

  useEffect(() => {
    bootstrap().catch(() => setBooting(false));
  }, [bootstrap]);

  useEffect(() => {
    if (!incomingUrl) return;
    bootstrap(incomingUrl).catch(() => {});
  }, [incomingUrl, bootstrap]);

  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      bootstrap(url).catch(() => {});
    });
    return () => sub.remove();
  }, [bootstrap]);

  const handleSave = async () => {
    if (password.length < 6) {
      Alert.alert('Weak password', 'Use at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Passwords do not match', 'Enter the same password in both fields.');
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    try {
      await updatePassword(password, { signOutAfter: true });
      Alert.alert(
        'Password updated',
        'Your password has been saved. Sign in with your new password.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Please try again.';
      Alert.alert('Could not update password', message);
    } finally {
      setLoading(false);
    }
  };

  if (booting) {
    return (
      <ScreenBackground>
        <View style={styles.center}>
          <Text style={styles.bootLabel}>Verifying reset link…</Text>
        </View>
      </ScreenBackground>
    );
  }

  if (!ready) {
    return <ScreenBackground />;
  }

  return (
    <ScreenBackground>
      <KeyboardAwareForm
        bottomInset={insets.bottom + 32}
        contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.logoRow}>
          <RumiLogo size="md" />
        </View>
        <Text style={styles.title}>Choose a new password</Text>
        <Text style={styles.subtitle}>
          Enter a new password for your account. You&apos;ll sign in again afterward with the new
          password.
        </Text>
        <View style={styles.form}>
          <InputField
            label="New password"
            secureTextEntry
            autoComplete="new-password"
            value={password}
            onChangeText={setPassword}
          />
          <InputField
            label="Confirm password"
            secureTextEntry
            autoComplete="new-password"
            value={confirm}
            onChangeText={setConfirm}
            onSubmitEditing={handleSave}
          />
        </View>
        <AppleButton label="Save password" onPress={handleSave} loading={loading} />
        <Pressable onPress={() => router.replace(routes.forgotPassword)} style={styles.link}>
          <Text style={styles.linkText}>Send another reset link</Text>
        </Pressable>
      </KeyboardAwareForm>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.xl, gap: spacing.lg, flexGrow: 1 },
  logoRow: { alignItems: 'center', marginTop: spacing.sm },
  title: { ...typography.largeTitle, color: colors.text },
  subtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  form: { gap: spacing.md },
  link: { alignSelf: 'center', marginTop: spacing.sm },
  linkText: { fontFamily: 'Outfit_500Medium', fontSize: 15, color: colors.tint },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  bootLabel: { ...typography.subhead, color: colors.textSecondary },
});
