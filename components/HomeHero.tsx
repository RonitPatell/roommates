import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AnimatedIconButton } from '@/components/AnimatedIconButton';
import { RumiLogo } from '@/components/RumiLogo';
import { colors, radius, shadows, spacing, typography } from '@/constants/theme';

/** Matches scroll overscroll / refresh backdrop on My Chores. */
export const HERO_SCROLL_BG = '#141416';

const HERO_GRADIENT = ['#2A2A2E', '#1C1C1F', '#121214', HERO_SCROLL_BG] as const;

/** Top colors for the fixed pull-to-refresh backdrop. */
export const HERO_BACKDROP_COLORS = [HERO_GRADIENT[0], HERO_GRADIENT[1], HERO_GRADIENT[2]] as const;

interface HomeHeroProps {
  greeting: string;
  displayName: string;
  username?: string;
  groupName?: string;
  onGroupPress: () => void;
  onRoommatesPress?: () => void;
  weekCount: number;
  todayCount: number;
  doneWeekCount: number;
  weekTotal: number;
  accentColor?: string;
  onTradePress?: () => void;
  onMorePress?: () => void;
  tradeOffers?: number;
  /** Status-bar inset — pads hero content below the notch. */
  safeAreaTop?: number;
  /** Horizontal page gutter; hero bleeds to screen edges within a padded scroll parent. */
  pageGutter?: number;
}

export function HomeHero({
  greeting,
  displayName,
  username,
  groupName,
  onGroupPress,
  onRoommatesPress,
  weekCount,
  todayCount,
  doneWeekCount,
  weekTotal,
  accentColor = colors.chrome,
  onTradePress,
  onMorePress,
  tradeOffers = 0,
  safeAreaTop = 0,
  pageGutter = spacing.lg,
}: HomeHeroProps) {
  const weekProgress = weekTotal > 0 ? doneWeekCount / weekTotal : 0;
  const pct = Math.round(weekProgress * 100);

  return (
    <View style={[styles.outer, { marginHorizontal: -pageGutter }]}>
      <LinearGradient
        colors={[...HERO_GRADIENT]}
        locations={[0, 0.32, 0.68, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={[
          styles.gradient,
          {
            paddingTop: safeAreaTop + spacing.sm,
            paddingHorizontal: pageGutter,
          },
        ]}
      >
        <LinearGradient
          colors={[`${accentColor}28`, 'transparent', `${accentColor}06`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.topRow}>
          <RumiLogo size="xs" />
          <View style={styles.topActions}>
            {tradeOffers > 0 && onTradePress ? (
              <Pressable style={styles.tradeBtn} onPress={onTradePress}>
                <Ionicons name="swap-horizontal" size={15} color={colors.background} />
                <Text style={styles.tradeBtnText}>{tradeOffers}</Text>
              </Pressable>
            ) : null}
            {onMorePress ? (
              <AnimatedIconButton
                style={styles.moreBtn}
                onPress={onMorePress}
                accessibilityLabel="More options"
              >
                <Ionicons name="ellipsis-horizontal" size={20} color={colors.chrome} />
              </AnimatedIconButton>
            ) : null}
          </View>
        </View>

        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.name}>{displayName}</Text>
        {username ? <Text style={styles.username}>@{username}</Text> : null}

        <Pressable style={styles.groupRow} onPress={onGroupPress}>
          <Ionicons name="home-outline" size={17} color={colors.chrome} />
          <Text style={styles.groupName} numberOfLines={1}>
            {groupName ?? 'Your household'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </Pressable>

        {onRoommatesPress ? (
          <Pressable style={styles.roommatesRow} onPress={onRoommatesPress}>
            <Ionicons name="people-outline" size={17} color={colors.chrome} />
            <Text style={styles.roommatesLabel}>Manage roommates</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </Pressable>
        ) : null}

        <View style={styles.statsPanel}>
          <View style={styles.statCell}>
            <Text style={[styles.statNum, { color: accentColor }]}>{weekCount}</Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
          <View style={styles.statRule} />
          <View style={styles.statCell}>
            <Text style={[styles.statNum, styles.statToday]}>{todayCount}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={styles.statRule} />
          <View style={styles.statCell}>
            <Text style={[styles.statNum, styles.statDone]}>{doneWeekCount}</Text>
            <Text style={styles.statLabel}>Done</Text>
          </View>
        </View>

        {weekTotal > 0 ? (
          <View style={styles.progressBlock}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Week progress</Text>
              <Text style={styles.progressPct}>{pct}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={[accentColor, `${accentColor}99`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${Math.max(pct, 2)}%` }]}
              />
            </View>
            <Text style={styles.progressCaption}>
              {doneWeekCount} of {weekTotal} completed this week
            </Text>
          </View>
        ) : null}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginBottom: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderChrome,
    ...shadows.card,
  },
  gradient: {
    paddingBottom: spacing.xl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    minHeight: 96,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  moreBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderChrome,
  },
  tradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.chrome,
  },
  tradeBtnText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 13,
    color: colors.background,
  },
  greeting: {
    ...typography.subhead,
    color: colors.chromeMuted,
    textAlign: 'center',
  },
  name: {
    ...typography.largeTitle,
    color: colors.chromeBright,
    textAlign: 'center',
    marginTop: 4,
  },
  username: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    color: 'rgba(250, 250, 250, 0.4)',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: spacing.md,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderChrome,
    marginBottom: spacing.sm,
  },
  roommatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderChrome,
    marginBottom: spacing.lg,
  },
  roommatesLabel: {
    flex: 1,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    color: colors.text,
    letterSpacing: -0.2,
  },
  groupName: {
    flex: 1,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    color: colors.text,
    letterSpacing: -0.2,
  },
  statsPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  statRule: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  statNum: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 28,
    color: colors.chromeBright,
    letterSpacing: -0.5,
  },
  statToday: { color: colors.warning },
  statDone: { color: colors.success },
  statLabel: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 11,
    color: colors.chromeMuted,
    marginTop: 4,
    letterSpacing: 0.2,
  },
  progressBlock: {
    marginTop: spacing.lg,
    gap: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTitle: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
    color: colors.chromeMuted,
    letterSpacing: 0.3,
  },
  progressPct: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: colors.chrome,
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressCaption: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: colors.textTertiary,
  },
});
