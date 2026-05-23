import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import type { MemberView } from '@/types';

export function MemberPicker({
  members,
  selectedId,
  onSelect,
  label,
}: {
  members: MemberView[];
  selectedId: string;
  onSelect: (id: string) => void;
  label?: string;
}) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {members.map((m) => {
          const active = m.id === selectedId;
          return (
            <Pressable
              key={m.id}
              onPress={() => {
                Haptics.selectionAsync();
                onSelect(m.id);
              }}
              style={[
                styles.chip,
                active && { borderColor: m.color, backgroundColor: `${m.color}14` },
              ]}
            >
              <View style={[styles.avatar, { backgroundColor: `${m.color}22` }]}>
                <Text style={[styles.initial, { color: m.color }]}>{m.initial}</Text>
              </View>
              <Text style={[styles.name, active && { color: m.color }]}>{m.displayName}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
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
  },
  row: { gap: spacing.sm, paddingRight: spacing.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontFamily: 'Outfit_700Bold', fontSize: 13 },
  name: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    color: colors.text,
  },
});
