import { useFocusEffect } from 'expo-router';
import React, { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GroupedCard } from '@/components/GroupedCard';
import { PremiumGate } from '@/components/PremiumGate';
import { RefreshableScrollView } from '@/components/RefreshableScrollView';
import { ScreenBackground } from '@/components/ScreenBackground';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useGroup } from '@/context/GroupContext';
import { usePoints } from '@/context/PointsContext';
import { usePullToRefresh } from '@/lib/usePullToRefresh';

export default function ScoresScreen() {
  const insets = useSafeAreaInsets();
  const { activeGroup, members } = useGroup();
  const { scores, loading, refreshScores } = usePoints();
  const { refreshing, onRefresh } = usePullToRefresh({ nudges: false });

  useFocusEffect(
    useCallback(() => {
      refreshScores().catch(() => {});
    }, [refreshScores])
  );

  const handleRefresh = useCallback(async () => {
    await onRefresh();
    await refreshScores();
  }, [onRefresh, refreshScores]);

  const ranked = [...members]
    .map((m) => ({
      member: m,
      points: scores.find((s) => s.user_id === m.id)?.points ?? 0,
    }))
    .sort((a, b) => b.points - a.points || a.member.displayName.localeCompare(b.member.displayName));

  return (
    <PremiumGate feature="points">
    <ScreenBackground>
      <RefreshableScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 100 },
        ]}
        refreshing={refreshing || loading}
        onRefresh={handleRefresh}
        safeAreaTop={insets.top}
      >
        <Text style={styles.title}>Points</Text>
        <Text style={styles.subtitle}>
          {activeGroup?.name ?? 'Household'} — finish chores on or before the due day for +1.
          Miss the due day and lose −1.
        </Text>

        <GroupedCard style={styles.card}>
          {loading && ranked.length === 0 ? (
            <ActivityIndicator color={colors.chrome} style={styles.loader} />
          ) : (
            ranked.map(({ member, points }, i) => (
              <View
                key={member.id}
                style={[styles.row, i < ranked.length - 1 && styles.rowBorder]}
              >
                <View style={[styles.rankBadge, i === 0 && points > 0 && styles.rankFirst]}>
                  <Text style={styles.rankText}>{i + 1}</Text>
                </View>
                <View style={[styles.avatar, { backgroundColor: `${member.color}22` }]}>
                  <Text style={[styles.initial, { color: member.color }]}>{member.initial}</Text>
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.name}>{member.displayName}</Text>
                  <Text style={styles.handle}>@{member.username}</Text>
                </View>
                <Text
                  style={[
                    styles.points,
                    points > 0 && styles.pointsPositive,
                    points < 0 && styles.pointsNegative,
                  ]}
                >
                  {points > 0 ? `+${points}` : points}
                </Text>
              </View>
            ))
          )}
        </GroupedCard>

        <GroupedCard style={styles.rulesCard}>
          <Text style={styles.rulesTitle}>How it works</Text>
          <Text style={styles.rulesBody}>
            • Every chore: complete on or before the due day → +1{'\n'}• Miss the due day → −1
            {'\n'}• Fair rotation (e.g. daily dishes): a missed day also shifts the schedule —
            you stay on the hook and everyone else moves back one day
          </Text>
        </GroupedCard>
      </RefreshableScrollView>
    </ScreenBackground>
    </PremiumGate>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.lg },
  title: { ...typography.largeTitle, color: colors.text },
  subtitle: {
    ...typography.subhead,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  card: { marginBottom: spacing.md },
  loader: { paddingVertical: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankFirst: { backgroundColor: colors.tintSoft },
  rankText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 13,
    color: colors.textSecondary,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontFamily: 'Outfit_700Bold', fontSize: 18 },
  rowText: { flex: 1 },
  name: { ...typography.headline, color: colors.text },
  handle: { ...typography.footnote, color: colors.textSecondary },
  points: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 22,
    color: colors.text,
    minWidth: 40,
    textAlign: 'right',
  },
  pointsPositive: { color: colors.success },
  pointsNegative: { color: colors.destructive },
  rulesCard: { padding: spacing.md },
  rulesTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  rulesBody: {
    ...typography.subhead,
    color: colors.textSecondary,
    lineHeight: 22,
  },
});
