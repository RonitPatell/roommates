# RevenueCat integration (Rumi)

Step-by-step setup for subscriptions with **Rumi Pro**, packages **monthly** / **yearly**, RevenueCat Paywalls, and Customer Center.

> **Expo Go does not support IAP.** Use a [development build](https://docs.expo.dev/develop/development-builds/introduction/) (`eas build --profile development`).

---

## 1. Install SDK (npm)

Already in this project:

```bash
npm install --save react-native-purchases react-native-purchases-ui --legacy-peer-deps
```

Rebuild the native app after installing:

```bash
npx eas build --profile development --platform ios
# or android
```

Docs: [React Native installation](https://www.revenuecat.com/docs/getting-started/installation/reactnative)

---

## 2. Environment variables

Add to `.env` (never commit real production keys to git):

```env
# Test Store key (works for iOS + Android while testing)
EXPO_PUBLIC_REVENUECAT_API_KEY=test_kiolQcYtOjmwmqINmhgLsavGMCa

# Or platform-specific keys from RevenueCat → Project → API keys
# EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_...
# EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_...
```

Restart Metro after changing `.env`: `npx expo start -c`

---

## 3. RevenueCat dashboard

### Project & apps

1. [RevenueCat](https://app.revenuecat.com) → create project **Rumi**.
2. Add **iOS** and **Android** apps with bundle / package **`com.rumi.app`** (matches `app.json`).

### Entitlement

1. **Entitlements** → create **`Rumi Pro`**.
2. Note the **identifier** — it must match `REVENUECAT_ENTITLEMENT_ID` in `constants/subscription.ts` (default: `Rumi Pro`).

### Products (App Store / Play Console)

Create subscriptions in each store, then link in RevenueCat:

| Store product (example) | Package in offering |
|-------------------------|---------------------|
| `rumi_pro_monthly`      | **monthly**         |
| `rumi_pro_yearly`       | **yearly**          |

Package **identifiers** in the offering must be `monthly` and `yearly` (see `REVENUECAT_PACKAGE_IDS`).

### Offering

1. **Offerings** → offering `default` (or your choice) → set as **Current**.
2. Add packages:
   - Identifier: `monthly` → monthly product
   - Identifier: `yearly` → yearly product
3. Attach both to entitlement **Rumi Pro**.

### Paywall (optional but recommended)

1. **Paywalls** → create a paywall for offering `default`.
2. Design in the editor — no app release needed to change copy/layout.

### Customer Center

1. **Customer Center** → enable and configure (cancel flows, restore, promo offers).
2. Used from **More → Manage subscription** when the household is on Pro.

---

## 4. App architecture

| File | Role |
|------|------|
| `constants/subscription.ts` | Entitlement id, package ids, feature gates |
| `lib/purchases/index.ts` | Configure SDK, login per household, purchases, paywall, Customer Center |
| `lib/purchases/errors.ts` | User-friendly purchase errors |
| `context/SubscriptionContext.tsx` | `isPro`, `customerInfo`, listeners, `presentPaywall()` |
| `components/RevenueCatPaywallView.tsx` | Embedded RevenueCat Paywall |
| `components/PaywallContent.tsx` | Upgrade UI (RC paywall + fallback) |
| `components/CustomerCenterButton.tsx` | Opens Customer Center |

### Household-scoped subscribers

Each household uses RevenueCat **App User ID** `household_{groupId}` so one subscription unlocks the whole group (synced to Supabase via `upsert_household_subscription`).

---

## 5. Code usage examples

### Check entitlement (Rumi Pro)

```typescript
import { useSubscription } from '@/context/SubscriptionContext';

function MyScreen() {
  const { isPro, loading, canUse } = useSubscription();

  if (loading) return null;
  if (!canUse('swap')) {
    // show upgrade CTA
  }
}
```

### Present paywall (modal)

```typescript
const { presentPaywall, presentPaywallIfNeeded } = useSubscription();

// Always show paywall
const result = await presentPaywall();
if (result.status === 'unlocked') {
  // purchased or restored
}

// Only if not Pro
await presentPaywallIfNeeded();
```

### Customer info

```typescript
const { customerInfo, refreshSubscription } = useSubscription();

const expiration = customerInfo?.entitlements.active['Rumi Pro']?.expirationDate;
```

### Customer Center

```typescript
import { presentCustomerCenter } from '@/lib/purchases';

await presentCustomerCenter(activeGroupId);
```

Or use `<CustomerCenterButton />` in the UI.

---

## 6. Error handling

Use `purchaseErrorMessage()` from `lib/purchases/errors.ts` for purchases. Cancelled purchases are detected via `PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR` and not shown as hard errors.

`SubscriptionContext` listens to `addCustomerInfoUpdateListener` so Pro status updates after purchases, restores, or billing changes outside the app.

---

## 7. Testing

1. Add `EXPO_PUBLIC_REVENUECAT_API_KEY` (test key).
2. Build dev client: `eas build --profile development --platform ios`.
3. Install on device → **More → Upgrade to Pro**.
4. RevenueCat **Test Store** simulates purchases without App Store Connect.
5. Optional: `EXPO_PUBLIC_SUBSCRIPTION_DEV_PRO=true` bypasses IAP locally.

---

## 8. Production checklist

- [ ] Replace test API key with `appl_` / `goog_` production keys in EAS secrets
- [ ] Entitlement identifier matches dashboard
- [ ] Offering `default` is current with `monthly` + `yearly`
- [ ] Paywall published in RevenueCat
- [ ] Customer Center configured
- [ ] Run `supabase/household-subscriptions-migration.sql`
- [ ] Store products approved in App Store Connect / Play Console

See also [SUBSCRIPTIONS.md](./SUBSCRIPTIONS.md) for Supabase household sync.
