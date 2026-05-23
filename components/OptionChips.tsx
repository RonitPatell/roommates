import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';

export function OptionChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                Haptics.selectionAsync();
                onChange(opt.value);
              }}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
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
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 4,
    marginTop: spacing.sm,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.full,
    backgroundColor: colors.fill,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  chipActive: {
    backgroundColor: colors.tintSoft,
    borderColor: colors.chrome,
  },
  chipText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    color: colors.textSecondary,
  },
  chipTextActive: { color: colors.chromeBright },
});
