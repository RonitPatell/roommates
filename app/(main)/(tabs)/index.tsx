import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { HeroRefreshBackdrop } from '@/components/HeroRefreshBackdrop';
import { HomeHero, HERO_SCROLL_BG } from '@/components/HomeHero';
import { MyChoreRow } from '@/components/MyChoreRow';
import { RefreshableScrollView } from '@/components/RefreshableScrollView';
import { ScreenBackground } from '@/components/ScreenBackground';
import { isMemberColor } from '@/constants/memberColors';
import { colors, radius, shadows, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useChores } from '@/context/ChoresContext';
import { useGroup } from '@/context/GroupContext';
import { choreCompleteLockedMessage, classifyDueBucket, isDueInRollingWeek } from '@/lib/chores';
import { memberColor } from '@/lib/supabase';
import { routes } from '@/lib/routes';
import { usePullToRefresh } from '@/lib/usePullToRefresh';
import type { Chore } from '@/types';

/** Horizontal inset for My Chores — keeps cards and hero content off the screen edges. */
const PAGE_GUTTER = spacing.xl;

function ChoreSection({
  title,
  count,
  chores,
  accentColor,
  onToggle,
  onPress,
  muted,
}: {
  title: string;
  count: number;
  chores: Chore[];
  accentColor: string;
  onToggle: (chore: Chore) => void;
  onPress: (id: string) => void;
  muted?: boolean;
}) {
  if (chores.length === 0) return null;

  const stripe = muted ? colors.textTertiary : accentColor;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, muted && styles.sectionTitleMuted]}>{title}</Text>
        <Text style={styles.sectionCount}>{count}</Text>
      </View>
      <View style={styles.sectionCard}>
        {chores.map((chore, i) => (
          <MyChoreRow
            key={chore.id}
            chore={chore}
            accentColor={stripe}
            onToggle={() => onToggle(chore)}
            onPress={() => onPress(chore.id)}
            isLast={i === chores.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

export default function MyChoresScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, session } = useAuth();
  const { activeGroup } = useGroup();
  const { myChores, toggleCompleteForChore, pendingTradesForMe, initialLoading } = useChores();
  const { refreshing, onRefresh } = usePullToRefresh();

  const accentColor = useMemo(() => {
    if (profile?.accent_color && isMemberColor(profile.accent_color)) {
      return profile.accent_color;
    }
    return memberColor(session?.user.id ?? '');
  }, [profile?.accent_color, session?.user.id]);

  const pending = useMemo(() => myChores.filter((c) => !c.completed), [myChores]);
  const done = useMemo(() => myChores.filter((c) => c.completed), [myChores]);

  const { overdue, today, thisWeek, later } = useMemo(() => {
    const o: Chore[] = [];
    const t: Chore[] = [];
    const w: Chore[] = [];
    const l: Chore[] = [];

    for (const c of pending) {
      switch (classifyDueBucket(c.due_date)) {
        case 'overdue':
          o.push(c);
          break;
        case 'today':
          t.push(c);
          break;
        case 'thisWeek':
          w.push(c);
          break;
        case 'later':
          l.push(c);
          break;
      }
    }

    return { overdue: o, today: t, thisWeek: w, later: l };
  }, [pending]);

  const todayCount = today.length;
  const weekCount = thisWeek.length;
  const doneThisWeek = done.filter((c) => isDueInRollingWeek(c.due_date)).length;
  const weekTotal = myChores.filter((c) => isDueInRollingWeek(c.due_date)).length;

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const firstName = profile?.display_name?.split(' ')[0] ?? profile?.username ?? 'there';

  const openChore = (id: string) => router.push(routes.chore(id));

  const handleToggle = useCallback(
    (chore: Chore) => {
      toggleCompleteForChore(chore).catch((e) => {
        Alert.alert('Not yet', e instanceof Error ? e.message : choreCompleteLockedMessage(chore.due_date));
      });
    },
    [toggleCompleteForChore]
  );

  const isEmpty = !initialLoading && pending.length === 0 && done.length === 0;

  return (
    <ScreenBackground>
      <HeroRefreshBackdrop safeAreaTop={insets.top} />
      <RefreshableScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        refreshing={refreshing}
        onRefresh={onRefresh}
        safeAreaTop={insets.top}
        useContentInset={false}
        showsVerticalScrollIndicator={false}
      >
        <HomeHero
          greeting={greeting}
          displayName={firstName}
          username={profile?.username}
          groupName={activeGroup?.name}
          onGroupPress={() => router.push(routes.groups)}
          onRoommatesPress={() => router.push(routes.groupMembers)}
          weekCount={weekCount}
          todayCount={todayCount}
          doneWeekCount={doneThisWeek}
          weekTotal={weekTotal}
          accentColor={accentColor}
          tradeOffers={pendingTradesForMe.length}
          onTradePress={() => router.push(routes.trade)}
          onMorePress={() => router.push(routes.more)}
          safeAreaTop={insets.top}
          pageGutter={PAGE_GUTTER}
        />

        <View style={styles.body}>
          {initialLoading && myChores.length === 0 ? (
            <ActivityIndicator style={styles.loader} color={colors.chrome} />
          ) : isEmpty ? (
            <View style={styles.emptyCard}>
              <EmptyState
                icon="sparkles"
                accentColor={accentColor}
                title="Your list is clear"
                subtitle="When chores are assigned to you, they'll show up here in order."
              />
            </View>
          ) : (
            <View style={styles.list}>
              {pending.length === 0 ? (
                <Text style={styles.allClear}>All caught up — enjoy the calm.</Text>
              ) : null}

              <ChoreSection
                title="Overdue"
                count={overdue.length}
                chores={overdue}
                accentColor={colors.destructive}
                onToggle={handleToggle}
                onPress={openChore}
              />
              <ChoreSection
                title="Today"
                count={today.length}
                chores={today}
                accentColor={accentColor}
                onToggle={handleToggle}
                onPress={openChore}
              />
              <ChoreSection
                title="This Week"
                count={thisWeek.length}
                chores={thisWeek}
                accentColor={accentColor}
                onToggle={handleToggle}
                onPress={openChore}
              />
              <ChoreSection
                title="Later"
                count={later.length}
                chores={later}
                accentColor={accentColor}
                onToggle={handleToggle}
                onPress={openChore}
                muted
              />

              {done.length > 0 ? (
                <ChoreSection
                  title={`Completed · ${format(new Date(), 'MMM d')}`}
                  count={done.length}
                  chores={done}
                  accentColor={colors.success}
                  onToggle={handleToggle}
                  onPress={openChore}
                  muted
                />
              ) : null}
            </View>
          )}
        </View>
      </RefreshableScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  scrollContent: {
    paddingHorizontal: PAGE_GUTTER,
  },
  body: {
    paddingTop: spacing.sm,
  },
  loader: {
    marginTop: spacing.xxl,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.card,
  },
  list: {
    gap: spacing.xs,
  },
  allClear: {
    ...typography.callout,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    ...typography.title3,
    color: colors.text,
    letterSpacing: -0.3,
  },
  sectionTitleMuted: {
    color: colors.textSecondary,
  },
  sectionCount: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    color: colors.textTertiary,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.card,
  },
});
