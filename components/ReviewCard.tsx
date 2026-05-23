import { format, parseISO } from 'date-fns';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { StarRatingDisplay } from '@/components/StarRating';
import { colors, radius, spacing, typography } from '@/constants/theme';
import type { RoommateReview } from '@/types';

interface ReviewCardProps {
  review: RoommateReview;
}

export function ReviewCard({ review }: ReviewCardProps) {
  const reviewerName = review.reviewer_display_name || review.reviewer_username;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.reviewer}>
          <View style={styles.avatar}>
            <Text style={styles.initial}>{reviewerName.charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.name}>{reviewerName}</Text>
            <Text style={styles.handle}>@{review.reviewer_username}</Text>
          </View>
        </View>
        <StarRatingDisplay rating={review.rating} size={14} showValue={false} />
      </View>
      <Text style={styles.body}>{review.body}</Text>
      <Text style={styles.date}>{format(parseISO(review.created_at), 'MMM d, yyyy')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.fill,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  reviewer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.fillSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 15,
    color: colors.chrome,
  },
  name: { ...typography.headline, color: colors.text, fontSize: 15 },
  handle: { ...typography.footnote, color: colors.textSecondary },
  body: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },
  date: {
    ...typography.footnote,
    color: colors.textTertiary,
  },
});
