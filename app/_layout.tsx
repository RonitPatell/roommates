import '@/lib/polyfills';

import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  useFonts,
} from '@expo-google-fonts/outfit';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { colors } from '@/constants/theme';
import { AuthProvider } from '@/context/AuthContext';
import { ChoresProvider } from '@/context/ChoresContext';
import { GroupProvider } from '@/context/GroupContext';
import { LockInProvider } from '@/context/LockInContext';
import { PointsProvider } from '@/context/PointsContext';
import { SubscriptionProvider } from '@/context/SubscriptionContext';

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  useEffect(() => {
    SplashScreen.preventAutoHideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    if (!fontsLoaded && !fontError) return;

    SplashScreen.hideAsync()
      .catch(() => {})
      .finally(() => setAppReady(true));
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    const failSafe = setTimeout(() => setAppReady(true), 8000);
    return () => clearTimeout(failSafe);
  }, []);

  if (!appReady) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.chrome} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <AuthProvider>
        <GroupProvider>
          <PointsProvider>
            <ChoresProvider>
              <SubscriptionProvider>
              <LockInProvider>
              <StatusBar style="light" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: '#09090B' },
                  animation: 'slide_from_right',
                  animationDuration: 280,
                }}
              >
                <Stack.Screen name="index" options={{ animation: 'none' }} />
                <Stack.Screen name="auth/callback" options={{ animation: 'none' }} />
                <Stack.Screen name="auth/reset-password" options={{ animation: 'none' }} />
                <Stack.Screen name="setup" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="groups" />
                <Stack.Screen name="(main)" />
              </Stack>
              </LockInProvider>
              </SubscriptionProvider>
            </ChoresProvider>
          </PointsProvider>
        </GroupProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
