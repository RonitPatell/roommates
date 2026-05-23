import { getSupabase } from '@/lib/supabase';
import type { PublicProfile, RoommateReview } from '@/types';

function isReviewsUnavailable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = error.message ?? '';
  return (
    error.code === 'PGRST202' ||
    error.code === '42P01' ||
    msg.includes('roommate_reviews') ||
    msg.includes('lookup_profile_by_username') ||
    msg.includes('get_public_profile') ||
    msg.includes('get_reviews_for_user') ||
    msg.includes('upsert_roommate_review')
  );
}

function mapProfile(row: Record<string, unknown>): PublicProfile {
  return {
    id: row.id as string,
    username: row.username as string,
    display_name: (row.display_name as string | null) ?? null,
    avg_rating: Number(row.avg_rating ?? 0),
    review_count: Number(row.review_count ?? 0),
  };
}

function mapReview(row: Record<string, unknown>): RoommateReview {
  return {
    id: row.id as string,
    rating: Number(row.rating),
    body: row.body as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    reviewer_id: row.reviewer_id as string,
    reviewer_username: row.reviewer_username as string,
    reviewer_display_name: (row.reviewer_display_name as string | null) ?? null,
  };
}

export async function lookupProfileByUsername(
  username: string
): Promise<PublicProfile | null> {
  const { data, error } = await getSupabase().rpc('lookup_profile_by_username', {
    uname: username.trim().toLowerCase(),
  });
  if (error) {
    if (isReviewsUnavailable(error)) return null;
    throw error;
  }
  const row = (data as Record<string, unknown>[] | null)?.[0];
  return row ? mapProfile(row) : null;
}

export async function fetchPublicProfile(userId: string): Promise<PublicProfile | null> {
  const { data, error } = await getSupabase().rpc('get_public_profile', {
    p_user_id: userId,
  });
  if (error) {
    if (isReviewsUnavailable(error)) return null;
    throw error;
  }
  const row = (data as Record<string, unknown>[] | null)?.[0];
  return row ? mapProfile(row) : null;
}

export async function fetchReviewsForUser(userId: string): Promise<RoommateReview[]> {
  const { data, error } = await getSupabase().rpc('get_reviews_for_user', {
    p_user_id: userId,
  });
  if (error) {
    if (isReviewsUnavailable(error)) return [];
    throw error;
  }
  return ((data ?? []) as Record<string, unknown>[]).map(mapReview);
}

export async function upsertRoommateReview(
  subjectUserId: string,
  rating: number,
  body: string
): Promise<void> {
  const { error } = await getSupabase().rpc('upsert_roommate_review', {
    p_subject_id: subjectUserId,
    p_rating: rating,
    p_body: body.trim(),
  });
  if (error) {
    if (isReviewsUnavailable(error)) {
      throw new Error(
        'Reviews are not set up yet. Run supabase/roommate-reviews-migration.sql in Supabase.'
      );
    }
    throw error;
  }
}

export async function fetchProfileBundle(userId: string): Promise<{
  profile: PublicProfile | null;
  reviews: RoommateReview[];
}> {
  const [profile, reviews] = await Promise.all([
    fetchPublicProfile(userId),
    fetchReviewsForUser(userId),
  ]);
  return { profile, reviews };
}
