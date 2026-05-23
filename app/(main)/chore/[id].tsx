import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckButton } from '@/components/CheckButton';
import { GroupedCard } from '@/components/GroupedCard';
import { ScreenBackground } from '@/components/ScreenBackground';
import { colors, spacing, typography } from '@/constants/theme';
import { useChores } from '@/context/ChoresContext';
import { useGroup } from '@/context/GroupContext';
import {
  canMarkChoreComplete,
  choreCompleteLockedMessage,
  formatAssigneeSummary,
  isProjectedChoreId,
  recurrenceLabel,
} from '@/lib/chores';
import { routes } from '@/lib/routes';

export default function ChoreDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getChoreById, toggleCompleteForChore, removeChore } = useChores();
  const { getMember } = useGroup();

  const chore = id ? getChoreById(id) : undefined;

  if (!chore) {
    return (
      <ScreenBackground>
        <View style={[styles.wrap, { paddingTop: insets.top }]}>
          <Text style={styles.title}>Chore not found</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.link}>Go back</Text>
          </Pressable>
        </View>
      </ScreenBackground>
    );
  }

  const member = getMember(chore.assigned_to);

  return (
    <ScreenBackground>
      <View style={[styles.wrap, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.close}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            disabled={isProjectedChoreId(chore.id)}
            onPress={() => {
              if (isProjectedChoreId(chore.id)) return;
              Alert.alert('Remove', `Delete "${chore.title}"?`, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: async () => {
                    await removeChore(chore.id);
                    router.back();
                  },
                },
              ]);
            }}
          >
            <Ionicons name="trash-outline" size={22} color={colors.destructive} />
          </Pressable>
        </View>

        <View style={styles.hero}>
          <CheckButton
            checked={chore.completed}
            onPress={() => {
              toggleCompleteForChore(chore).catch((e) => {
                Alert.alert(
                  'Not yet',
                  e instanceof Error ? e.message : choreCompleteLockedMessage(chore.due_date)
                );
              });
            }}
            onLockedPress={() =>
              Alert.alert('Not yet', choreCompleteLockedMessage(chore.due_date))
            }
            accentColor={member?.color}
            completeDisabled={!canMarkChoreComplete(chore)}
          />
          <Text style={[styles.title, chore.completed && styles.titleDone]}>{chore.title}</Text>
        </View>

        <GroupedCard style={styles.card}>
          {chore.notes ? (
            <View style={styles.row}>
              <Text style={styles.label}>Notes</Text>
              <Text style={styles.value}>{chore.notes}</Text>
            </View>
          ) : null}
          <View style={[styles.row, chore.notes && styles.rowBorder]}>
            <Text style={styles.label}>Assigned</Text>
            <Text style={styles.value}>{formatAssigneeSummary(chore, getMember)}</Text>
          </View>
          {chore.recurrence_type !== 'once' ? (
            <View style={[styles.row, styles.rowBorder]}>
              <Text style={styles.label}>Repeats</Text>
              <Text style={styles.value}>
                {recurrenceLabel(chore.recurrence_type)}
                {chore.rotation_mode === 'random' ? ' · fair rotation' : ''}
              </Text>
            </View>
          ) : null}
          <View style={[styles.row, styles.rowBorder]}>
            <Text style={styles.label}>Due</Text>
            <Text style={styles.value}>{format(parseISO(chore.due_date), 'EEEE, MMM d')}</Text>
          </View>
        </GroupedCard>

        <Pressable
          style={styles.trade}
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
            router.push(routes.trade);
          }}
        >
          <Ionicons name="swap-horizontal" size={20} color={colors.tint} />
          <Text style={styles.tradeText}>Trade this chore</Text>
        </Pressable>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  title: { ...typography.title1, color: colors.text, flex: 1 },
  titleDone: { textDecorationLine: 'line-through', color: colors.textSecondary },
  card: { padding: spacing.md },
  row: { paddingVertical: spacing.sm },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  label: { ...typography.footnote, color: colors.textSecondary, marginBottom: 4 },
  value: { ...typography.body, color: colors.text },
  trade: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.tintSoft,
    borderRadius: 14,
  },
  tradeText: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: colors.tint },
  link: { fontFamily: 'Outfit_500Medium', fontSize: 17, color: colors.tint, marginTop: spacing.md },
});
