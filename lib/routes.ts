import type { Href } from 'expo-router';

export const routes = {
  setup: '/setup' as Href,
  authCallback: '/auth/callback' as Href,
  welcome: '/(auth)/welcome' as Href,
  forgotPassword: '/(auth)/forgot-password' as Href,
  resetPassword: '/(auth)/reset-password' as Href,
  setupUsername: '/(auth)/setup-username' as Href,
  groups: '/groups' as Href,
  groupMembers: '/groups/members' as Href,
  profile: (userId: string) => `/groups/profile/${userId}` as Href,
  tabs: '/(main)/(tabs)' as Href,
  more: '/(main)/(tabs)/more' as Href,
  scores: '/(main)/(tabs)/scores' as Href,
  nudge: '/(main)/(tabs)/nudge' as Href,
  trade: '/(main)/(tabs)/trade' as Href,
  upgrade: '/(main)/upgrade' as Href,
  chore: (id: string) => `/(main)/chore/${id}` as Href,
};
