# Supabase auth email templates



HTML templates styled to match the Rumi app (dark chrome theme).



## Reset password email



1. **Authentication → Email Templates → Reset password**

2. **Subject:** `reset-password-subject.txt`

3. **Body:** paste `reset-password.html` (HTML / Source mode)

4. **Authentication → URL configuration → Redirect URLs** — add:

   - **Expo Go:** `exp://YOUR_LAN_IP:8081/--/auth/reset-password` and `exp://**`

   - **Dev/production build:** `rumi://auth/reset-password` and `rumi://**`

5. Save



Reset links open the app, apply the recovery session, then show **Choose a new password** (not the groups screen).



## Confirm signup email



1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **Email Templates**.

2. Select **Confirm signup**.

3. **Subject:** paste the contents of `confirm-signup-subject.txt`  

   (`Confirm your Rumi account`)

4. **Body:** switch to **Source** / HTML mode and paste the full contents of `confirm-signup.html`.

5. Save.



Supabase replaces `{{ .ConfirmationURL }}` with the user’s confirmation link. Do not remove that variable.



### Logo



The email embeds the same mark as the app (`assets/roommates-logo.png`) as an inline image so it works without hosting a URL.



If you change the logo, regenerate the template:



```bash

python supabase/email-templates/embed-logo.py

```



Then paste the updated HTML into Supabase again.



### Testing



- **Authentication → Users** → create a test user with email, or sign up from the app.

- Check spam folder; use a custom SMTP provider in production for better deliverability.



## Variables available



| Variable | Description |

|----------|-------------|

| `{{ .ConfirmationURL }}` | Link the user must open |

| `{{ .SiteURL }}` | Your site URL from auth settings |

| `{{ .Email }}` | User’s email address |



See [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates).


