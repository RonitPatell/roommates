# Rumi — Chore App

A clean, Apple-inspired app for households to share chores, assign tasks, and trade responsibilities.

## Features

- **Sign in** with Google or email
- **Unique username** — roommates add you with `@username`
- **Groups** — create a household and invite members
- **Chores** — assign, due dates, calendar, check-off, trades

## Setup (required)

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a project.
2. Copy **Project URL** and **anon public key** from Settings → API.

### 2. Configure the app

```bash
cp .env.example .env
```

Edit `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 3. Run the database schema

In Supabase → **SQL Editor**, paste and run the full contents of `supabase/schema.sql`.

### 4. Auth settings

- **Authentication → Providers → Google**: enable and add OAuth credentials.
- **Authentication → URL configuration** (Google sign-in in **Expo Go**):
  - Run `npx expo start`, tap **Continue with Google** once; the error shows your exact redirect URL.
  - **Expo Go**: set **Site URL** to that `exp://192.168.x.x:8081/--/auth/callback` value (not `rumi://` — Safari cannot open custom schemes in Expo Go).
  - **Redirect URLs**: add that same `exp://…` line plus `exp://**`, and `exp://…/--/auth/reset-password` for password reset.
  - **Dev/production build** (not Expo Go): use `rumi://auth/callback` as Site URL and add `rumi://**`, `rumi://auth/reset-password` to Redirect URLs.
- For easier dev testing: **Authentication → Providers → Email** → disable “Confirm email” (optional).
- **Email templates:** confirm signup and reset password — `supabase/email-templates/` (see that folder’s README).
- **Forgot password:** Sign in → **Forgot password?** → open the email link on your phone → **Choose a new password** in the app.

### 5. Run the app

```bash
npm.cmd install
npx.cmd expo start -c
```

Scan the QR code with **Expo Go** (SDK 54).

## Flow

1. Create an account and pick a **username**
2. **Create a group** (your apartment/house)
3. **Add roommates** via username (Manage roommates)
4. Add and assign chores from the **Manage** tab

## App Store / Play Store

See **[docs/APP_STORE.md](docs/APP_STORE.md)** for EAS build and submit steps (`eas.json` is already configured).

**Rumi Pro** subscriptions: see **[docs/REVENUECAT.md](docs/REVENUECAT.md)** and **[docs/SUBSCRIPTIONS.md](docs/SUBSCRIPTIONS.md)**.

Quick start after `eas login` and `eas init`:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "..."
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "..."
npm run build:ios
npm run submit:ios
```

## Tech

- Expo SDK 54 · React Native · Expo Router 6
- Supabase (Auth + Postgres + RLS)
