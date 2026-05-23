import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppleButton } from '@/components/AppleButton';
import { EmptyState } from '@/components/EmptyState';
import { PremiumGate } from '@/components/PremiumGate';
import { MemberPicker } from '@/components/MemberPicker';
import { NudgeMessageCard } from '@/components/NudgeMessageCard';
import { RefreshableScrollView } from '@/components/RefreshableScrollView';
import { ScreenBackground } from '@/components/ScreenBackground';
import { NUDGE_TEMPLATES } from '@/constants/nudges';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useGroup } from '@/context/GroupContext';
import { useLockIn } from '@/context/LockInContext';
import { usePullToRefresh } from '@/lib/usePullToRefresh';

type Mode = 'inbox' | 'send';

export default function NudgeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { members, activeGroup } = useGroup();
  const { inbox, unreadCount, sendNudge, markRead } = useLockIn();
  const { refreshing, onRefresh } = usePullToRefresh({
    chores: false,
    members: true,
    profile: false,
    nudges: true,
  });

  const [mode, setMode] = useState<Mode>('inbox');
  const [recipientId, setRecipientId] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const otherMembers = useMemo(
    () => members.filter((m) => m.id !== user?.id),
    [members, user?.id]
  );

  const effectiveRecipientId = recipientId || otherMembers[0]?.id || '';
  const selectedRecipient = otherMembers.find((m) => m.id === effectiveRecipientId);

  const pickTemplate = (template: string) => {
    Haptics.selectionAsync();
    setBody(template);
  };

  const handleSend = async () => {
    if (!effectiveRecipientId) {
      Alert.alert('Pick a roommate', 'Choose who should get the nudge.');
      return;
    }
    if (!body.trim()) {
      Alert.alert('Write a message', 'Pick a template or type your own.');
      return;
    }
    setSending(true);
    try {
      await sendNudge(effectiveRecipientId, body);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Nudge sent',
        `Your anonymous message was sent to ${selectedRecipient?.displayName ?? 'them'}.`
      );
      setBody('');
      setRecipientId('');
      setMode('inbox');
    } catch (e) {
      Alert.alert('Could not send', e instanceof Error ? e.message : 'Try again');
    } finally {
      setSending(false);
    }
  };

  return (
    <PremiumGate feature="nudge">
    <ScreenBackground>
      <RefreshableScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: spacing.md, paddingBottom: insets.bottom + 100 },
        ]}
        refreshing={refreshing}
        onRefresh={onRefresh}
        safeAreaTop={insets.top}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Lock in</Text>
        <Text style={styles.subtitle}>
          Send anonymous nudges to roommates in {activeGroup?.name ?? 'your group'}. They will not
          know who sent it.
        </Text>

        <View style={styles.segment}>
          <Segment
            label="Inbox"
            active={mode === 'inbox'}
            badge={unreadCount}
            onPress={() => setMode('inbox')}
          />
          <Segment label="Send" active={mode === 'send'} onPress={() => setMode('send')} />
        </View>

        {mode === 'inbox' ? (
          inbox.length === 0 ? (
            <EmptyState
              icon="lock-closed-outline"
              title="No nudges yet"
              subtitle="When a roommate sends you an anonymous lock-in message, it will show up here."
            />
          ) : (
            <View style={styles.list}>
              {inbox.map((msg) => (
                <NudgeMessageCard
                  key={msg.id}
                  message={msg}
                  onPress={() => {
                    if (!msg.read_at) markRead(msg.id).catch(() => {});
                  }}
                />
              ))}
            </View>
          )
        ) : otherMembers.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No roommates yet"
            subtitle="Add members to your group before sending nudges."
          />
        ) : (
          <View style={styles.send}>
            <MemberPicker
              label="Send to"
              members={otherMembers}
              selectedId={effectiveRecipientId}
              onSelect={setRecipientId}
            />

            <Text style={styles.fieldLabel}>Quick templates</Text>
            <View style={styles.templates}>
              {NUDGE_TEMPLATES.map((t) => {
                const active = body === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => pickTemplate(t)}
                    style={[styles.templateChip, active && styles.templateChipActive]}
                  >
                    <Text style={[styles.templateText, active && styles.templateTextActive]}>
                      {t}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Or write your own</Text>
            <TextInput
              style={styles.input}
              placeholder="Keep it constructive — they'll see this anonymously"
              placeholderTextColor={colors.textTertiary}
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={500}
            />
            <Text style={styles.charCount}>{body.length}/500</Text>

            <AppleButton label="Send anonymous nudge" onPress={handleSend} loading={sending} />
            <Text style={styles.disclaimer}>
              Limit: 5 nudges per roommate per day. Messages cannot be traced back to you.
            </Text>
          </View>
        )}
      </RefreshableScrollView>
    </ScreenBackground>
    </PremiumGate>
  );
}

function Segment({
  label,
  active,
  badge,
  onPress,
}: {
  label: string;
  active: boolean;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={[styles.segmentBtn, active && styles.segmentBtnActive]}
    >
      <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{label}</Text>
      {badge && badge > 0 ? (
        <View style={styles.segmentBadge}>
          <Text style={styles.segmentBadgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.largeTitle,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  segmentBtnActive: {
    backgroundColor: colors.fillSecondary,
  },
  segmentLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    color: colors.textTertiary,
  },
  segmentLabelActive: {
    color: colors.chromeBright,
  },
  segmentBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  segmentBadgeText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 11,
    color: colors.background,
  },
  list: {
    gap: spacing.md,
  },
  send: {
    gap: spacing.md,
  },
  fieldLabel: {
    ...typography.footnote,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  templates: {
    gap: spacing.sm,
  },
  templateChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  templateChipActive: {
    borderColor: colors.chrome,
    backgroundColor: colors.tintSoft,
  },
  templateText: {
    ...typography.subhead,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  templateTextActive: {
    color: colors.text,
  },
  input: {
    minHeight: 100,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderChrome,
    backgroundColor: colors.surface,
    padding: spacing.md,
    fontFamily: 'Outfit_400Regular',
    fontSize: 16,
    color: colors.text,
    textAlignVertical: 'top',
  },
  charCount: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'right',
    marginTop: -8,
  },
  disclaimer: {
    ...typography.footnote,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
