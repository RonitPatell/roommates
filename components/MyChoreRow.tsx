import { format, isPast, isToday } from 'date-fns';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { CheckButton } from '@/components/CheckButton';
import { colors, spacing } from '@/constants/theme';
import {
  canMarkChoreComplete,
  choreCompleteLockedMessage,
  parseDueDate,
  recurrenceLabel,
} from '@/lib/chores';
import type { Chore } from '@/types';

interface MyChoreRowProps {
  chore: Chore;
  accentColor: string;
  onToggle: () => void;
  onPress?: () => void;
  isLast?: boolean;
}

export function MyChoreRow({
  chore,
  accentColor,
  onToggle,
  onPress,
  isLast = false,
}: MyChoreRowProps) {
  const due = parseDueDate(chore.due_date);
  const overdue = !chore.completed && isPast(due) && !isToday(due);
  const dueToday = isToday(due);

  const dueLabel = chore.completed ? 'Done' : dueToday ? 'Today' : format(due, 'EEE · MMM d');

  const dueColor = chore.completed
    ? colors.textTertiary
    : overdue
      ? colors.destructive
      : dueToday
        ? colors.warning
        : colors.textSecondary;

  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      onPress={() => {
        Haptics.selectionAsync();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.row,
        !isLast && styles.rowBorder,
        pressed && onPress && styles.rowPressed,
      ]}
    >
      <View style={[styles.accent, { backgroundColor: accentColor }]} />
      <CheckButton
        checked={chore.completed}
        onPress={onToggle}
        onLockedPress={() =>
          Alert.alert('Not yet', choreCompleteLockedMessage(chore.due_date))
        }
        accentColor={chore.completed ? colors.textTertiary : accentColor}
        completeDisabled={!canMarkChoreComplete(chore)}
      />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text
            style={[styles.title, chore.completed && styles.titleDone]}
            numberOfLines={2}
          >
            {chore.title}
          </Text>
          <Text style={[styles.due, { color: dueColor }]}>{dueLabel}</Text>
        </View>
        {(chore.notes || chore.recurrence_type !== 'once') && (
          <View style={styles.subRow}>
            {chore.notes ? (
              <Text style={styles.notes} numberOfLines={1}>
                {chore.notes}
              </Text>
            ) : (
              <View />
            )}
            {chore.recurrence_type !== 'once' ? (
              <Text style={styles.recur}>{recurrenceLabel(chore.recurrence_type)}</Text>
            ) : null}
          </View>
        )}
      </View>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: 14,
    paddingRight: spacing.md,
    paddingLeft: 4,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  rowPressed: {
    opacity: 0.72,
  },
  accent: {
    width: 2,
    alignSelf: 'stretch',
    borderRadius: 1,
    marginVertical: 2,
    opacity: 0.85,
  },
  body: {
    flex: 1,
    gap: 6,
    paddingTop: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  title: {
    flex: 1,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    color: colors.text,
    letterSpacing: -0.35,
    lineHeight: 22,
  },
  titleDone: {
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  due: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
    letterSpacing: 0.1,
    paddingTop: 3,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  notes: {
    flex: 1,
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: colors.textTertiary,
  },
  recur: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 11,
    color: colors.chromeMuted,
    letterSpacing: 0.2,
  },
});
