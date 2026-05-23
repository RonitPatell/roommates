import { Ionicons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GroupedCard } from '@/components/GroupedCard';
import { ScreenBackground } from '@/components/ScreenBackground';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useGroup } from '@/context/GroupContext';
import { useLockIn } from '@/context/LockInContext';
import { usePoints } from '@/context/PointsContext';
import { CustomerCenterButton } from '@/components/CustomerCenterButton';
import { useSubscription } from '@/context/SubscriptionContext';
import { APP_PRO_NAME } from '@/constants/app';
import { routes } from '@/lib/routes';

type MenuItem = {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: Href;
  badge?: number;
  accent?: string;
};

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeGroup } = useGroup();
  const { unreadCount } = useLockIn();
  const { scores } = usePoints();
  const { isPro } = useSubscription();

  const topScore = [...scores].sort((a, b) => b.points - a.points)[0]?.points;

  const items: MenuItem[] = [
    {
      key: 'pro',
      title: isPro ? APP_PRO_NAME : 'Upgrade to Pro',
      subtitle: isPro
        ? 'Your household has full access'
        : 'Unlock swaps, points, nudges & fair rotation',
      icon: isPro ? 'sparkles' : 'star-outline',
      href: routes.upgrade,
      accent: colors.chrome,
    },
    {
      key: 'points',
      title: 'Points',
      subtitle:
        topScore !== undefined
          ? `Household leaderboard · high score ${topScore > 0 ? `+${topScore}` : topScore}`
          : 'On-time chores earn +1 · missed cost −1',
      icon: 'trophy-outline',
      href: routes.scores,
      accent: colors.success,
    },
    {
      key: 'nudge',
      title: 'Nudge',
      subtitle: 'Send a quick reminder to a roommate',
      icon: 'flash-outline',
      href: routes.nudge,
      badge: unreadCount > 0 ? unreadCount : undefined,
      accent: colors.warning,
    },
  ];

  return (
    <ScreenBackground>
      <View
        style={[
          styles.wrap,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 100 },
        ]}
      >
        <Text style={styles.title}>More</Text>
        <Text style={styles.subtitle}>{activeGroup?.name ?? 'Your household'}</Text>

        <GroupedCard style={styles.card}>
          {items.map((item, i) => (
            <Pressable
              key={item.key}
              style={[styles.row, i < items.length - 1 && styles.rowBorder]}
              onPress={() => router.push(item.href)}
            >
              <View style={[styles.iconWrap, { backgroundColor: `${item.accent}18` }]}>
                <Ionicons name={item.icon} size={22} color={item.accent ?? colors.chrome} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowSub} numberOfLines={2}>
                  {item.subtitle}
                </Text>
              </View>
              {item.badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </Pressable>
          ))}
        </GroupedCard>

        {isPro ? (
          <View style={styles.customerCenter}>
            <CustomerCenterButton />
          </View>
        ) : null}
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: spacing.lg },
  title: { ...typography.largeTitle, color: colors.text },
  subtitle: {
    ...typography.subhead,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  card: { overflow: 'hidden' },
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
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { ...typography.headline, color: colors.text },
  rowSub: {
    ...typography.footnote,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.destructive,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
    color: colors.background,
  },
  customerCenter: { marginTop: spacing.md },
});
