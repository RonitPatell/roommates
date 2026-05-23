import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppleButton } from '@/components/AppleButton';
import { EmptyState } from '@/components/EmptyState';
import { PremiumGate } from '@/components/PremiumGate';
import { GroupedCard } from '@/components/GroupedCard';
import { RefreshableScrollView } from '@/components/RefreshableScrollView';
import { ScreenBackground } from '@/components/ScreenBackground';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useChores } from '@/context/ChoresContext';
import { useGroup } from '@/context/GroupContext';
import { choreAppliesToUser, choreTitlesByIds } from '@/lib/chores';
import { usePullToRefresh } from '@/lib/usePullToRefresh';
import type { Chore } from '@/types';

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

export default function TradeScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const { chores, proposeTrade, respondToTrade, pendingTradesForMe } = useChores();
  const { members, getMember } = useGroup();
  const { refreshing, onRefresh } = usePullToRefresh();

  const [offeredIds, setOfferedIds] = useState<string[]>([]);
  const [requestedIds, setRequestedIds] = useState<string[]>([]);
  const [targetId, setTargetId] = useState<string | null>(null);

  const myActive = useMemo(
    () => chores.filter((c) => choreAppliesToUser(c, userId) && !c.completed),
    [chores, userId]
  );

  const othersActive = useMemo(
    () => chores.filter((c) => !choreAppliesToUser(c, userId) && !c.completed),
    [chores, userId]
  );

  const choresByUser = useMemo(() => {
    const map = new Map<string, Chore[]>();
    for (const c of othersActive) {
      if (!map.has(c.assigned_to)) map.set(c.assigned_to, []);
      map.get(c.assigned_to)!.push(c);
    }
    return map;
  }, [othersActive]);

  const requestedOptions = targetId ? choresByUser.get(targetId) ?? [] : [];

  const canSend =
    offeredIds.length > 0 && requestedIds.length > 0 && targetId != null;

  const sendLabel = useMemo(() => {
    if (!canSend) return 'Send offer';
    if (offeredIds.length === 1 && requestedIds.length === 1) return 'Send offer';
    return `Send offer (${offeredIds.length} for ${requestedIds.length})`;
  }, [canSend, offeredIds.length, requestedIds.length]);

  const handlePropose = async () => {
    if (!canSend || !targetId) {
      Alert.alert(
        'Select chores',
        'Pick at least one of your chores and at least one of theirs.'
      );
      return;
    }
    try {
      await proposeTrade(offeredIds, requestedIds, targetId);
      setOfferedIds([]);
      setRequestedIds([]);
      setTargetId(null);
      Alert.alert('Sent!', `Waiting for @${getMember(targetId)?.username} to accept.`);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not send trade');
    }
  };

  const renderChip = (
    chore: Chore,
    selected: boolean,
    onToggle: () => void,
    color: string
  ) => (
    <Pressable
      key={chore.id}
      style={[styles.chip, selected && { borderColor: color, backgroundColor: `${color}14` }]}
      onPress={() => {
        Haptics.selectionAsync();
        onToggle();
      }}
    >
      <View style={styles.chipRow}>
        <Text style={styles.chipTitle}>{chore.title}</Text>
        {selected ? (
          <View style={[styles.check, { backgroundColor: color }]}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.chipDate}>{chore.due_date}</Text>
    </Pressable>
  );

  return (
    <PremiumGate feature="swap">
    <ScreenBackground>
      <RefreshableScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: spacing.md, paddingBottom: insets.bottom + 100 },
        ]}
        refreshing={refreshing}
        onRefresh={onRefresh}
        safeAreaTop={insets.top}
      >
        <Text style={styles.title}>Trade</Text>
        <Text style={styles.subtitle}>Swap one or more chores with a roommate</Text>

        {pendingTradesForMe.length > 0 ? (
          <GroupedCard style={styles.inbox}>
            <Text style={styles.inboxLabel}>Offers for you</Text>
            {pendingTradesForMe.map((trade) => {
              const from = getMember(trade.from_user_id);
              const youGive = choreTitlesByIds(trade.requested_chore_ids, chores);
              const youGet = choreTitlesByIds(trade.offered_chore_ids, chores);
              const giveCount = trade.requested_chore_ids.length;
              const getCount = trade.offered_chore_ids.length;
              return (
                <View key={trade.id} style={styles.offer}>
                  <Text style={styles.offerFrom}>@{from?.username} wants to trade</Text>
                  <Text style={styles.offerDetail}>
                    You give ({giveCount}): {youGive}
                  </Text>
                  <Text style={styles.offerDetail}>
                    You get ({getCount}): {youGet}
                  </Text>
                  <View style={styles.offerActions}>
                    <AppleButton
                      label="Decline"
                      variant="secondary"
                      onPress={() => respondToTrade(trade.id, false)}
                    />
                    <AppleButton label="Accept" onPress={() => respondToTrade(trade.id, true)} />
                  </View>
                </View>
              );
            })}
          </GroupedCard>
        ) : null}

        <Text style={styles.step}>1 · Your chores</Text>
        <Text style={styles.stepHint}>Tap to select one or more</Text>
        {myActive.length === 0 ? (
          <Text style={styles.hint}>No active chores assigned to you</Text>
        ) : (
          myActive.map((c) =>
            renderChip(c, offeredIds.includes(c.id), () => setOfferedIds((ids) => toggleId(ids, c.id)), colors.tint)
          )
        )}

        <Text style={styles.step}>2 · Roommate</Text>
        <View style={styles.peopleRow}>
          {members
            .filter((m) => m.id !== userId && (choresByUser.get(m.id)?.length ?? 0) > 0)
            .map((m) => {
              const active = targetId === m.id;
              return (
                <Pressable
                  key={m.id}
                  style={[styles.person, active && { borderColor: m.color, backgroundColor: `${m.color}14` }]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setTargetId(m.id);
                    setRequestedIds([]);
                  }}
                >
                  <View style={[styles.avatar, { backgroundColor: `${m.color}22` }]}>
                    <Text style={{ color: m.color, fontFamily: 'Outfit_700Bold' }}>{m.initial}</Text>
                  </View>
                  <Text style={styles.personName}>@{m.username}</Text>
                </Pressable>
              );
            })}
        </View>

        {targetId ? (
          <>
            <Text style={styles.step}>3 · Their chores</Text>
            <Text style={styles.stepHint}>Tap to select one or more</Text>
            {requestedOptions.map((c) => {
              const m = getMember(c.assigned_to)!;
              return renderChip(
                c,
                requestedIds.includes(c.id),
                () => setRequestedIds((ids) => toggleId(ids, c.id)),
                m.color
              );
            })}
          </>
        ) : null}

        <AppleButton
          label={sendLabel}
          onPress={handlePropose}
          disabled={!canSend}
          style={{ marginTop: spacing.lg }}
        />

        {pendingTradesForMe.length === 0 && myActive.length > 0 ? (
          <EmptyState
            icon="swap-horizontal"
            title="Bundle trades"
            subtitle="Offer multiple chores for multiple of theirs — e.g. one of yours for two of theirs."
          />
        ) : null}
      </RefreshableScrollView>
    </ScreenBackground>
    </PremiumGate>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.lg },
  title: { ...typography.largeTitle, color: colors.text },
  subtitle: { ...typography.subhead, color: colors.textSecondary, marginBottom: spacing.lg },
  inbox: { padding: spacing.md, marginBottom: spacing.lg, gap: spacing.md },
  inboxLabel: { fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: colors.warning },
  offer: { gap: spacing.sm },
  offerFrom: { ...typography.headline, color: colors.text },
  offerDetail: { ...typography.subhead, color: colors.textSecondary },
  offerActions: { flexDirection: 'row', gap: spacing.sm },
  step: { ...typography.headline, color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs },
  stepHint: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  hint: { ...typography.subhead, color: colors.textSecondary },
  chip: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  chipRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  chipTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: colors.text, flex: 1 },
  chipDate: { fontFamily: 'Outfit_400Regular', fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { fontFamily: 'Outfit_700Bold', fontSize: 12, color: colors.background },
  peopleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  person: {
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.separator,
    minWidth: 90,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  personName: { fontFamily: 'Outfit_500Medium', fontSize: 13, color: colors.text },
});
