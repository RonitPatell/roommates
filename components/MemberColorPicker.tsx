import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MEMBER_COLOR_PALETTE } from '@/constants/memberColors';
import { colors, radius, spacing } from '@/constants/theme';

export function MemberColorPicker({
  selectedColor,
  takenColors,
  onSelect,
  label,
}: {
  selectedColor: string | null;
  takenColors: string[];
  onSelect: (color: string) => void;
  label?: string;
}) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Text style={styles.hint}>Each roommate picks a unique color in this group.</Text>
      <View style={styles.grid}>
        {MEMBER_COLOR_PALETTE.map((color) => {
          const taken = takenColors.includes(color) && selectedColor !== color;
          const active = selectedColor === color;
          return (
            <Pressable
              key={color}
              disabled={taken}
              onPress={() => {
                Haptics.selectionAsync();
                onSelect(color);
              }}
              style={[
                styles.swatch,
                { backgroundColor: color },
                active && styles.swatchActive,
                taken && styles.swatchTaken,
              ]}
            >
              {active ? <Text style={styles.check}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  hint: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: colors.textTertiary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchActive: {
    borderColor: colors.chromeBright,
    transform: [{ scale: 1.08 }],
  },
  swatchTaken: {
    opacity: 0.22,
  },
  check: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    color: colors.background,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
