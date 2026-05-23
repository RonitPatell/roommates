import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppleButton } from '@/components/AppleButton';
import { InputField } from '@/components/InputField';
import { KeyboardAwareForm } from '@/components/KeyboardAwareForm';
import { RumiLogo } from '@/components/RumiLogo';
import { ScreenBackground } from '@/components/ScreenBackground';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { routes } from '@/lib/routes';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { requestPasswordReset, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!configured || !isSupabaseConfigured) {
      Alert.alert('Not configured', 'Add your Supabase keys to .env first.');
      router.push(routes.setup);
      return;
    }

    if (!email.trim()) {
      Alert.alert('Missing email', 'Enter the email you used to sign up.');
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Please try again.';
      Alert.alert('Could not send email', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenBackground>
      <KeyboardAwareForm
        bottomInset={insets.bottom + 32}
        contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 16 }]}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <View style={styles.logoRow}>
          <RumiLogo size="md" />
        </View>
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.subtitle}>
          {sent
            ? `If an account exists for ${email.trim()}, we sent a reset link. Open it on this device to choose a new password.`
            : 'Enter your email and we\u2019ll send you a link to choose a new password in the app.'}
        </Text>
        {!sent ? (
          <>
            <View style={styles.form}>
              <InputField
                label="Email"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
                onSubmitEditing={handleSend}
              />
            </View>
            <AppleButton label="Send reset link" onPress={handleSend} loading={loading} />
          </>
        ) : (
          <AppleButton
            label="Back to sign in"
            onPress={() => router.replace('/(auth)/login')}
          />
        )}
      </KeyboardAwareForm>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.xl, gap: spacing.lg, flexGrow: 1 },
  logoRow: { alignItems: 'center', marginTop: spacing.sm },
  back: { fontFamily: 'Outfit_500Medium', fontSize: 17, color: colors.tint },
  title: { ...typography.largeTitle, color: colors.text },
  subtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  form: { gap: spacing.md },
});
