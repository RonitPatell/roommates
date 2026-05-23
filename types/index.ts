export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  accent_color: string | null;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
  profile?: Profile;
}

export type RecurrenceType = 'once' | 'daily' | 'weekly' | 'monthly';
export type RotationMode = 'none' | 'random';
export type RotationPeriod = 'day' | 'week';

export interface Chore {
  id: string;
  group_id: string;
  title: string;
  notes?: string | null;
  assigned_to: string;
  assignee_ids: string[];
  recurrence_type: RecurrenceType;
  rotation_mode: RotationMode;
  rotation_period: RotationPeriod | null;
  series_id: string | null;
  due_date: string;
  completed: boolean;
  completed_at?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface TradeOffer {
  id: string;
  group_id: string;
  from_user_id: string;
  to_user_id: string;
  offered_chore_ids: string[];
  requested_chore_ids: string[];
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export interface MemberView {
  id: string;
  username: string;
  displayName: string;
  color: string;
  initial: string;
}

export interface LockInMessage {
  id: string;
  group_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface ChoreSeriesRotation {
  series_id: string;
  group_id: string;
  assignee_queue: string[];
  anchor_date: string;
  rotation_period: RotationPeriod;
  rotation_lag: number;
  last_processed_date: string | null;
  updated_at: string;
}

export interface HouseholdPointRow {
  user_id: string;
  points: number;
}

export interface HouseholdInviteIncoming {
  id: string;
  group_id: string;
  group_name: string;
  invited_by: string;
  inviter_username: string;
  inviter_display_name: string | null;
  created_at: string;
}

export interface HouseholdInviteOutgoing {
  id: string;
  invited_user_id: string;
  invitee_username: string;
  invitee_display_name: string | null;
  created_at: string;
}

export interface PublicProfile {
  id: string;
  username: string;
  display_name: string | null;
  avg_rating: number;
  review_count: number;
}

export interface RoommateReview {
  id: string;
  rating: number;
  body: string;
  created_at: string;
  updated_at: string;
  reviewer_id: string;
  reviewer_username: string;
  reviewer_display_name: string | null;
}
