import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppleButton } from '@/components/AppleButton';
import { InputField } from '@/components/InputField';
import { KeyboardAwareForm } from '@/components/KeyboardAwareForm';
import { ScreenBackground } from '@/components/ScreenBackground';
import { APP_NAME } from '@/constants/app';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { normalizeUsername } from '@/lib/supabase';

export default function SetupUsernameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setUsername, profile, needsUsername, user } = useAuth();
  const [username, setUsernameLocal] = useState('');
  const [displayName, setDisplayName] = useState(
    profile?.display_name ??
      user?.user_metadata?.full_name ??
      user?.user_metadata?.name ??
      ''
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!needsUsername && profile) {
      router.replace('/');
    }
  }, [needsUsername, profile, router]);

  const handleSave = async () => {
    if (!username.trim()) {
      Alert.alert('Choose a username', 'Usernames are required and must be unique.');
      return;
    }
    setLoading(true);
    try {
      await setUsername(normalizeUsername(username), displayName);
      router.replace('/');
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenBackground>
      <KeyboardAwareForm
        bottomInset={insets.bottom + 32}
        contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 48 }]}
      >
        <Text style={styles.title}>Pick a username</Text>
        <Text style={styles.subtitle}>
          Others will add you to households on {APP_NAME} using this handle. It must be unique.
        </Text>
        <View style={styles.form}>
          <InputField
            label="Username"
            autoCapitalize="none"
            value={username}
            onChangeText={(t) => setUsernameLocal(normalizeUsername(t))}
            placeholder="e.g. alex_k"
          />
          <InputField label="Display name" value={displayName} onChangeText={setDisplayName} />
        </View>
        <AppleButton label="Continue" onPress={handleSave} loading={loading} />
      </KeyboardAwareForm>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.xl, gap: spacing.md, flexGrow: 1 },
  title: { ...typography.largeTitle, color: colors.text },
  subtitle: { ...typography.body, color: colors.textSecondary, lineHeight: 24 },
  form: { gap: spacing.md, marginVertical: spacing.lg },
});
