import { Link, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppleButton } from '@/components/AppleButton';
import { InputField } from '@/components/InputField';
import { RumiLogo } from '@/components/RumiLogo';
import { KeyboardAwareForm } from '@/components/KeyboardAwareForm';
import { ScreenBackground } from '@/components/ScreenBackground';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import { routes } from '@/lib/routes';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signInWithEmail, session, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) {
      router.replace('/');
    }
  }, [session, router]);

  const handleLogin = async () => {
    if (!configured || !isSupabaseConfigured) {
      Alert.alert('Not configured', 'Add your Supabase keys to .env first.');
      router.push(routes.setup);
      return;
    }

    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Enter your email and password.');
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
      router.replace('/');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Please try again.';
      Alert.alert('Sign in failed', message);
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
        <Text style={styles.title}>Sign in</Text>
        <View style={styles.form}>
          <InputField
            label="Email"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={handleLogin}
          />
          <InputField
            label="Password"
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleLogin}
          />
          <Pressable
            onPress={() => router.push(routes.forgotPassword)}
            style={styles.forgotRow}
            hitSlop={8}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>
        </View>
        <AppleButton label="Sign in" onPress={handleLogin} loading={loading} />
        <Link href="/(auth)/signup" style={styles.footer}>
          <Text style={styles.footerText}>No account? Create one</Text>
        </Link>
      </KeyboardAwareForm>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.xl, gap: spacing.lg, flexGrow: 1 },
  logoRow: { alignItems: 'center', marginTop: spacing.sm },
  back: { fontFamily: 'Outfit_500Medium', fontSize: 17, color: colors.tint },
  title: { ...typography.largeTitle, color: colors.text },
  form: { gap: spacing.md },
  forgotRow: { alignSelf: 'flex-end', marginTop: -4 },
  forgotText: { fontFamily: 'Outfit_500Medium', fontSize: 14, color: colors.tint },
  footer: { alignSelf: 'center', marginTop: spacing.md, marginBottom: spacing.lg },
  footerText: { fontFamily: 'Outfit_500Medium', fontSize: 15, color: colors.tint },
});
