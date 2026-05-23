import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppleButton } from '@/components/AppleButton';
import { GroupedCard } from '@/components/GroupedCard';
import { ScreenBackground } from '@/components/ScreenBackground';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useGroup } from '@/context/GroupContext';
import { routes } from '@/lib/routes';

export default function GroupsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, session, signOut } = useAuth();
  const {
    groups,
    refreshGroups,
    createGroup,
    setActiveGroup,
    incomingInvites,
    respondToHouseholdInvite,
    refreshInvites,
  } = useGroup();
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  React.useEffect(() => {
    if (!session) {
      router.replace(routes.welcome);
    }
  }, [session, router]);

  React.useEffect(() => {
    if (session) refreshInvites().catch(() => {});
  }, [session, refreshInvites]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await setActiveGroup(null);
      await signOut();
      // Navigation is handled by the session effect below — avoid a second replace here.
    } catch (e) {
      Alert.alert('Sign out failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSigningOut(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshGroups(), refreshInvites()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleInviteResponse = async (inviteId: string, accept: boolean) => {
    try {
      const groupId = await respondToHouseholdInvite(inviteId, accept);
      if (accept && groupId) {
        router.replace(routes.tabs);
        return;
      }
      if (!accept) {
        Alert.alert('Declined', 'Household invite declined.');
      }
    } catch (e) {
      Alert.alert('Something went wrong', e instanceof Error ? e.message : 'Try again');
    }
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      Alert.alert('Name required', 'Enter a name for your household.');
      return;
    }
    setCreating(true);
    try {
      await createGroup(name);
      setShowCreate(false);
      setNewName('');
      router.replace(routes.tabs);
    } catch (e) {
      Alert.alert('Could not create group', e instanceof Error ? e.message : 'Try again');
    } finally {
      setCreating(false);
    }
  };

  const openGroup = async (id: string) => {
    await setActiveGroup(id);
    router.replace(routes.tabs);
  };

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 32 },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {profile?.display_name ?? 'there'}</Text>
            <Text style={styles.title}>Your groups</Text>
          </View>
          <Pressable
            onPress={handleSignOut}
            disabled={signingOut}
            hitSlop={12}
            style={({ pressed }) => [styles.signOutBtn, pressed && styles.signOutPressed]}
          >
            <Text style={styles.signOut}>{signingOut ? 'Signing out…' : 'Sign out'}</Text>
          </Pressable>
        </View>
        <Text style={styles.subtitle}>
          A group is your household — invite roommates by username; they must accept before joining.
        </Text>

        {incomingInvites.length > 0 ? (
          <GroupedCard style={styles.inviteCard}>
            <Text style={styles.inviteSectionTitle}>Household invites</Text>
            {incomingInvites.map((inv, i) => (
              <View
                key={inv.id}
                style={[styles.inviteRow, i < incomingInvites.length - 1 && styles.rowBorder]}
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{inv.group_name}</Text>
                  <Text style={styles.rowSub}>
                    From @
                    {inv.inviter_display_name
                      ? `${inv.inviter_display_name} (@${inv.inviter_username})`
                      : inv.inviter_username}
                  </Text>
                </View>
                <View style={styles.inviteActions}>
                  <Pressable
                    style={styles.declineBtn}
                    onPress={() => handleInviteResponse(inv.id, false)}
                  >
                    <Text style={styles.declineText}>Decline</Text>
                  </Pressable>
                  <Pressable
                    style={styles.acceptBtn}
                    onPress={() => handleInviteResponse(inv.id, true)}
                  >
                    <Text style={styles.acceptText}>Accept</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </GroupedCard>
        ) : null}

        {groups.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🏡</Text>
            <Text style={styles.emptyTitle}>No groups yet</Text>
            <Text style={styles.emptyBody}>Create one for your apartment or house.</Text>
          </View>
        ) : (
          <GroupedCard style={styles.list}>
            {groups.map((g, i) => (
              <Pressable
                key={g.id}
                onPress={() => openGroup(g.id)}
                style={[styles.row, i < groups.length - 1 && styles.rowBorder]}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name="home-outline" size={22} color={colors.tint} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{g.name}</Text>
                  <Text style={styles.rowSub}>Open household</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
              </Pressable>
            ))}
          </GroupedCard>
        )}

        {showCreate ? (
          <View style={styles.createBox}>
            <TextInput
              style={styles.createInput}
              placeholder="e.g. Maple Street Apartment"
              placeholderTextColor={colors.textTertiary}
              value={newName}
              onChangeText={setNewName}
            />
            <AppleButton label="Create group" onPress={handleCreate} loading={creating} />
            <AppleButton label="Cancel" onPress={() => setShowCreate(false)} variant="ghost" />
          </View>
        ) : (
          <AppleButton label="Create a group" onPress={() => setShowCreate(true)} />
        )}

        {groups.length > 0 ? (
          <Pressable style={styles.membersLink} onPress={() => router.push(routes.groupMembers)}>
            <Text style={styles.membersLinkText}>Manage roommates →</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  greeting: { ...typography.subhead, color: colors.textSecondary },
  title: { ...typography.largeTitle, color: colors.text },
  signOutBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 72,
    alignItems: 'flex-end',
  },
  signOutPressed: { opacity: 0.5 },
  signOut: { fontFamily: 'Outfit_600SemiBold', fontSize: 15, color: colors.destructive },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { ...typography.title3, color: colors.text },
  emptyBody: { ...typography.subhead, color: colors.textSecondary, marginTop: 4 },
  list: { marginBottom: spacing.lg },
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
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.tintSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: { ...typography.headline, color: colors.text },
  rowSub: { ...typography.footnote, color: colors.textSecondary, marginTop: 2 },
  createBox: { gap: spacing.sm, marginTop: spacing.md },
  createInput: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 17,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.text,
  },
  membersLink: { alignItems: 'center', marginTop: spacing.lg },
  membersLinkText: { fontFamily: 'Outfit_500Medium', fontSize: 16, color: colors.tint },
  inviteCard: { marginBottom: spacing.lg },
  inviteSectionTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  inviteRow: {
    padding: spacing.md,
    gap: spacing.md,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  declineBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  declineText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: colors.textSecondary,
  },
  acceptBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: colors.chrome,
  },
  acceptText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: colors.background,
  },
});
