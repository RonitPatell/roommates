# Rumi Pro — subscriptions

See **[REVENUECAT.md](./REVENUECAT.md)** for full SDK setup, Paywalls, and Customer Center.

One **household-level** subscription unlocks Pro for every roommate in that group.

## Pricing (configure in App Store Connect / Play Console)

| Product ID (store) | Package ID (RevenueCat) | Suggested price |
|--------------------|-------------------------|-----------------|
| `rumi_pro_monthly` | `monthly` | $4.99 / month |
| `rumi_pro_yearly` | `yearly` | $39.99 / year |

## Setup checklist

### 1. Supabase

Run `supabase/household-subscriptions-migration.sql` in the SQL Editor.

### 2. RevenueCat

1. Create a project at [revenuecat.com](https://www.revenuecat.com).
2. Add iOS and Android apps (bundle `com.rumi.app`).
3. Create entitlement **`Rumi Pro`** (identifier must match `constants/subscription.ts`).
4. Attach **monthly** and **yearly** packages to that entitlement on offering `default`.
5. Copy API keys into `.env`:

```env
EXPO_PUBLIC_REVENUECAT_API_KEY=test_...
```

### 3. App stores

Create auto-renewable subscriptions with the **same product IDs** as above in App Store Connect and Google Play Console, then link them in RevenueCat.

### 4. Builds

In-app purchases require a **development build** or store build — they do not work in Expo Go.

```bash
npx eas build --profile development --platform ios
```

### 5. Dev unlock (optional)

For local testing without the store:

```env
EXPO_PUBLIC_SUBSCRIPTION_DEV_PRO=true
```

## Free vs Pro

| Feature | Free | Pro |
|---------|------|-----|
| Core chores & calendar | ✓ | ✓ |
| Household members | Up to 4 | Unlimited |
| Active chores | Up to 25 | Unlimited |
| Chore swaps | — | ✓ |
| Points & leaderboard | — | ✓ |
| Nudges | — | ✓ |
| Fair rotation (take turns) | — | ✓ |

## How it works

- RevenueCat **App User ID** = `household_{groupId}` so one purchase applies to the whole group.
- After purchase, the app calls `upsert_household_subscription` so all members see Pro via Supabase RLS.
- For production hardening, add a [RevenueCat webhook](https://www.revenuecat.com/docs/webhooks) to a Supabase Edge Function to update `household_subscriptions` server-side.

## Restore

Any household member can tap **Restore purchases** on the upgrade screen (uses the active household’s RevenueCat ID).
