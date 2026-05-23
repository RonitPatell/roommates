import { format, isPast, isToday } from 'date-fns';
import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { CheckButton } from '@/components/CheckButton';
import { colors, radius, spacing } from '@/constants/theme';
import {
  canMarkChoreComplete,
  choreCompleteLockedMessage,
  parseDueDate,
  recurrenceLabel,
} from '@/lib/chores';
import type { Chore } from '@/types';
import type { MemberView } from '@/types';

interface ChoreCardProps {
  chore: Chore;
  member?: MemberView;
  assigneeSummary?: string;
  onToggle: () => void;
  onPress?: () => void;
  index?: number;
  showAssignee?: boolean;
  /** Left accent stripe (e.g. user's color on My Chores). */
  stripeColor?: string;
  /** Tighter layout inside grouped lists. */
  compact?: boolean;
  /** Last row in a grouped list (no bottom separator). */
  isLastInGroup?: boolean;
  /** Flat list row — no card chrome or pill badges. */
  flat?: boolean;
}

export function ChoreCard({
  chore,
  member,
  assigneeSummary,
  onToggle,
  onPress,
  index = 0,
  showAssignee = true,
  stripeColor,
  compact = false,
  isLastInGroup = false,
  flat = false,
}: ChoreCardProps) {
  const due = parseDueDate(chore.due_date);
  const overdue = !chore.completed && isPast(due) && !isToday(due);
  const dueToday = isToday(due);
  const accent = member?.color ?? colors.tint;

  const dueLabel = dueToday ? 'Today' : format(due, 'EEE, MMM d');

  const metaColor = overdue
    ? colors.destructive
    : dueToday && !chore.completed
      ? colors.warning
      : colors.textTertiary;

  const metaText = chore.completed
    ? 'Done'
    : `${dueLabel}${chore.recurrence_type !== 'once' ? ` · ${recurrenceLabel(chore.recurrence_type)}` : ''}`;

  const cardStyle = (pressed: boolean) => [
    flat ? styles.rowFlat : styles.card,
    compact && !flat && styles.cardCompact,
    compact && !flat && isLastInGroup && styles.cardCompactLast,
    flat && !isLastInGroup && styles.rowFlatBorder,
    !flat && stripeColor ? { borderLeftColor: stripeColor, borderLeftWidth: 3 } : null,
    pressed && onPress ? (flat ? styles.rowFlatPressed : styles.pressed) : null,
  ];

  const body = (
    <>
      <CheckButton
        checked={chore.completed}
        onPress={onToggle}
        onLockedPress={() =>
          Alert.alert('Not yet', choreCompleteLockedMessage(chore.due_date))
        }
        accentColor={accent}
        completeDisabled={!canMarkChoreComplete(chore)}
      />
      <View style={styles.content}>
        <Text style={[styles.title, chore.completed && styles.titleDone]} numberOfLines={2}>
          {chore.title}
        </Text>
        {chore.notes ? (
          <Text style={styles.notes} numberOfLines={1}>
            {chore.notes}
          </Text>
        ) : null}
        <View style={styles.meta}>
          {flat ? (
            <Text style={[styles.metaFlat, { color: metaColor }]}>{metaText}</Text>
          ) : (
            <>
              <View
                style={[
                  styles.pill,
                  overdue && styles.pillOverdue,
                  dueToday && !chore.completed && styles.pillToday,
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    overdue && styles.pillTextOverdue,
                    dueToday && !chore.completed && styles.pillTextToday,
                  ]}
                >
                  {chore.completed ? 'Done' : dueLabel}
                </Text>
              </View>
              {chore.recurrence_type !== 'once' ? (
                <View style={styles.recurPill}>
                  <Text style={styles.recurText}>{recurrenceLabel(chore.recurrence_type)}</Text>
                </View>
              ) : null}
            </>
          )}
          {showAssignee && (assigneeSummary || member) ? (
            <View style={styles.assignee}>
              {member ? (
                <View style={[styles.avatar, { backgroundColor: `${member.color}22` }]}>
                  <Text style={[styles.avatarText, { color: member.color }]}>{member.initial}</Text>
                </View>
              ) : null}
              <Text style={styles.assigneeName} numberOfLines={1}>
                {assigneeSummary ?? `@${member?.username}`}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </>
  );

  const card = onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => cardStyle(pressed)}>
      {body}
    </Pressable>
  ) : (
    <View style={cardStyle(false)}>{body}</View>
  );

  if (flat) {
    return card;
  }

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify().damping(20)}>
      {card}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 1,
  },
  cardCompact: {
    marginBottom: 0,
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
    backgroundColor: 'transparent',
  },
  cardCompactLast: {
    borderBottomWidth: 0,
  },
  pressed: { backgroundColor: colors.fill },
  rowFlat: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: 'transparent',
  },
  rowFlatBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  rowFlatPressed: { opacity: 0.65 },
  metaFlat: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    flex: 1,
  },
  content: { flex: 1, gap: 4 },
  title: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 17,
    color: colors.text,
    letterSpacing: -0.4,
  },
  titleDone: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
  notes: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 15,
    color: colors.textSecondary,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  recurPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.tintSoft,
  },
  recurText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 11,
    color: colors.chromeMuted,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.fill,
  },
  pillToday: { backgroundColor: colors.warningSoft },
  pillOverdue: { backgroundColor: colors.destructiveSoft },
  pillText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  pillTextToday: { color: colors.warning },
  pillTextOverdue: { color: colors.destructive },
  assignee: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: 'Outfit_700Bold', fontSize: 12 },
  assigneeName: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
});
