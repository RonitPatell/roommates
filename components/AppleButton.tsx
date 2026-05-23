import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';

import { colors, radius, shadows } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'destructive' | 'ghost';

export function AppleButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const isPrimary = variant === 'primary';

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        !isPrimary && styles[variant],
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {isPrimary ? (
        <LinearGradient
          colors={['#FAFAFA', '#D4D4D8', '#A1A1AA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradient, shadows.chrome]}
        >
          {loading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.primaryLabel}>{label}</Text>
          )}
        </LinearGradient>
      ) : loading ? (
        <ActivityIndicator color={variant === 'destructive' ? colors.destructive : colors.chrome} />
      ) : (
        <Text style={[styles.label, styles[`${variant}Label` as keyof typeof styles]]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  secondary: {
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.borderChrome,
  },
  destructive: {
    backgroundColor: colors.destructiveSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.25)',
  },
  ghost: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.4 },
  label: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 17,
  },
  primaryLabel: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 17,
    color: colors.background,
    letterSpacing: -0.2,
  },
  secondaryLabel: { color: colors.chrome },
  destructiveLabel: { color: colors.destructive },
  ghostLabel: { color: colors.chromeMuted },
});
