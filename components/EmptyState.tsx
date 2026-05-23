import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';

export function EmptyState({
  title,
  subtitle,
  icon = 'sparkles',
  accentColor = colors.chrome,
}: {
  title: string;
  subtitle: string;
  icon?: keyof typeof Ionicons.glyphMap;
  accentColor?: string;
}) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconRing, { borderColor: `${accentColor}40` }]}>
        <LinearGradient
          colors={[`${accentColor}22`, `${accentColor}08`]}
          style={styles.iconGradient}
        >
          <Ionicons name={icon} size={32} color={accentColor} />
        </LinearGradient>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    borderWidth: 1,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  iconGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.title3,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.subhead,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
});
