import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppleButton } from '@/components/AppleButton';
import { InputField } from '@/components/InputField';
import { RumiLogo } from '@/components/RumiLogo';
import { KeyboardAwareForm } from '@/components/KeyboardAwareForm';
import { ScreenBackground } from '@/components/ScreenBackground';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { normalizeUsername } from '@/lib/supabase';

export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUpWithEmail } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!email.trim() || !password || !username.trim()) {
      Alert.alert('Missing fields', 'Fill in email, username, and password.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Use at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const result = await signUpWithEmail(
        email.trim(),
        password,
        normalizeUsername(username),
        displayName.trim() || normalizeUsername(username)
      );

      if (result.status === 'confirm_email') {
        Alert.alert(
          'Check your email',
          `We sent a confirmation link to ${result.email}. Open it, then sign in.`,
          [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
        );
      } else {
        router.replace('/');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong. Try again.';
      Alert.alert('Sign up failed', message);
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
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.hint}>Your username is how roommates find you.</Text>
        <View style={styles.form}>
          <InputField label="Display name" value={displayName} onChangeText={setDisplayName} />
          <InputField
            label="Username"
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={(t) => setUsername(normalizeUsername(t))}
            placeholder="e.g. jane_doe"
          />
          <InputField
            label="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />
          <InputField
            label="Password"
            secureTextEntry
            autoComplete="password-new"
            value={password}
            onChangeText={setPassword}
          />
        </View>
        <AppleButton label="Create account" onPress={handleSignup} loading={loading} />
        <Link href="/(auth)/login" style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
        </Link>
      </KeyboardAwareForm>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.xl, gap: spacing.md, flexGrow: 1 },
  logoRow: { alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.xs },
  back: { fontFamily: 'Outfit_500Medium', fontSize: 17, color: colors.tint },
  title: { ...typography.largeTitle, color: colors.text },
  hint: { ...typography.subhead, color: colors.textSecondary },
  form: { gap: spacing.md, marginTop: spacing.sm },
  footer: { alignSelf: 'center', marginTop: spacing.md, marginBottom: spacing.lg },
  footerText: { fontFamily: 'Outfit_500Medium', fontSize: 15, color: colors.tint },
});
