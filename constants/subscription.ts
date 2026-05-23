/** Premium features gated on the free tier. */
export type PremiumFeature =
  | 'swap'
  | 'points'
  | 'nudge'
  | 'fair_rotation'
  | 'unlimited_members'
  | 'unlimited_chores';

export const FREE_TIER = {
  maxMembers: 4,
  maxActiveChores: 25,
} as const;

/** RevenueCat entitlement identifier — display name in dashboard: Rumi Pro */
export const REVENUECAT_ENTITLEMENT_ID = 'Rumi Pro';

/** Package identifiers in your RevenueCat offering (monthly / yearly). */
export const REVENUECAT_PACKAGE_IDS = {
  monthly: 'monthly',
  yearly: 'yearly',
} as const;

/** App Store / Play Store product IDs (link these in RevenueCat). */
export const STORE_PRODUCT_IDS = {
  monthly: 'rumi_pro_monthly',
  yearly: 'rumi_pro_yearly',
} as const;

export const SUBSCRIPTION_DISPLAY = {
  monthly: { price: '$4.99', period: 'month', label: 'Monthly' },
  yearly: {
    price: '$39.99',
    period: 'year',
    label: 'Yearly',
    badge: 'Best value',
    savings: 'Save 33%',
  },
} as const;

export const PREMIUM_FEATURE_COPY: Record<
  PremiumFeature,
  { title: string; description: string }
> = {
  swap: {
    title: 'Chore swaps',
    description: 'Trade chores with roommates when plans change.',
  },
  points: {
    title: 'Points & leaderboard',
    description: 'Track on-time chores and missed tasks for the household.',
  },
  nudge: {
    title: 'Anonymous nudges',
    description: 'Send gentle reminders without awkward group chats.',
  },
  fair_rotation: {
    title: 'Fair rotation',
    description: 'Auto-rotate recurring chores and carry missed days forward.',
  },
  unlimited_members: {
    title: 'More roommates',
    description: `Free plan supports up to ${FREE_TIER.maxMembers} members per household.`,
  },
  unlimited_chores: {
    title: 'Unlimited chores',
    description: `Free plan supports up to ${FREE_TIER.maxActiveChores} active chores.`,
  },
};
