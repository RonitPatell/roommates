import { formatDistanceToNow, parseISO } from 'date-fns';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GroupedCard } from '@/components/GroupedCard';
import { colors, radius, spacing, typography } from '@/constants/theme';
import type { LockInMessage } from '@/types';

export function NudgeMessageCard({
  message,
  onPress,
}: {
  message: LockInMessage;
  onPress?: () => void;
}) {
  const unread = !message.read_at;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
    >
      <GroupedCard style={unread ? [styles.card, styles.cardUnread] : styles.card}>
        <View style={styles.header}>
          <View style={styles.badgeRow}>
            <Text style={styles.anonLabel}>Anonymous</Text>
            {unread ? <View style={styles.dot} /> : null}
          </View>
          <Text style={styles.time}>
            {formatDistanceToNow(parseISO(message.created_at), { addSuffix: true })}
          </Text>
        </View>
        <Text style={styles.body}>{message.body}</Text>
        {unread ? <Text style={styles.hint}>Tap to mark as read</Text> : null}
      </GroupedCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardUnread: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  anonLabel: {
    ...typography.caption,
    color: colors.chromeMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.warning,
  },
  time: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  body: {
    ...typography.body,
    color: colors.text,
    lineHeight: 24,
  },
  hint: {
    ...typography.footnote,
    color: colors.textTertiary,
    marginTop: 4,
  },
});
