import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppleButton } from '@/components/AppleButton';
import { GroupedCard } from '@/components/GroupedCard';
import { InputField } from '@/components/InputField';
import { MemberColorPicker } from '@/components/MemberColorPicker';
import { ScreenBackground } from '@/components/ScreenBackground';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useGroup } from '@/context/GroupContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { APP_NAME } from '@/constants/app';
import { PREMIUM_FEATURE_COPY } from '@/constants/subscription';
import { lookupProfileByUsername } from '@/lib/reviews';
import { routes } from '@/lib/routes';
import { normalizeUsername } from '@/lib/supabase';

export default function MembersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, setAccentColor } = useAuth();
  const {
    activeGroup,
    members,
    sendHouseholdInvite,
    outgoingInvites,
    cancelOutgoingInvite,
    refreshMembers,
    refreshInvites,
    deleteGroup,
  } = useGroup();
  const { canUse, freeLimits } = useSubscription();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [savingColor, setSavingColor] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isCreator = activeGroup?.created_by === profile?.id;

  const myColor = useMemo(() => {
    const me = members.find((m) => m.id === profile?.id);
    return me?.color ?? profile?.accent_color ?? null;
  }, [members, profile?.id, profile?.accent_color]);

  const takenColors = useMemo(
    () => members.filter((m) => m.id !== profile?.id).map((m) => m.color),
    [members, profile?.id]
  );

  const handleSaveColor = async (color: string) => {
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
  };

  const confirmDeleteHousehold = () => {
    if (!activeGroup) return;
    Alert.alert(
      'Delete household?',
      `"${activeGroup.name}" and all chores, trades, and nudges will be permanently removed for every roommate.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setDeleting(true);
              try {
                await deleteGroup(activeGroup.id);
                router.replace(routes.groups);
              } catch (e) {
                Alert.alert(
                  'Could not delete',
                  e instanceof Error ? e.message : 'Please try again'
                );
              } finally {
                setDeleting(false);
              }
            })();
          },
        },
      ]
    );
  };

  const handleViewProfile = async () => {
    const normalized = normalizeUsername(username);
    if (!normalized) {
      Alert.alert('Enter a username', 'e.g. jane_doe');
      return;
    }
    setPreviewLoading(true);
    try {
      const found = await lookupProfileByUsername(normalized);
      if (!found) {
        Alert.alert('Not found', `No account with username @${normalized}.`);
        return;
      }
      router.push(routes.profile(found.id));
    } catch (e) {
      Alert.alert('Could not load profile', e instanceof Error ? e.message : 'Try again');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSendInvite = async () => {
    const normalized = normalizeUsername(username);
    if (!normalized) {
      Alert.alert('Enter a username', 'e.g. jane_doe');
      return;
    }
    if (!canUse('unlimited_members') && members.length >= freeLimits.maxMembers) {
      const copy = PREMIUM_FEATURE_COPY.unlimited_members;
      Alert.alert(copy.title, copy.description, [
        { text: 'Not now', style: 'cancel' },
        { text: 'Upgrade', onPress: () => router.push(routes.upgrade) },
      ]);
      return;
    }
    setLoading(true);
    try {
      await sendHouseholdInvite(normalized);
      setUsername('');
      Alert.alert(
        'Invite sent',
        `@${normalized} will need to accept before joining ${activeGroup?.name}.`
      );
    } catch (e) {
      Alert.alert(
        'Could not send invite',
        e instanceof Error ? e.message : 'User not found or already invited'
      );
    } finally {
      setLoading(false);
    }
  };

  const openMemberProfile = (memberId: string) => {
    router.push(routes.profile(memberId));
  };

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 32 },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>← Groups</Text>
        </Pressable>
        <Text style={styles.title}>{APP_NAME}</Text>
        <Text style={styles.subtitle}>{activeGroup?.name}</Text>

        <GroupedCard style={styles.colorCard}>
          <MemberColorPicker
            label="Your color"
            selectedColor={myColor}
            takenColors={takenColors}
            onSelect={handleSaveColor}
          />
          {savingColor ? <Text style={styles.savingColor}>Saving…</Text> : null}
        </GroupedCard>

        <GroupedCard style={styles.list}>
          {members.map((m, i) => (
            <Pressable
              key={m.id}
              style={[styles.row, i < members.length - 1 && styles.rowBorder]}
              onPress={() => openMemberProfile(m.id)}
            >
              <View style={[styles.avatar, { backgroundColor: `${m.color}22` }]}>
                <Text style={[styles.initial, { color: m.color }]}>{m.initial}</Text>
              </View>
              <View style={styles.rowText}>
                <Text style={styles.name}>{m.displayName}</Text>
                <Text style={styles.handle}>@{m.username}</Text>
              </View>
              <View style={[styles.colorBadge, { backgroundColor: m.color }]} />
              {m.id === profile?.id ? (
                <Text style={styles.you}>You</Text>
              ) : (
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
              )}
            </Pressable>
          ))}
        </GroupedCard>

        {isCreator && outgoingInvites.length > 0 ? (
          <GroupedCard style={styles.pendingCard}>
            <Text style={styles.pendingTitle}>Pending invites</Text>
            {outgoingInvites.map((inv, i) => (
              <View
                key={inv.id}
                style={[styles.pendingRow, i < outgoingInvites.length - 1 && styles.rowBorder]}
              >
                <View style={styles.rowText}>
                  <Text style={styles.name}>
                    {inv.invitee_display_name || inv.invitee_username}
                  </Text>
                  <Text style={styles.handle}>@{inv.invitee_username} · waiting</Text>
                </View>
                <Pressable
                  onPress={() => {
                    Alert.alert('Cancel invite?', `Withdraw the invite for @${inv.invitee_username}?`, [
                      { text: 'Keep', style: 'cancel' },
                      {
                        text: 'Cancel invite',
                        style: 'destructive',
                        onPress: () => cancelOutgoingInvite(inv.id).catch(() => {}),
                      },
                    ]);
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.cancelInvite}>Cancel</Text>
                </Pressable>
              </View>
            ))}
          </GroupedCard>
        ) : null}

        <Text style={styles.sectionLabel}>Invite by username</Text>
        <InputField
          label="Their username"
          autoCapitalize="none"
          value={username}
          onChangeText={(t) => setUsername(normalizeUsername(t))}
          placeholder="roommate_username"
        />
        <AppleButton
          label="View profile"
          variant="secondary"
          onPress={handleViewProfile}
          loading={previewLoading}
        />
        <AppleButton
          label="Send household invite"
          onPress={handleSendInvite}
          loading={loading}
          disabled={!isCreator}
        />
        {!isCreator ? (
          <Text style={styles.note}>Only the household creator can send invites.</Text>
        ) : (
          <Text style={styles.note}>
            They must accept the invite before joining your household.
          </Text>
        )}

        {isCreator ? (
          <View style={styles.dangerZone}>
            <Text style={styles.dangerLabel}>Creator only</Text>
            <Text style={styles.dangerHint}>
              Deleting removes this household for everyone. Members can leave instead if they
              only want to exit.
            </Text>
            <AppleButton
              label="Delete household"
              variant="destructive"
              onPress={confirmDeleteHousehold}
              loading={deleting}
            />
          </View>
        ) : null}

        <Pressable
          onPress={() => {
            refreshMembers().catch(() => {});
            refreshInvites().catch(() => {});
          }}
          style={styles.refresh}
        >
          <Ionicons name="refresh-outline" size={18} color={colors.tint} />
          <Text style={styles.refreshText}>Refresh list</Text>
        </Pressable>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.lg, gap: spacing.md },
  back: { fontFamily: 'Outfit_500Medium', fontSize: 17, color: colors.tint },
  title: { ...typography.largeTitle, color: colors.text },
  subtitle: { ...typography.subhead, color: colors.textSecondary },
  colorCard: { padding: spacing.md },
  savingColor: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  list: { marginTop: spacing.sm },
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
  colorBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 4,
  },
  you: { fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: colors.tint },
  sectionLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.lg,
  },
  note: {
    ...typography.footnote,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  pendingCard: { marginTop: spacing.sm },
  pendingTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  cancelInvite: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: colors.destructive,
  },
  dangerZone: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    gap: spacing.sm,
  },
  dangerLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: colors.destructive,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dangerHint: {
    ...typography.footnote,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  refresh: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.md,
  },
  refreshText: { fontFamily: 'Outfit_500Medium', fontSize: 15, color: colors.tint },
});
