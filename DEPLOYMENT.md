# Deployment

This guide takes Showcase from this repository to a running production site on **Supabase** (backend) and **Vercel** (frontend + one function). Dashboard menu names change from time to time; if a label differs slightly, look for the nearest equivalent.

> **Before operating commercially:** Vercel's **Hobby** plan is limited to personal, non-commercial use. The code works on any plan, but a business serving customers must run on a plan or provider that permits commercial use (for example Vercel Pro). Likewise, Supabase's **Free** plan has resource limits and pauses inactive projects (see §11). Free hosting is not guaranteed production uptime.

---

## 1. Create the Supabase project

1. Sign in at <https://supabase.com/dashboard> and create a project. Pick the region closest to your customers, and store the database password in a password manager.
2. Open **Project Settings → API** (or **API Keys**) and note:
   - the **Project URL** (`https://<ref>.supabase.co`)
   - the **anon** key, or the newer **publishable** key (`sb_publishable_…`). Both work.
   - **Do not** copy the `service_role` / secret key anywhere in this project. It isn't needed.

## 2. Apply the database migrations

From the repository root:

```bash
npm install
npx supabase login
npx supabase link --project-ref <your-project-ref>
npm run db:push:dry        # = supabase db push --remote --dry-run  (lists what will run)
npm run db:push            # = supabase db push --remote
```

Supabase CLI 3 targets the **local** stack by default. Every command that should touch the hosted project needs `--remote`, and the npm scripts already include it.

This creates every table, constraint, trigger, RLS policy and function, plus the `catalog-media` Storage bucket and its policies. **Do not run `seed.sql` in production.** It only exists for local development.

Then verify from the command line:

```bash
npm run db:advisors        # Supabase security/performance linter
npm run db:test:remote     # pgTAP security suite on the hosted DB, no Docker; runs in a rolled-back transaction
npm run db:smoke           # 10 checks through the public API, exactly as a browser sees it
```

The advisors should report only intentional warnings, all documented in SECURITY.md: `delete_my_account`, `is_slug_available` and `secure_linked_sign_in` are `SECURITY DEFINER` functions callable by signed-in users (each acts only on the caller's own account), and "leaked password protection" stays listed until you enable it in the dashboard (paid plans). On a brand-new database, "unused index" notices are expected until there is traffic.

You can also check in the dashboard: the **Table Editor** shows six tables with RLS enabled and a `free` row in `plans`, and **Storage** shows the public `catalog-media` bucket with a 2 MB limit and `image/jpeg, image/png, image/webp`.

## 3. Configure authentication

Most auth settings live in `supabase/config.toml` and are pushed with the CLI. Production values (site URL, redirect URLs, SSL enforcement) sit in the `[remotes.production]` block, keyed to the project ref, so local development keeps its localhost values:

```bash
npm run db:config:diff     # = supabase config diff  (shows what would change)
npx supabase config push   # applies declared settings to the linked project
```

This sets: site URL (`https://myshowcase.co.ke`), redirect URLs, email confirmation (pinned **off** for this project, see below), minimum password length 8 with letters and digits, a 2 MB Storage limit, SSL enforcement, and the two email templates with their subjects. When you change domains, edit `[remotes.production.auth]` and push again.

> **Email templates need custom SMTP (or a paid plan).** On the Free plan, Supabase rejects template changes while the project uses its built-in email sender, and `config push` fails as a whole. Configure SMTP first (section 4), then push. Until then, push without the template sections: copy `supabase/` to a temporary folder, delete the two `[auth.email.template.*]` blocks, and run `npx supabase config push --workdir <that folder>`. The app handles Supabase's default email links. Confirmation works fully in the same browser, and in another browser the user sees "email confirmed — sign in".

The same settings can also be made by hand in the dashboard:

**Authentication → Sign In / Providers → Email**

- Email provider: **enabled**
- **Confirm email**: this project runs with it **OFF** (owner's decision, pinned in `[remotes.production.auth.email]`). People can use the app straight after sign-up. Turning it on is safer, but needs custom SMTP (section 4) so real customers receive the emails. The app supports both settings, and `secure_linked_sign_in()` protects accounts that later sign in with Google (SECURITY.md §6).
- Minimum password length **8**, password requirements **letters and digits** (the app enforces the same rule)
- Optional: enable **leaked password protection** and a **CAPTCHA** (Attack Protection) if you see abuse

**Authentication → URL Configuration**

- **Site URL**: `https://myshowcase.co.ke` (no trailing slash)
- **Redirect URLs** (exact URLs, already pushed from `config.toml`):
  - `https://myshowcase.co.ke/auth/confirm` and `https://myshowcase.co.ke/auth/callback`
  - the same two paths on `https://www.myshowcase.co.ke` and `https://showcasev1.vercel.app`
  - `http://localhost:5173/auth/confirm` and `http://localhost:5173/auth/callback` for local development
  - add a preview URL only if you test sign-in on Vercel previews (prefer exact URLs over wildcards)

**Authentication → Emails → Templates**: replace two templates with the files in `supabase/templates/`.

| Template | Subject | Body |
|----------|---------|------|
| Confirm signup | `Confirm your Showcase account` | `supabase/templates/confirmation.html` |
| Reset password | `Reset your Showcase password` | `supabase/templates/recovery.html` |

These templates link to `/auth/confirm?token_hash=…`. That works even when the email opens in a different browser or app from the one used to sign up, which is common on Android. The app also handles the default templates, but those links only fully work in the same browser.

**Authentication → Rate Limits**: keep the defaults or lower them. The app shows a friendly "too many attempts" message.

### 3a. Google sign-in

"Continue with Google" appears on `/login` and `/signup` only when the Google provider is enabled on the Supabase project (the app reads the public `/auth/v1/settings`), so it is never a dead button. It asks Google only for Supabase's default scopes, `email` and `profile` (plus OpenID). No Gmail, Drive, Contacts or other Google API access is requested.

**The Google client secret is stored only in the Supabase dashboard.** It must never go into `.env`, a `VITE_*` variable, Vercel, `config.toml` or the repository. The browser never needs it: Google talks to Supabase, and Supabase gives the app its usual session.

**Google Cloud console** (<https://console.cloud.google.com/> → Google Auth Platform, or APIs & Services):

1. **Branding**: app name `Showcase`, a support email, home page `https://myshowcase.co.ke`, privacy policy `https://myshowcase.co.ke/privacy`, terms `https://myshowcase.co.ke/terms`.
2. **Authorized domains**: `myshowcase.co.ke` and the Supabase project domain `bhlijnewloakxbjxyfxp.supabase.co`.
3. **Data access (scopes)**: only `openid`, `.../auth/userinfo.email` and `.../auth/userinfo.profile`. These are non-sensitive scopes, so no Google security review is needed for them.
4. **Clients → Web application** (the client that is already in use):
   - **Authorized redirect URIs**: exactly `https://bhlijnewloakxbjxyfxp.supabase.co/auth/v1/callback`. This is the only redirect URI, for local, preview and production alike. Google returns to Supabase, and Supabase returns to the app's own `/auth/callback`.
   - **Authorized JavaScript origins**: `https://myshowcase.co.ke`, `https://www.myshowcase.co.ke`, `https://showcasev1.vercel.app` and `http://localhost:5173`. The redirect flow doesn't strictly need these, but they are harmless and needed if Google's own button or One Tap is ever added.
5. **Audience → Publishing status**: while it says **Testing**, only the listed test users can sign in. Click **Publish app** before real customers use Google sign-in. Google may ask you to verify the brand (name and logo) before they show on its consent screen.

**Supabase dashboard → Authentication → Sign In / Providers → Google**: enabled, with the Client ID and Client Secret from that Google client (already done). To rotate the secret, add a new secret in Google, paste it here, then delete the old one in Google.

**Where Google sends users back.** The app asks Supabase to return to `<current origin>/auth/callback`, which must be in the redirect URL list above. Each origin keeps its own sign-in state, so sign-in finishes on the same site where it started (local, preview or production). The page to open afterwards (for example `/dashboard/catalogue`) is kept in the tab's `sessionStorage`, never in the redirect URL, so redirect URLs stay exact matches.

**Local development**: nothing extra. Run `npm run dev` with your `.env` (URL and anon key only) and Google sign-in works on `http://localhost:5173`. If you ever run a local Supabase stack (`supabase start`) with Google, put the credentials in `[auth.external.google]` as `client_id = "env(GOOGLE_CLIENT_ID)"` and `secret = "env(GOOGLE_CLIENT_SECRET)"`, with the real values in a git-ignored `supabase/.env`. Never commit them.

**Account linking.** Supabase links a Google sign-in to an existing account with the same email, because Google has verified that email. With email confirmation off, though, someone could have registered that email with a password first without owning it. So after every Google sign-in the app calls `secure_linked_sign_in()`. The first time Google is linked to an account whose password existed before, it removes that unverified password and signs out every other session, and the owner is told. Details: SECURITY.md §6.

### 3b. OAuth server and consent page (optional)

Only needed if other apps will offer "Sign in with Showcase". In **Authentication → OAuth Server**, enable the server and set the authorization path to `/oauth/consent`. Supabase builds the Authorization URL from the Site URL, so it is now `https://myshowcase.co.ke/oauth/consent` (the dashboard preview showed `showcasev1.vercel.app` while that was the Site URL). The page asks guests to sign in first, shows the app's name, website, return address and requested scopes, then **Allow** or **Deny**. Users can remove apps later under **Settings → Connected apps**. Register third-party apps under **OAuth Apps**, and give confidential clients their secret out of band, never in this repository.

## 4. Configure production email (SMTP) — required

Supabase's built-in email sender is for testing only. It is heavily rate-limited, and on current projects it only delivers to members of your Supabase organisation. Real customers will **not** receive confirmation or password-reset emails until you configure a custom SMTP provider.

1. Create an account with a transactional email provider (for example Resend, Postmark, Brevo, SendGrid, Amazon SES or Mailgun).
2. Verify your sending domain (SPF and DKIM DNS records; add DMARC too).
3. In **Authentication → Emails → SMTP Settings**, enable custom SMTP and enter the host, port, username, password, the sender address (e.g. `no-reply@showcase.example`) and the sender name (`Showcase`).
4. Raise the email rate limit in **Rate Limits** to match your provider's quota.
5. Push the email templates: `npx supabase config push` (see section 3). You can also keep SMTP in `config.toml` under `[auth.email.smtp]`, with `pass = "env(SMTP_PASSWORD)"` so the secret never enters the repo.
6. Sign up with a personal address and confirm the email arrives, is not in spam, and the link works on your phone.

## 5. Environment variables

Set these in **Vercel → Project → Settings → Environment Variables**, for both **Production** and **Preview**:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | anon or publishable key |
| `VITE_SITE_URL` | `https://myshowcase.co.ke` (canonical URL; for previews you may leave it empty so links use the preview host) |
| `VITE_CONTACT_EMAIL` | optional public contact address |
| `SUPABASE_URL` | same as `VITE_SUPABASE_URL` (used by the share-preview function) |
| `SUPABASE_ANON_KEY` | same as `VITE_SUPABASE_ANON_KEY` |
| `SITE_URL` | same as `VITE_SITE_URL` |

`VITE_*` variables are compiled into the browser bundle, so **only public values** may use that prefix. No secret key is needed anywhere: Google sign-in adds **no** environment variable (its secret lives in the Supabase dashboard). If you ever add one (e.g. for a future admin job), never prefix it with `VITE_`.

After changing a `VITE_*` variable, **redeploy**: these values are baked in at build time.

## 6. Connect GitHub to Vercel

1. Push this repository to GitHub (a private repository is fine).
2. In Vercel: **Add New → Project → Import** the repository.
3. Vercel detects Vite. `vercel.json` already sets:
   - install `npm ci`, build `npm run build`, output `dist`
   - the crawler rewrite to `/api/share-preview` for `/s/:slug` and `/s/:slug/:item`
   - the SPA fallback `/((?!api/|assets/).*) → /index.html` (API routes and hashed assets are never rewritten)
   - long-lived caching for `/assets/*` and security headers (CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`)
4. Node.js: `package.json` requires Node 22.22 or later. Choose Node 22.x or 24.x under **Settings → General → Node.js Version** if Vercel asks.
5. Add the environment variables from §5, then **Deploy**.

> If you use a **custom Supabase domain** (e.g. `api.showcase.example`), add it to the `Content-Security-Policy` in `vercel.json` (`img-src` and `connect-src`). Otherwise the browser will block API calls and images.

## 7. Deploy

Every push to the default branch deploys to production, and every pull request gets a preview URL. Suggested CI gates before merging (all run locally too):

```bash
npm run lint && npm run typecheck && npm run test && npm run build
npm run test:e2e:install && npm run test:e2e
```

## 8. Configure your domain

1. **Vercel → Project → Settings → Domains → Add** your domain and create the DNS records Vercel shows. HTTPS certificates are issued automatically.
2. Update `VITE_SITE_URL` and `SITE_URL` to the new domain, then redeploy.
3. In Supabase **URL Configuration**, update the **Site URL** and add the new `/auth/confirm` and `/auth/callback` redirect URLs (or edit `[remotes.production.auth]` in `config.toml` and push).
4. In Google Cloud, add the domain to **Authorized domains**, **Authorized JavaScript origins** and the **Branding** links. The Google redirect URI does not change.
5. If you change domains later, storefront links and QR codes that owners already printed will point at the old domain. Keep the old domain redirecting (Vercel can redirect a domain to another).

## 9. Test the production application

Work through this list on a real Android phone over mobile data.

**Accounts**
- [ ] Sign up with a new email → you land in onboarding straight away (email confirmation is off). If you turn confirmation on: the email arrives → link opens `/auth/confirm` → onboarding.
- [ ] **Continue with Google** on `/signup` with a Google account that has never used Showcase → Google's account chooser → back on `myshowcase.co.ke` → onboarding. After setup, the dashboard greets you by your Google first name.
- [ ] Sign out, then **Continue with Google** on `/login` with the same account → dashboard. Open `/dashboard/catalogue` signed out → sign in with Google → you land on the catalogue.
- [ ] Cancel on Google's screen → "Google sign-in was cancelled" with a way back.
- [ ] Create an email/password account, then use **Continue with Google** with the same address → "Your account is now linked to Google", the old password no longer works, and **Settings** lists Google as a sign-in method.
- [ ] As a Google-only user, **Settings → Delete account** asks you to confirm with Google first.
- [ ] Sign out, sign in, refresh: the session persists. A wrong password shows a friendly error.
- [ ] Forgot password → email → set a new password → sign in with it. Reusing the link shows "This link didn't work".

**Onboarding and catalogue**
- [ ] Complete onboarding; refresh mid-way and confirm nothing is lost.
- [ ] Upload phone-camera photos (5–10 MB). They upload as ~300–700 KB images with progress, and portrait photos are rotated correctly.
- [ ] Publish. Add, edit, hide, duplicate, reorder and delete items. Create, rename and delete categories (items survive).

**Storefront**
- [ ] Open the link in a private window: logo, items, prices and availability appear, and **hidden items don't**.
- [ ] "Chat on WhatsApp" opens WhatsApp with the prefilled message. Item enquiries include the item link.
- [ ] Refresh on `/s/<slug>` and on an item URL: the page loads (no 404).
- [ ] Unpublish → the link shows "not available". Publish again.

**Sharing**
- [ ] Download the QR PNG/SVG and the card, and scan them with two different phones.
- [ ] Send the storefront link to yourself on **WhatsApp**: the preview shows the business name, description and cover image. Repeat for an item link.
- [ ] Check the link in the Facebook Sharing Debugger (<https://developers.facebook.com/tools/debug/>). WhatsApp caches previews, so test new links rather than re-sending old ones.
- [ ] `curl -A "WhatsApp/2.23" https://your-domain/s/<slug>` returns HTML with `og:title`, and a normal browser still gets the React app.

**Automated checks against the live project**
- [ ] `npm run db:smoke` passes (11/11, including the Google provider and its scopes) and `npm run db:test:remote` passes (22/22).
- [ ] Full browser journey on the real backend: run `npm run e2e:user`, then run `npm run test:e2e:real` with the printed `E2E_USER_EMAIL` and `E2E_USER_PASSWORD` set. The test signs in, completes onboarding with a real photo upload, publishes, checks the storefront as an anonymous visitor, hides an item, and finally deletes the account with all its data and photos.

**Platform**
- [ ] Response headers include `Content-Security-Policy` and `X-Content-Type-Options` (browser devtools → Network).
- [ ] Lighthouse (mobile) on a storefront: no layout-shift warnings, and images are lazy-loaded.
- [ ] In Supabase **Advisors**, no security warnings about RLS.

The social-preview routing has been verified locally against an emulation of `vercel.json` (`scripts/serve.ts`, covered by the E2E suite). It must still be checked on a real deployment with the steps above, because crawler behaviour can only be confirmed against the live platform.

## 10. Account deletion

Users delete their account from **Settings → Danger zone**. The app re-checks their password, removes their Storage objects through the Storage API, then calls `public.delete_my_account()`. That `SECURITY DEFINER` function deletes `auth.users` for `auth.uid()` only, which cascades to all business data.

If your Supabase project ever restricts direct deletes on `auth.users` from SQL functions, move step 3 into a Supabase Edge Function. It would verify the caller's JWT, then call `auth.admin.deleteUser(userId)` with the service-role key kept in the function's secrets. That key is server-side only and never in this repo or in Vercel.

## 11. Supabase Free plan: limits and upgrade path

At the time of writing, Free projects have small database, storage and egress allowances. They are **paused after about a week without activity** and must be restored from the dashboard, which takes the storefront offline until then. Check current limits at <https://supabase.com/pricing>.

What uses your quota:
- **Storage**: about 0.5–1 MB per photo (main image + thumbnail). 300 items × 3 photos is roughly 0.5–1 GB.
- **Egress**: storefront images are served from Supabase's CDN with year-long cache headers, and thumbnails keep listing pages light.
- **Database**: text-only rows. Thousands of storefronts fit comfortably.

Upgrade to a paid plan before a public launch for no pausing, daily backups (and point-in-time recovery as an add-on), higher limits and support. Plan limits *inside* Showcase (businesses, items, images) are rows in the `plans` table. Change them with SQL, never in frontend code.

## 12. Local development quick reference

```bash
npm run db:start      # Docker required; Studio http://localhost:54323, emails http://localhost:54324
npm run db:reset      # migrations + seed (demo@showcase.test / demo-password-1)
npm run dev
```
