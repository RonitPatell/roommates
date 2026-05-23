import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  applyOAuthRedirectUrl,
  applyPasswordRecoveryUrl,
  isAuthDeepLinkUrl,
  isPasswordRecoveryUrl,
  requestPasswordReset as sendPasswordResetEmail,
  signInWithGoogle as runGoogleOAuth,
  updatePassword as applyNewPassword,
} from '@/lib/auth';
import {
  isPasswordRecoveryPending,
  setPasswordRecoveryPending,
} from '@/lib/passwordRecovery';
import { bootstrapPasswordRecoverySession } from '@/lib/passwordRecoveryBootstrap';
import { deferAsync, withTimeout } from '@/lib/async';
import { isMemberColor } from '@/constants/memberColors';
import {
  getSupabase,
  isSupabaseConfigured,
  isValidUsername,
  needsUsernameSetup,
  normalizeUsername,
} from '@/lib/supabase';
import type { Profile } from '@/types';

export type SignUpResult =
  | { status: 'signed_in' }
  | { status: 'confirm_email'; email: string };

interface AuthContextValue {
  loading: boolean;
  profileResolved: boolean;
  configured: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    username: string,
    displayName: string
  ) => Promise<SignUpResult>;
  signInWithGoogle: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string, options?: { signOutAfter?: boolean }) => Promise<void>;
  setUsername: (username: string, displayName?: string) => Promise<void>;
  setAccentColor: (color: string) => Promise<void>;
  signOut: () => Promise<void>;
  needsUsername: boolean;
  /** True after opening a password-reset link — must set a new password first. */
  needsPasswordReset: boolean;
  clearPasswordRecovery: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const PROFILE_TIMEOUT_MS = 12_000;
const AUTH_ACTION_TIMEOUT_MS = 20_000;

async function ensureProfileRow(user: User): Promise<void> {
  const username = `user_${user.id.replace(/-/g, '').slice(0, 12)}`;
  const displayName =
    (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
    (typeof user.user_metadata?.name === 'string' && user.user_metadata.name) ||
    'New user';

  const { error } = await getSupabase().from('profiles').insert({
    id: user.id,
    username,
    display_name: displayName,
  });

  if (error && error.code !== '23505') {
    throw error;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [profileResolved, setProfileResolved] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [needsPasswordReset, setNeedsPasswordReset] = useState(() =>
    isPasswordRecoveryPending()
  );
  const initialSessionHandled = useRef(false);
  /** Skip duplicate onAuthStateChange work during sign-in / sign-up (avoids hangs). */
  const authActionInFlight = useRef(false);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await withTimeout(
      getSupabase().from('profiles').select('*').eq('id', userId).single(),
      PROFILE_TIMEOUT_MS,
      'Load profile'
    );
    if (error) throw error;
    if (!data) throw new Error('Profile not found');
    setProfile(data as Profile);
  }, []);

  const syncSession = useCallback(
    async (next: Session | null) => {
      setSession(next);
      if (!next?.user.id) {
        setProfile(null);
        setProfileResolved(true);
        return;
      }

      setProfileResolved(false);

      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          await fetchProfile(next.user.id);
          setProfileResolved(true);
          return;
        } catch {
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          }
        }
      }

      try {
        await ensureProfileRow(next.user);
        await fetchProfile(next.user.id);
      } catch {
        setProfile(null);
      }

      setProfileResolved(true);
    },
    [fetchProfile]
  );

  const refreshProfile = useCallback(async () => {
    if (!session?.user.id) return;
    await fetchProfile(session.user.id);
  }, [session?.user.id, fetchProfile]);

  const clearPasswordRecovery = useCallback(() => {
    setNeedsPasswordReset(false);
    setPasswordRecoveryPending(false);
  }, []);

  const handleAuthDeepLink = useCallback(
    async (url: string) => {
      if (!isAuthDeepLinkUrl(url) || url.includes('localhost')) return;

      if (isPasswordRecoveryUrl(url)) {
        setNeedsPasswordReset(true);
        const ok = await bootstrapPasswordRecoverySession(url);
        const { data } = await getSupabase().auth.getSession();
        if (ok && data.session) {
          setSession(data.session);
          setProfileResolved(true);
        }
        return;
      }

      await applyOAuthRedirectUrl(url);
      const { data } = await getSupabase().auth.getSession();
      if (data.session) {
        await syncSession(data.session);
      }
    },
    [syncSession]
  );

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      setProfileResolved(true);
      return;
    }

    const supabase = getSupabase();

    withTimeout(supabase.auth.getSession(), PROFILE_TIMEOUT_MS, 'Auth session')
      .then(({ data }) => {
        initialSessionHandled.current = true;
        setSession(data.session);
        setLoading(false);
        if (!data.session) {
          setProfileResolved(true);
          return;
        }
        deferAsync(async () => {
          try {
            await syncSession(data.session);
          } catch {
            setProfileResolved(true);
          }
        });
      })
      .catch(() => {
        setLoading(false);
        setProfileResolved(true);
      });

    // Never await inside onAuthStateChange — it can deadlock getSession() in React Native.
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'INITIAL_SESSION' && !initialSessionHandled.current) {
        return;
      }
      if (event === 'PASSWORD_RECOVERY') {
        setNeedsPasswordReset(true);
        setPasswordRecoveryPending(true);
        setSession(next);
        setProfileResolved(true);
        return;
      }
      if (authActionInFlight.current) {
        return;
      }
      if (isPasswordRecoveryPending()) {
        return;
      }
      deferAsync(async () => {
        if (authActionInFlight.current) return;
        if (isPasswordRecoveryPending()) return;
        try {
          await syncSession(next);
        } catch {
          setProfileResolved(true);
        }
      });
    });

    const linkSub = Linking.addEventListener('url', ({ url }) => {
      deferAsync(() => handleAuthDeepLink(url));
    });

    Linking.getInitialURL().then((url) => {
      if (url) deferAsync(() => handleAuthDeepLink(url));
    });

    return () => {
      sub.subscription.unsubscribe();
      linkSub.remove();
    };
  }, [syncSession, handleAuthDeepLink]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      authActionInFlight.current = true;
      try {
        const { data, error } = await withTimeout(
          getSupabase().auth.signInWithPassword({
            email: email.trim(),
            password,
          }),
          AUTH_ACTION_TIMEOUT_MS,
          'Sign in'
        );

        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes('email not confirmed')) {
            throw new Error('Please confirm your email first, then sign in.');
          }
          if (msg.includes('invalid login credentials')) {
            throw new Error('Incorrect email or password.');
          }
          throw new Error(error.message);
        }

        if (!data.session?.user) {
          throw new Error('Sign in failed. Please try again.');
        }

        setSession(data.session);
        setProfileResolved(true);
        deferAsync(async () => {
          try {
            await syncSession(data.session);
          } catch {
            setProfileResolved(true);
          }
        });
      } finally {
        setTimeout(() => {
          authActionInFlight.current = false;
        }, 400);
      }
    },
    [syncSession]
  );

  const signUpWithEmail = useCallback(
    async (
      email: string,
      password: string,
      username: string,
      displayName: string
    ): Promise<SignUpResult> => {
      const normalized = normalizeUsername(username);
      if (!isValidUsername(normalized)) {
        throw new Error('Username must be 3–20 characters: letters, numbers, underscore');
      }

      const display = displayName.trim() || normalized;
      authActionInFlight.current = true;

      try {
        const { data, error } = await withTimeout(
          getSupabase().auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: {
                username: normalized,
                display_name: display,
              },
            },
          }),
          AUTH_ACTION_TIMEOUT_MS,
          'Sign up'
        );

        if (error) {
          const msg = error.message.toLowerCase();
          if (
            msg.includes('username') &&
            (msg.includes('unique') || msg.includes('taken') || msg.includes('duplicate'))
          ) {
            throw new Error('Username is already taken');
          }
          if (msg.includes('database error saving new user')) {
            throw new Error(
              'Could not create your profile. That username may already be taken — try another.'
            );
          }
          throw error;
        }
        if (!data.user) throw new Error('Sign up failed');

        if (!data.session) {
          return { status: 'confirm_email', email: email.trim() };
        }

        const userId = data.user.id;
        setSession(data.session);
        setProfile({
          id: userId,
          username: normalized,
          display_name: display,
          accent_color: null,
          created_at: new Date().toISOString(),
        });
        setProfileResolved(true);

        deferAsync(async () => {
          try {
            await fetchProfile(userId);
          } catch {
            // Trigger creates profile from metadata; keep optimistic profile above.
          }
        });

        return { status: 'signed_in' };
      } catch (e) {
        if (e instanceof Error && e.message.includes('timed out')) {
          throw new Error(
            'Could not reach Supabase. Check your Wi‑Fi and .env keys, then try again.'
          );
        }
        throw e;
      } finally {
        setTimeout(() => {
          authActionInFlight.current = false;
        }, 400);
      }
    },
    [fetchProfile]
  );

  const signInWithGoogle = useCallback(async () => {
    await runGoogleOAuth();
    const { data, error } = await getSupabase().auth.getSession();
    if (error) throw error;
    if (!data.session) {
      throw new Error(
        'Google sign-in finished but no session was saved. Check Supabase Site URL and Redirect URLs (see error from sign-in for the exact list).'
      );
    }
    await syncSession(data.session);
  }, [syncSession]);

  const requestPasswordReset = useCallback(async (email: string) => {
    if (!email.trim()) {
      throw new Error('Enter your email address.');
    }
    await sendPasswordResetEmail(email);
  }, []);

  const updatePassword = useCallback(
    async (newPassword: string, options?: { signOutAfter?: boolean }) => {
      if (newPassword.length < 6) {
        throw new Error('Use at least 6 characters.');
      }
      authActionInFlight.current = true;
      try {
        await applyNewPassword(newPassword);
        clearPasswordRecovery();

        if (options?.signOutAfter) {
          setProfile(null);
          setProfileResolved(true);
          setSession(null);
          const { error } = await getSupabase().auth.signOut();
          if (error) throw error;
          return;
        }

        const { data, error } = await getSupabase().auth.getSession();
        if (error) throw error;
        if (data.session) {
          setSession(data.session);
          deferAsync(async () => {
            try {
              await syncSession(data.session);
            } catch {
              setProfileResolved(true);
            }
          });
        }
      } finally {
        setTimeout(() => {
          authActionInFlight.current = false;
        }, 400);
      }
    },
    [syncSession, clearPasswordRecovery]
  );

  const setAccentColor = useCallback(
    async (color: string) => {
      if (!session?.user.id) throw new Error('Not signed in');
      if (!isMemberColor(color)) {
        throw new Error('Pick a color from the palette');
      }

      const { error } = await getSupabase()
        .from('profiles')
        .update({ accent_color: color })
        .eq('id', session.user.id);

      if (error) throw error;
      await fetchProfile(session.user.id);
    },
    [session?.user.id, fetchProfile]
  );

  const setUsername = useCallback(
    async (username: string, displayName?: string) => {
      if (!session?.user.id) throw new Error('Not signed in');
      const normalized = normalizeUsername(username);
      if (!isValidUsername(normalized)) {
        throw new Error('Username must be 3–20 characters: letters, numbers, underscore');
      }

      const { error } = await getSupabase()
        .from('profiles')
        .update({
          username: normalized,
          ...(displayName !== undefined
            ? { display_name: displayName.trim() || normalized }
            : {}),
        })
        .eq('id', session.user.id);
      if (error) {
        if (error.code === '23505') throw new Error('Username is already taken');
        throw error;
      }
      await fetchProfile(session.user.id);
    },
    [session?.user.id, fetchProfile]
  );

  const signOut = useCallback(async () => {
    authActionInFlight.current = true;
    try {
      clearPasswordRecovery();
      setProfile(null);
      setProfileResolved(true);
      setSession(null);
      const { error } = await getSupabase().auth.signOut();
      if (error) {
        const { data } = await getSupabase().auth.getSession();
        await syncSession(data.session);
        throw error;
      }
    } finally {
      authActionInFlight.current = false;
    }
  }, [syncSession, clearPasswordRecovery]);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      profileResolved,
      configured: isSupabaseConfigured,
      session,
      user: session?.user ?? null,
      profile,
      refreshProfile,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      requestPasswordReset,
      updatePassword,
      setUsername,
      setAccentColor,
      signOut,
      needsUsername: Boolean(
        session &&
          profileResolved &&
          (!profile || needsUsernameSetup(profile.username)) &&
          !needsPasswordReset
      ),
      needsPasswordReset,
      clearPasswordRecovery,
    }),
    [
      loading,
      profileResolved,
      session,
      profile,
      refreshProfile,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      requestPasswordReset,
      updatePassword,
      setUsername,
      setAccentColor,
      signOut,
      needsPasswordReset,
      clearPasswordRecovery,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
