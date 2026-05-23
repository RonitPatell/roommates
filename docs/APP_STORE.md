# App Store & Play Store release (EAS)

This project is set up for [Expo Application Services (EAS)](https://expo.dev/eas) builds.

## One-time setup

### 1. Apple Developer & App Store Connect

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year).
2. In [App Store Connect](https://appstoreconnect.apple.com/), create an app with bundle ID **`com.rumi.app`** (must match `app.json`).

### 2. Link the project to EAS

```bash
npm install -g eas-cli
eas login
eas init
```

`eas init` creates an Expo project and adds `extra.eas.projectId` to `app.json`. Commit that change.

### 3. Production secrets (Supabase)

Do **not** commit `.env`. Set secrets for cloud builds:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR_PROJECT.supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_ANON_KEY"
```

List secrets: `eas secret:list`

### 4. Supabase auth URLs (production build)

In Supabase → **Authentication → URL configuration**:

- **Site URL:** `rumi://auth/callback`
- **Redirect URLs:** add `rumi://**`

Update your Google OAuth client with the same redirect rules Supabase documents for mobile.

### 5. (Optional) Fill in `eas.json` submit metadata

On first submit, EAS can prompt for Apple ID and team. To avoid prompts, add to `eas.json` under `submit.production.ios`:

| Field | Where to find it |
|--------|------------------|
| `appleId` | Your Apple ID email |
| `appleTeamId` | [developer.apple.com/account](https://developer.apple.com/account) → Membership |
| `ascAppId` | App Store Connect → App → General → Apple ID (numeric) |

## Build profiles (`eas.json`)

| Profile | Use |
|---------|-----|
| `development` | Dev client on a **physical iPhone** (internal install) |
| `development-simulator` | Dev client for **iOS Simulator on Mac** only |
| `preview` | Internal TestFlight-style testing (APK on Android) |
| `production` | App Store & Google Play (`autoIncrement` bumps iOS `buildNumber` / Android `versionCode`) |

## Commands

```bash
# iOS App Store build
npm run build:ios

# Android Play Store build (AAB)
npm run build:android

# Upload latest production build to stores (follow prompts)
npm run submit:ios
npm run submit:android
```

Or directly:

```bash
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

## Before each release

1. Bump `version` in `app.json` for user-visible releases (e.g. `1.0.1`).
2. Run a **production** build (`autoIncrement` handles build numbers).
3. Test the `.ipa` via **TestFlight** before submitting for review.
4. In App Store Connect: screenshots, description, privacy policy URL, App Privacy questionnaire, review notes (demo login if needed).

## App Store checklist

- [ ] Privacy policy URL (required for account-based apps)
- [ ] 1024×1024 icon (`assets/icon.png`)
- [ ] Screenshots for required device sizes
- [ ] Production Supabase schema + migrations applied
- [ ] Sign-in works on a **standalone** build (not only Expo Go)
- [ ] `ITSAppUsesNonExemptEncryption` is `false` in `app.json` (standard HTTPS-only apps)

## Android (Google Play)

1. Create an app in [Google Play Console](https://play.google.com/console) with package **`com.rumi.app`**.
2. `npm run build:android` produces an **AAB**.
3. `npm run submit:android` or upload the AAB manually in Play Console.

First Android submit may require a Google Play service account JSON; see [Expo: Android submit](https://docs.expo.dev/submit/android/).
