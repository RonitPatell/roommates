import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppleButton } from '@/components/AppleButton';
import { GroupedCard } from '@/components/GroupedCard';
import { MultiMemberPicker } from '@/components/MultiMemberPicker';
import { OptionChips } from '@/components/OptionChips';
import { RefreshableScrollView } from '@/components/RefreshableScrollView';
import { ScreenBackground } from '@/components/ScreenBackground';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useChores } from '@/context/ChoresContext';
import { useGroup } from '@/context/GroupContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { PREMIUM_FEATURE_COPY } from '@/constants/subscription';
import { routes } from '@/lib/routes';
import {
  RECURRENCE_OPTIONS,
  defaultRotationPeriod,
  formatAssigneeSummary,
  recurrenceLabel,
} from '@/lib/chores';
import { usePullToRefresh } from '@/lib/usePullToRefresh';
import type { RecurrenceType, RotationMode, RotationPeriod } from '@/types';

function formatDateInput(d: Date) {
  return d.toISOString().split('T')[0];
}

export default function ManageScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const { members, getMember, activeGroup } = useGroup();
  const { chores, addChore, removeChore } = useChores();
  const { canUse } = useSubscription();
  const { refreshing, onRefresh } = usePullToRefresh();

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState(formatDateInput(new Date()));
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('once');
  const [rotationMode, setRotationMode] = useState<RotationMode>('none');
  const [rotationPeriod, setRotationPeriod] = useState<RotationPeriod>('day');
  const [showList, setShowList] = useState(false);
  const [saving, setSaving] = useState(false);
  const prevGroupId = useRef<string | null>(null);

  useEffect(() => {
    if (members.length === 0) return;

    const groupChanged =
      activeGroup?.id != null && prevGroupId.current !== activeGroup.id;
    if (activeGroup?.id) prevGroupId.current = activeGroup.id;

    setAssigneeIds((prev) => {
      const valid = prev.filter((id) => members.some((m) => m.id === id));
      if (valid.length > 0) return valid;
      if (!groupChanged) return [];
      const self = session?.user.id;
      if (self && members.some((m) => m.id === self)) return [self];
      return [members[0].id];
    });
  }, [activeGroup?.id, members, session?.user.id]);

  const showRotation = assigneeIds.length > 1 && recurrenceType !== 'once';

  const rotationPeriodOptions = useMemo(() => {
    if (recurrenceType === 'daily') {
      return [{ value: 'day' as const, label: 'Rotate each day' }];
    }
    return [{ value: 'week' as const, label: 'Rotate each week' }];
  }, [recurrenceType]);

  useEffect(() => {
    if (showRotation && rotationMode === 'random') {
      setRotationPeriod(defaultRotationPeriod(recurrenceType));
    }
  }, [recurrenceType, showRotation, rotationMode]);

  const shiftDate = (days: number) => {
    const d = new Date(dueDate);
    d.setDate(d.getDate() + days);
    setDueDate(formatDateInput(d));
    Haptics.selectionAsync();
  };

  const promptUpgrade = (feature: 'fair_rotation' | 'unlimited_chores') => {
    const copy = PREMIUM_FEATURE_COPY[feature];
    Alert.alert(copy.title, copy.description, [
      { text: 'Not now', style: 'cancel' },
      { text: 'Upgrade', onPress: () => router.push(routes.upgrade) },
    ]);
  };

  const handleAdd = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      Alert.alert('Title required', 'Give your chore a name.');
      return;
    }
    if (assigneeIds.length === 0) {
      Alert.alert('Assign someone', 'Select at least one roommate.');
      return;
    }
    if (!canUse('unlimited_chores')) {
      promptUpgrade('unlimited_chores');
      return;
    }
    if (showRotation && rotationMode === 'random' && !canUse('fair_rotation')) {
      promptUpgrade('fair_rotation');
      return;
    }

    setSaving(true);
    try {
      await addChore({
        title: trimmed,
        notes: notes.trim() || undefined,
        assigneeIds,
        dueDate,
        recurrenceType,
        rotationMode: showRotation ? rotationMode : 'none',
        rotationPeriod:
          showRotation && rotationMode === 'random' ? rotationPeriod : null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTitle('');
      setNotes('');
    } catch (e) {
      Alert.alert('Could not add chore', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <RefreshableScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: spacing.md, paddingBottom: insets.bottom + 100 },
          ]}
          keyboardShouldPersistTaps="handled"
          refreshing={refreshing}
          onRefresh={onRefresh}
          safeAreaTop={insets.top}
        >
          <Text style={styles.title}>Manage</Text>
          <Text style={styles.subtitle}>Add or remove household chores</Text>

          <GroupedCard style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="What needs doing?"
              placeholderTextColor={colors.textTertiary}
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={[styles.input, styles.notes]}
              placeholder="Notes (optional)"
              placeholderTextColor={colors.textTertiary}
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            <MultiMemberPicker
              label="Assign to"
              members={members}
              selectedIds={assigneeIds}
              onChange={setAssigneeIds}
            />

            <OptionChips
              label="Schedule"
              options={RECURRENCE_OPTIONS}
              value={recurrenceType}
              onChange={setRecurrenceType}
            />

            {showRotation ? (
              <>
                <OptionChips
                  label="Multiple people"
                  options={[
                    { value: 'none' as const, label: 'Everyone each time' },
                    { value: 'random' as const, label: 'Take turns' },
                  ]}
                  value={rotationMode}
                  onChange={(value) => {
                    if (value === 'random' && !canUse('fair_rotation')) {
                      promptUpgrade('fair_rotation');
                      return;
                    }
                    setRotationMode(value);
                  }}
                />
                {rotationMode === 'random' ? (
                  <>
                    <OptionChips
                      label="Rotation"
                      options={rotationPeriodOptions}
                      value={rotationPeriod}
                      onChange={setRotationPeriod}
                    />
                    <Text style={styles.rotateHint}>
                      Each day or week goes to the next person in line — no back-to-back repeats.
                    </Text>
                  </>
                ) : null}
              </>
            ) : null}

            <Text style={styles.label}>First due date</Text>
            <View style={styles.dateRow}>
              <Pressable onPress={() => shiftDate(-1)} style={styles.dateBtn}>
                <Ionicons name="chevron-back" size={20} color={colors.tint} />
              </Pressable>
              <Text style={styles.dateValue}>{dueDate}</Text>
              <Pressable onPress={() => shiftDate(1)} style={styles.dateBtn}>
                <Ionicons name="chevron-forward" size={20} color={colors.tint} />
              </Pressable>
            </View>
            <View style={styles.quickRow}>
              {[
                { label: 'Today', days: 0 },
                { label: 'Tomorrow', days: 1 },
                { label: '+1 week', days: 7 },
              ].map(({ label, days }) => {
                const d = new Date();
                d.setDate(d.getDate() + days);
                const val = formatDateInput(d);
                const active = dueDate === val;
                return (
                  <Pressable
                    key={label}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => {
                      setDueDate(val);
                      Haptics.selectionAsync();
                    }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <AppleButton label="Add chore" onPress={handleAdd} loading={saving} style={{ marginTop: 8 }} />
          </GroupedCard>

          <Pressable onPress={() => setShowList(!showList)} style={styles.toggle}>
            <Text style={styles.toggleText}>
              {showList ? 'Hide' : 'Show'} all chores ({chores.length})
            </Text>
          </Pressable>

          {showList
            ? chores.map((chore) => {
                const assigneeText = formatAssigneeSummary(chore, getMember);
                const recur =
                  chore.recurrence_type !== 'once'
                    ? recurrenceLabel(chore.recurrence_type)
                    : null;
                return (
                  <View key={chore.id} style={styles.listRow}>
                    <Pressable
                      style={styles.listMain}
                      onPress={() => router.push(routes.chore(chore.id))}
                    >
                      <Text style={[styles.listTitle, chore.completed && styles.done]}>
                        {chore.title}
                      </Text>
                      <Text style={styles.listMeta}>
                        {assigneeText} · {chore.due_date}
                        {recur ? ` · ${recur}` : ''}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        Alert.alert('Remove', `Delete "${chore.title}"?`, [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Remove',
                            style: 'destructive',
                            onPress: () => removeChore(chore.id),
                          },
                        ]);
                      }}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.destructive} />
                    </Pressable>
                  </View>
                );
              })
            : null}

          <Pressable onPress={() => router.push(routes.groupMembers)} style={styles.link}>
            <Text style={styles.linkText}>Manage roommates →</Text>
          </Pressable>
        </RefreshableScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.lg },
  title: { ...typography.largeTitle, color: colors.text },
  subtitle: { ...typography.subhead, color: colors.textSecondary, marginBottom: spacing.lg },
  form: { padding: spacing.md, gap: spacing.sm, marginBottom: spacing.md },
  input: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 17,
    color: colors.text,
    backgroundColor: colors.fill,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  notes: { minHeight: 72, textAlignVertical: 'top' },
  label: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginLeft: 4,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  dateBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateValue: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 17,
    color: colors.text,
    minWidth: 120,
    textAlign: 'center',
  },
  quickRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.fill,
  },
  chipActive: { backgroundColor: colors.tintSoft },
  chipText: { fontFamily: 'Outfit_500Medium', fontSize: 14, color: colors.textSecondary },
  chipTextActive: { color: colors.tint },
  rotateHint: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: colors.textTertiary,
    marginLeft: 4,
    lineHeight: 18,
  },
  toggle: { alignItems: 'center', paddingVertical: spacing.md },
  toggleText: { fontFamily: 'Outfit_500Medium', fontSize: 15, color: colors.tint },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: 8,
    paddingRight: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  listMain: { flex: 1, padding: spacing.md },
  listTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: colors.text },
  done: { textDecorationLine: 'line-through', color: colors.textSecondary },
  listMeta: { fontFamily: 'Outfit_400Regular', fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  link: { alignItems: 'center', marginTop: spacing.lg },
  linkText: { fontFamily: 'Outfit_500Medium', fontSize: 16, color: colors.tint },
});
