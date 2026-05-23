import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { APP_SCHEME } from '@/constants/app';
import { setPasswordRecoveryPending } from '@/lib/passwordRecovery';
import { getSupabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const CALLBACK_PATH = 'auth/callback';
const PASSWORD_RESET_PATH = 'auth/reset-password';

export function isRunningInExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

export function isOAuthReturnUrl(url: string): boolean {
  if (isPasswordRecoveryUrl(url)) return false;
  return url.includes('auth/callback') || url.includes('code=');
}

export function isPasswordRecoveryUrl(url: string): boolean {
  return url.includes(PASSWORD_RESET_PATH) || url.includes('type=recovery');
}

export function isAuthDeepLinkUrl(url: string): boolean {
  return isOAuthReturnUrl(url) || isPasswordRecoveryUrl(url);
}

/**
 * OAuth redirect URI for Supabase `redirectTo`.
 * Expo Go must use exp:// (only Expo Go registers that scheme).
 * Dev/production builds use rumi:// from app.json.
 */
export function getAuthRedirectUri(path: string = CALLBACK_PATH): string {
  const hostUri = Constants.expoConfig?.hostUri;

  if (isRunningInExpoGo()) {
    if (!hostUri) {
      throw new Error(
        'Could not determine Expo redirect URL. Restart with: npx expo start -c'
      );
    }
    if (hostUri.includes('127.0.0.1') || hostUri.startsWith('localhost')) {
      throw new Error(
        'Expo is using localhost for OAuth. On a physical phone, start Expo without --localhost (use your LAN IP), or use a development build with rumi://.'
      );
    }
    return `exp://${hostUri}/--/${path}`;
  }

  const forced = Linking.createURL(path, { scheme: APP_SCHEME });
  if (forced.startsWith(`${APP_SCHEME}://`) && !forced.includes('undefined')) {
    return forced;
  }

  return `${APP_SCHEME}://${path}`;
}

export function getRedirectUri(): string {
  return getAuthRedirectUri(CALLBACK_PATH);
}

/** Where Supabase sends users after they tap “reset password” in email (opens the app). */
export function getPasswordResetRedirectUri(): string {
  return getAuthRedirectUri(PASSWORD_RESET_PATH);
}

function readRedirectToFromAuthUrl(authUrl: string): string | null {
  try {
    return new URL(authUrl).searchParams.get('redirect_to');
  } catch {
    return null;
  }
}

/** Copy into Supabase → Authentication → URL configuration */
export function getSupabaseOAuthSetupInstructions(): string {
  const redirect = getRedirectUri();
  const inExpoGo = isRunningInExpoGo();

  if (inExpoGo) {
    return [
      'Supabase → Authentication → URL configuration',
      '',
      'You are in Expo Go — Safari cannot open rumi:// links.',
      '',
      '1. Site URL — set to this exact value (not rumi://):',
      redirect,
      '',
      '2. Redirect URLs — add:',
      redirect,
      getPasswordResetRedirectUri(),
      'exp://**',
      '',
      '3. Save, wait ~1 minute, try Google sign-in again.',
    ].join('\n');
  }

  const resetRedirect = getPasswordResetRedirectUri();

  return [
    'Supabase → Authentication → URL configuration',
    '',
    '1. Site URL:',
    `${APP_SCHEME}://${CALLBACK_PATH}`,
    '',
    '2. Redirect URLs — add:',
    redirect,
    resetRedirect,
    `${APP_SCHEME}://${CALLBACK_PATH}`,
    `${APP_SCHEME}://${PASSWORD_RESET_PATH}`,
    `${APP_SCHEME}://**`,
    'exp://**',
  ].join('\n');
}

/** Parse recovery / magic-link URL and mark user as needing a new password. */
export async function applyPasswordRecoveryUrl(url: string): Promise<void> {
  setPasswordRecoveryPending(true);
  await applyOAuthRedirectUrl(url);
}

export async function requestPasswordReset(email: string): Promise<void> {
  const supabase = getSupabase();
  const redirectTo = getPasswordResetRedirectUri();

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('rate limit')) {
      throw new Error('Too many requests. Wait a few minutes and try again.');
    }
    throw new Error(error.message);
  }
}

export async function updatePassword(newPassword: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export function parseOAuthRedirectUrl(url: string): Record<string, string> {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) {
    throw new Error(errorCode);
  }

  const merged: Record<string, string> = { ...params };

  if (!merged.access_token && !merged.code) {
    const hashIndex = url.indexOf('#');
    const queryIndex = url.indexOf('?');
    const paramString =
      hashIndex >= 0
        ? url.slice(hashIndex + 1)
        : queryIndex >= 0
          ? url.slice(queryIndex + 1).split('#')[0]
          : '';

    if (paramString) {
      const extra = Object.fromEntries(new URLSearchParams(paramString));
      Object.assign(merged, extra);
    }
  }

  return merged;
}

/** Apply tokens or auth code from the OAuth redirect URL to the Supabase session. */
export async function applyOAuthRedirectUrl(url: string): Promise<void> {
  const supabase = getSupabase();
  const params = parseOAuthRedirectUrl(url);

  if (params.error_description || params.error) {
    throw new Error(params.error_description ?? params.error ?? 'OAuth error');
  }

  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) throw error;
    return;
  }

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    return;
  }

  throw new Error('Sign-in callback did not include tokens. Check Supabase redirect URLs.');
}

function oauthConfigError(reason: string, detail?: string): Error {
  return new Error(
    [reason, '', getSupabaseOAuthSetupInstructions(), detail ? `\n${detail}` : '']
      .filter(Boolean)
      .join('\n')
  );
}

export async function signInWithGoogle(): Promise<void> {
  const supabase = getSupabase();
  const redirectTo = getRedirectUri();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error('Could not start Google sign-in');

  const redirectInAuthUrl = readRedirectToFromAuthUrl(data.url);
  if (redirectInAuthUrl?.startsWith(`${APP_SCHEME}://`) && isRunningInExpoGo()) {
    throw oauthConfigError(
      'Supabase is about to send you to rumi://, but Expo Go only understands exp://.',
      `Auth URL redirect_to:\n${redirectInAuthUrl}\n\nExpected:\n${redirectTo}`
    );
  }

  let deepLinkUrl: string | null = null;
  const linkSub = Linking.addEventListener('url', ({ url }) => {
    if (isOAuthReturnUrl(url) && !url.includes('localhost')) {
      deepLinkUrl = url;
    }
  });

  try {
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    if (result.type === 'cancel' || result.type === 'dismiss') {
      if (deepLinkUrl) {
        await applyOAuthRedirectUrl(deepLinkUrl);
        return;
      }
      throw new Error('Sign-in was cancelled');
    }

    if (result.type !== 'success' || !result.url) {
      if (deepLinkUrl) {
        await applyOAuthRedirectUrl(deepLinkUrl);
        return;
      }
      throw oauthConfigError(
        'The sign-in browser did not return to the app.',
        `Expected:\n${redirectTo}`
      );
    }

    if (result.url.includes('localhost')) {
      throw oauthConfigError('Redirect went to localhost.', result.url);
    }

    if (
      isRunningInExpoGo() &&
      result.url.startsWith(`${APP_SCHEME}://`)
    ) {
      throw oauthConfigError(
        'Safari tried to open rumi:// but Expo Go needs exp://.',
        result.url
      );
    }

    await applyOAuthRedirectUrl(result.url);
  } finally {
    linkSub.remove();
  }
}
