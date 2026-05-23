import * as Linking from 'expo-linking';

import {
  applyPasswordRecoveryUrl,
  isPasswordRecoveryUrl,
} from '@/lib/auth';
import {
  isPasswordRecoveryPending,
  setPasswordRecoveryPending,
} from '@/lib/passwordRecovery';
import { getSupabase } from '@/lib/supabase';

const RETRY_MS = 200;
const MAX_RETRIES = 20;

export function urlHasRecoveryTokens(url: string): boolean {
  return url.includes('access_token=') || url.includes('code=');
}

async function hasRecoverySession(): Promise<boolean> {
  const { data } = await getSupabase().auth.getSession();
  return Boolean(data.session);
}

async function tryApplyRecoveryUrl(url: string | null | undefined): Promise<boolean> {
  if (!url || !isPasswordRecoveryUrl(url) || !urlHasRecoveryTokens(url)) {
    return false;
  }
  try {
    await applyPasswordRecoveryUrl(url);
    return hasRecoverySession();
  } catch {
    return false;
  }
}

/**
 * Apply tokens from a reset email deep link. Retries because the OS often
 * delivers the URL (especially the #hash) slightly after the first screen paint.
 */
export async function bootstrapPasswordRecoverySession(
  incomingUrl?: string | null
): Promise<boolean> {
  if (await hasRecoverySession() && isPasswordRecoveryPending()) {
    return true;
  }

  if (await tryApplyRecoveryUrl(incomingUrl)) {
    return true;
  }

  const initial = await Linking.getInitialURL();
  if (await tryApplyRecoveryUrl(initial)) {
    return true;
  }

  for (let i = 0; i < MAX_RETRIES; i++) {
    if (await hasRecoverySession() && isPasswordRecoveryPending()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
  }

  return hasRecoverySession();
}

export function markPasswordRecoveryPending(): void {
  setPasswordRecoveryPending(true);
}
