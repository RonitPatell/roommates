import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/constants/theme';

const STAR_COUNT = 5;

type StarFill = 'full' | 'half' | 'empty';

function starFillForValue(rating: number, index: number): StarFill {
  const star = index + 1;
  if (rating >= star) return 'full';
  if (rating >= star - 0.5) return 'half';
  return 'empty';
}

function iconForFill(fill: StarFill): keyof typeof Ionicons.glyphMap {
  if (fill === 'full') return 'star';
  if (fill === 'half') return 'star-half';
  return 'star-outline';
}

interface StarRatingDisplayProps {
  rating: number;
  size?: number;
  showValue?: boolean;
  reviewCount?: number;
}

export function StarRatingDisplay({
  rating,
  size = 20,
  showValue = true,
  reviewCount,
}: StarRatingDisplayProps) {
  const safe = Math.max(0, Math.min(5, rating));

  return (
    <View style={styles.displayRow}>
      <View style={styles.stars}>
        {Array.from({ length: STAR_COUNT }, (_, i) => {
          const fill = starFillForValue(safe, i);
          return (
            <Ionicons
              key={i}
              name={iconForFill(fill)}
              size={size}
              color={fill === 'empty' ? colors.textTertiary : colors.warning}
              style={fill === 'half' ? styles.halfStar : undefined}
            />
          );
        })}
      </View>
      {showValue ? (
        <Text style={styles.valueText}>
          {reviewCount === 0
            ? 'No reviews yet'
            : `${safe.toFixed(1)} / 5 · ${reviewCount} review${reviewCount === 1 ? '' : 's'}`}
        </Text>
      ) : null}
    </View>
  );
}

interface StarRatingPickerProps {
  value: number;
  onChange: (rating: number) => void;
  size?: number;
}

/** 5-star picker with half-star steps (0.5 – 5). Tap left/right half of each star. */
export function StarRatingPicker({ value, onChange, size = 36 }: StarRatingPickerProps) {
  const safe = Math.max(0.5, Math.min(5, value));

  return (
    <View style={styles.pickerRow}>
      {Array.from({ length: STAR_COUNT }, (_, i) => {
        const starNumber = i + 1;
        const fill = starFillForValue(safe, i);
        return (
          <View
            key={starNumber}
            style={[styles.starSlot, { width: size + 4, height: size }]}
          >
            <Ionicons
              name={iconForFill(fill)}
              size={size}
              color={fill === 'empty' ? colors.textTertiary : colors.warning}
              style={fill === 'half' ? styles.halfStar : undefined}
              pointerEvents="none"
            />
            <Pressable
              style={styles.starHalfLeft}
              onPress={() => onChange(starNumber - 0.5)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`${starNumber - 0.5} out of 5 stars`}
            />
            <Pressable
              style={styles.starHalfRight}
              onPress={() => onChange(starNumber)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`${starNumber} out of 5 stars`}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  displayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  stars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  halfStar: {
    marginRight: -2,
  },
  valueText: {
    ...typography.subhead,
    color: colors.textSecondary,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  starSlot: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  starHalfLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '50%',
  },
  starHalfRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '50%',
  },
});
