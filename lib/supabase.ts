import '@/lib/polyfills';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

import { firstAvailableColor, isMemberColor } from '@/constants/memberColors';
import { colors } from '@/constants/theme';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(url && anonKey && !url.includes('your-project'));

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    });
  }
  return client;
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(username);
}

export function needsUsernameSetup(username: string): boolean {
  return /^user_[a-f0-9]{12}$/.test(username);
}

/** Fallback when profile has no accent_color saved yet. */
export function memberColor(userId: string): string {
  const palette = colors.memberColors;
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

export function resolveMemberColor(
  profile: { id: string; accent_color?: string | null },
  takenInGroup: string[]
): string {
  if (profile.accent_color && isMemberColor(profile.accent_color)) {
    return profile.accent_color;
  }
  return firstAvailableColor(takenInGroup) ?? memberColor(profile.id);
}
