import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoreCard } from '@/components/ChoreCard';
import { GroupedCard } from '@/components/GroupedCard';
import { MemberColorPicker } from '@/components/MemberColorPicker';
import { RefreshableScrollView } from '@/components/RefreshableScrollView';
import { ScreenBackground } from '@/components/ScreenBackground';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useChores } from '@/context/ChoresContext';
import { useGroup } from '@/context/GroupContext';
import {
  canMarkChoreComplete,
  choreCompleteLockedMessage,
  expandChoresForCalendar,
  formatAssigneeSummary,
  resolveChoreForToggle,
} from '@/lib/chores';
import { routes } from '@/lib/routes';
import { usePullToRefresh } from '@/lib/usePullToRefresh';
import type { Chore } from '@/types';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { chores, toggleCompleteForChore, rotationLagBySeries } = useChores();
  const { profile, setAccentColor } = useAuth();
  const { members, getMember, refreshMembers } = useGroup();
  const { refreshing, onRefresh } = usePullToRefresh();
  const [month, setMonth] = useState(new Date());
  const [selected, setSelected] = useState(new Date());
  const [savingColor, setSavingColor] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const myColor = useMemo(() => {
    const me = members.find((m) => m.id === profile?.id);
    return me?.color ?? profile?.accent_color ?? null;
  }, [members, profile?.id, profile?.accent_color]);

  const takenColors = useMemo(
    () => members.filter((m) => m.id !== profile?.id).map((m) => m.color),
    [members, profile?.id]
  );

  const handleSaveColor = useCallback(
    async (color: string) => {
      if (takenColors.includes(color)) {
        Alert.alert('Color taken', 'Another roommate already uses that color.');
        return;
      }
      setSavingColor(true);
      try {
        await setAccentColor(color);
        await refreshMembers();
      } catch (e) {
        Alert.alert('Could not save color', e instanceof Error ? e.message : 'Try again');
      } finally {
        setSavingColor(false);
      }
    },
    [takenColors, setAccentColor, refreshMembers]
  );

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start, end });
  }, [month]);

  const rangeStart = calendarDays[0];
  const rangeEnd = calendarDays[calendarDays.length - 1];

  const choresByDate = useMemo(
    () => expandChoresForCalendar(chores, rangeStart, rangeEnd, rotationLagBySeries),
    [chores, rangeStart, rangeEnd, rotationLagBySeries]
  );

  const selectedKey = format(selected, 'yyyy-MM-dd');
  const dayChores = choresByDate.get(selectedKey) ?? [];

  const dotsForDay = (day: Date) => {
    const list = choresByDate.get(format(day, 'yyyy-MM-dd')) ?? [];
    const colorsSet = new Set<string>();
    for (const c of list) {
      const m = getMember(c.assigned_to);
      if (m) colorsSet.add(m.color);
    }
    return [...colorsSet].slice(0, 4);
  };

  const handleToggle = (chore: Chore) => {
    const ref = resolveChoreForToggle(chore, chores) ?? chore;
    if (!canMarkChoreComplete(ref)) {
      Alert.alert('Not yet', choreCompleteLockedMessage(ref.due_date));
      return;
    }
    toggleCompleteForChore(chore).catch((e) => {
      Alert.alert(
        'Not yet',
        e instanceof Error ? e.message : choreCompleteLockedMessage(ref.due_date)
      );
    });
  };

  return (
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
        <Text style={styles.title}>Calendar</Text>
        <Text style={styles.subtitle}>Everyone&apos;s chores — recurring tasks show on each day</Text>

        <GroupedCard style={styles.calendarCard}>
          <View style={styles.monthNav}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setMonth((m) => subMonths(m, 1));
              }}
            >
              <Text style={styles.navBtn}>‹</Text>
            </Pressable>
            <Text style={styles.monthLabel}>{format(month, 'MMMM yyyy')}</Text>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setMonth((m) => addMonths(m, 1));
              }}
            >
              <Text style={styles.navBtn}>›</Text>
            </Pressable>
          </View>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((d, i) => (
              <Text key={`${d}-${i}`} style={styles.weekday}>
                {d}
              </Text>
            ))}
          </View>
          <View style={styles.grid}>
            {calendarDays.map((day) => {
              const inMonth = isSameMonth(day, month);
              const isSelected = isSameDay(day, selected);
              const isToday = isSameDay(day, new Date());
              const dots = dotsForDay(day);
              return (
                <Pressable
                  key={day.toISOString()}
                  style={[
                    styles.day,
                    isSelected && styles.daySelected,
                    isToday && !isSelected && styles.dayToday,
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelected(day);
                    if (!isSameMonth(day, month)) setMonth(day);
                  }}
                >
                  <Text
                    style={[
                      styles.dayNum,
                      !inMonth && styles.dayMuted,
                      isSelected && styles.dayNumSelected,
                    ]}
                  >
                    {format(day, 'd')}
                  </Text>
                  <View style={styles.dots}>
                    {dots.map((c) => (
                      <View key={c} style={[styles.dot, { backgroundColor: c }]} />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </GroupedCard>

        <GroupedCard style={styles.legendCard}>
          <Text style={styles.legendTitle}>Color key</Text>
          <View style={styles.legend}>
            {members.map((m) => {
              const isMe = m.id === profile?.id;
              return (
                <Pressable
                  key={m.id}
                  style={styles.legendItem}
                  disabled={!isMe}
                  onPress={() => {
                    if (!isMe) return;
                    Haptics.selectionAsync();
                    setColorPickerOpen((open) => !open);
                  }}
                >
                  <View style={[styles.legendDot, { backgroundColor: m.color }]} />
                  <Text style={styles.legendText}>
                    {m.displayName}
                    {isMe ? ' · you' : ''}
                  </Text>
                  {isMe ? (
                    <Text style={styles.legendEdit}>{colorPickerOpen ? '▲' : '▼'}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          {colorPickerOpen ? (
            <View style={styles.colorPicker}>
              <MemberColorPicker
                selectedColor={myColor}
                takenColors={takenColors}
                onSelect={handleSaveColor}
              />
              {savingColor ? <Text style={styles.savingColor}>Saving…</Text> : null}
            </View>
          ) : null}
        </GroupedCard>

        <Text style={styles.dayTitle}>{format(selected, 'EEEE, MMM d')}</Text>
        {dayChores.length === 0 ? (
          <Text style={styles.empty}>No chores this day</Text>
        ) : (
          dayChores.map((chore, i) => (
            <ChoreCard
              key={chore.id}
              chore={chore}
              member={getMember(chore.assigned_to)}
              assigneeSummary={formatAssigneeSummary(chore, getMember)}
              onToggle={() => handleToggle(chore)}
              onPress={() => {
                const real = resolveChoreForToggle(chore, chores);
                if (real) router.push(routes.chore(real.id));
              }}
              index={i}
            />
          ))
        )}
      </RefreshableScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.lg },
  title: { ...typography.largeTitle, color: colors.text },
  subtitle: { ...typography.subhead, color: colors.textSecondary, marginBottom: spacing.lg },
  calendarCard: { padding: spacing.md, marginBottom: spacing.md },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  navBtn: { fontSize: 28, color: colors.chrome, paddingHorizontal: 8, fontFamily: 'Outfit_400Regular' },
  monthLabel: { ...typography.headline, color: colors.text },
  weekRow: { flexDirection: 'row', marginBottom: 8 },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: colors.textTertiary,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  day: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  daySelected: { backgroundColor: colors.chrome },
  dayToday: { borderWidth: 1.5, borderColor: colors.borderChrome },
  dayNum: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: colors.text },
  dayMuted: { color: colors.textTertiary },
  dayNumSelected: { color: colors.background },
  dots: { flexDirection: 'row', gap: 3, marginTop: 4, minHeight: 5 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  legendCard: { padding: spacing.md, marginBottom: spacing.lg },
  legendTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { ...typography.footnote, color: colors.textSecondary },
  legendEdit: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 10,
    color: colors.chromeMuted,
    marginLeft: 2,
  },
  colorPicker: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  savingColor: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  dayTitle: { ...typography.title3, color: colors.text, marginBottom: spacing.md },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: 'center', paddingVertical: 24 },
});
