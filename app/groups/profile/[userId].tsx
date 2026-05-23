import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { ReviewCard } from '@/components/ReviewCard';
import { ScreenBackground } from '@/components/ScreenBackground';
import { StarRatingDisplay, StarRatingPicker } from '@/components/StarRating';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useGroup } from '@/context/GroupContext';
import { fetchProfileBundle, upsertRoommateReview } from '@/lib/reviews';
import { memberColor } from '@/lib/supabase';
import type { PublicProfile, RoommateReview } from '@/types';

export default function RoommateProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile: myProfile } = useAuth();
  const {
    activeGroup,
    members,
    sendHouseholdInvite,
    outgoingInvites,
    refreshInvites,
  } = useGroup();

  const [loading, setLoading] = useState(true);
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const [reviews, setReviews] = useState<RoommateReview[]>([]);
  const [rating, setRating] = useState(5);
  const [reviewBody, setReviewBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [adding, setAdding] = useState(false);

  const isSelf = myProfile?.id === userId;
  const isCreator = activeGroup?.created_by === myProfile?.id;
  const alreadyMember = members.some((m) => m.id === userId);
  const pendingInvite = outgoingInvites.some((i) => i.invited_user_id === userId);
  const canReview = !isSelf && alreadyMember && Boolean(activeGroup);

  const myReview = useMemo(
    () => reviews.find((r) => r.reviewer_id === myProfile?.id),
    [reviews, myProfile?.id]
  );

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const bundle = await fetchProfileBundle(userId);
      setPublicProfile(bundle.profile);
      setReviews(bundle.reviews);
      if (bundle.reviews.find((r) => r.reviewer_id === myProfile?.id)) {
        const mine = bundle.reviews.find((r) => r.reviewer_id === myProfile?.id)!;
        setRating(mine.rating);
        setReviewBody(mine.body);
      }
    } catch (e) {
      Alert.alert('Could not load profile', e instanceof Error ? e.message : 'Try again');
    } finally {
      setLoading(false);
    }
  }, [userId, myProfile?.id]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const displayName =
    publicProfile?.display_name || publicProfile?.username || 'Roommate';
  const accent = memberColor(userId ?? '');

  const handleSubmitReview = async () => {
    if (!userId || isSelf || !canReview) return;
    if (!reviewBody.trim()) {
      Alert.alert('Write a review', 'Share a few words about living with this roommate.');
      return;
    }
    setSubmitting(true);
    try {
      await upsertRoommateReview(userId, rating, reviewBody);
      await load();
      Alert.alert('Saved', myReview ? 'Your review was updated.' : 'Thanks for your review!');
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendInvite = async () => {
    if (!publicProfile?.username || !isCreator) return;
    setAdding(true);
    try {
      await sendHouseholdInvite(publicProfile.username);
      await refreshInvites();
      Alert.alert(
        'Invite sent',
        `@${publicProfile.username} will need to accept before joining ${activeGroup?.name}.`
      );
    } catch (e) {
      Alert.alert(
        'Could not send invite',
        e instanceof Error ? e.message : 'User not found or already invited'
      );
    } finally {
      setAdding(false);
    }
  };

  if (!userId) {
    return (
      <ScreenBackground>
        <View style={[styles.center, { paddingTop: insets.top }]}>
          <Text style={styles.error}>Profile not found</Text>
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 32 },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>

        {loading ? (
          <ActivityIndicator color={colors.chrome} style={styles.loader} />
        ) : !publicProfile ? (
          <Text style={styles.error}>This profile could not be loaded.</Text>
        ) : (
          <>
            <View style={styles.hero}>
              <View style={[styles.avatar, { backgroundColor: `${accent}22` }]}>
                <Text style={[styles.initial, { color: accent }]}>
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.title}>{displayName}</Text>
              <Text style={styles.username}>@{publicProfile.username}</Text>
              <StarRatingDisplay
                rating={publicProfile.avg_rating}
                size={22}
                reviewCount={publicProfile.review_count}
              />
            </View>

            {isCreator && !isSelf && !alreadyMember && !pendingInvite ? (
              <AppleButton
                label={`Invite to ${activeGroup?.name ?? 'household'}`}
                onPress={handleSendInvite}
                loading={adding}
              />
            ) : null}
            {isCreator && !isSelf && pendingInvite && !alreadyMember ? (
              <Text style={styles.pendingInvite}>Invite sent — waiting for them to accept</Text>
            ) : null}
            {alreadyMember && !isSelf ? (
              <Text style={styles.memberNote}>In your household</Text>
            ) : null}

            {!isSelf && !canReview ? (
              <Text style={styles.reviewGate}>
                Add this person to your household before you can leave a review. You can still
                read what others have written below.
              </Text>
            ) : null}

            {canReview ? (
              <GroupedCard style={styles.formCard}>
                <Text style={styles.sectionTitle}>
                  {myReview ? 'Your review' : 'Write a review'}
                </Text>
                <Text style={styles.ratingHint}>Rating · out of 5 stars (half steps allowed)</Text>
                <StarRatingPicker value={rating} onChange={setRating} />
                <InputField
                  label="Review"
                  value={reviewBody}
                  onChangeText={setReviewBody}
                  placeholder="How are they as a roommate?"
                  multiline
                  style={styles.reviewInput}
                />
                <AppleButton
                  label={myReview ? 'Update review' : 'Post review'}
                  onPress={handleSubmitReview}
                  loading={submitting}
                />
              </GroupedCard>
            ) : null}

            <Text style={styles.sectionTitle}>
              Reviews {publicProfile.review_count > 0 ? `(${publicProfile.review_count})` : ''}
            </Text>
            {reviews.length === 0 ? (
              <Text style={styles.empty}>No reviews yet. Be the first to share your experience.</Text>
            ) : (
              <View style={styles.reviewList}>
                {reviews.map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.lg, gap: spacing.md },
  back: { fontFamily: 'Outfit_500Medium', fontSize: 17, color: colors.tint },
  loader: { marginTop: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { ...typography.subhead, color: colors.textSecondary, textAlign: 'center' },
  hero: {
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  initial: { fontFamily: 'Outfit_700Bold', fontSize: 34 },
  title: { ...typography.largeTitle, color: colors.text, textAlign: 'center' },
  username: {
    ...typography.subhead,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  memberNote: {
    ...typography.subhead,
    color: colors.success,
    textAlign: 'center',
  },
  pendingInvite: {
    ...typography.subhead,
    color: colors.warning,
    textAlign: 'center',
  },
  reviewGate: {
    ...typography.subhead,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.sm,
  },
  formCard: { padding: spacing.md, gap: spacing.md },
  ratingHint: {
    ...typography.footnote,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  sectionTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
  },
  reviewInput: { minHeight: 100, textAlignVertical: 'top' },
  empty: {
    ...typography.subhead,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  reviewList: { gap: spacing.sm },
});
