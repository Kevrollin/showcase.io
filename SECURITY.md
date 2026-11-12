# Security

This document describes Showcase's security model, what is public and what is private, and the checklist to complete before launch. Report vulnerabilities privately to the operator's contact address rather than in a public issue.

## 1. Secrets and environment

| Value | Secret? | Where it may appear |
|-------|---------|---------------------|
| Supabase project URL | No | `VITE_SUPABASE_URL`, `SUPABASE_URL` |
| Supabase anon / publishable key | No (designed to be public; RLS protects data) | `VITE_SUPABASE_ANON_KEY`, `SUPABASE_ANON_KEY` |
| Supabase `service_role` / secret key | **Yes** | **Nowhere in this project.** Not needed. |
| Database password | **Yes** | Password manager / Supabase CLI login only |
| SMTP credentials | **Yes** | Supabase dashboard only |
| Google OAuth client ID | No (public by design) | Supabase dashboard (Google provider) |
| Google OAuth client secret | **Yes** | **Supabase dashboard only.** Never in `.env`, `VITE_*`, Vercel, `config.toml` or the repo. |

- Anything prefixed `VITE_` is compiled into public JavaScript. Never give a secret that prefix.
- `.env`, `.env.*` (except `.env.example`) and `.vercel` are git-ignored.
- `tests/api/share-preview.test.ts` asserts that the server function never references a service-role key.

## 2. Authorisation model (RLS)

All authorisation happens in Postgres. The frontend is treated as untrusted.

- RLS is **enabled on every table** (`plans`, `profiles`, `businesses`, `categories`, `catalogue_items`, `catalogue_images`). The test suite fails if any public table has RLS disabled.
- Privileges are granted explicitly per role; nothing relies on default grants.
- `owner_id` comes from `auth.uid()` in a trigger, so a client-supplied `owner_id` is ignored. It can't be changed after creation, and neither can `business_id` on items or images.
- Ownership helpers (`private.is_business_owner` and friends) are `SECURITY DEFINER`, run with `search_path = ''`, and live in a schema PostgREST doesn't expose.
- `profiles.plan_id` can't be changed by users (column-level `UPDATE` privilege on `full_name` only).
- Plan limits, slug rules, price/mode consistency and media paths are enforced by constraints and triggers, under per-owner advisory locks against races.

Access matrix: [PROJECT_ARCHITECTURE.md §5](PROJECT_ARCHITECTURE.md#5-row-level-security).

### Tested guarantees

`tests/db/*.test.ts` run the real migrations on Postgres (PGlite). `supabase/tests/database/rls.test.sql` checks the same core rules with pgTAP on a real stack. Among other things they verify:

- Anonymous visitors see only published businesses, only their published items and images, and only public columns. `owner_id` and onboarding state are unreadable.
- Drafts, unpublished storefronts and hidden items are invisible to anonymous visitors and to other signed-in users, including through the RPCs and by direct item slug.
- User A can't read, update or delete user B's businesses, categories, items or images, can't add rows to B's business, and can't reorder B's items.
- Anonymous users can't write anything or call owner-only RPCs (`is_slug_available`, `reorder_*`, `delete_my_account`, `secure_linked_sign_in`).
- Linking Google to an account whose password existed first removes that password and other sessions, once, and only for the caller (`tests/db/google-sign-in.test.ts`).
- Deleting an account needs a sign-in within the last 15 minutes, checked in the database.
- Composite foreign keys prevent attaching another business's category or item.
- Plan limits (businesses, published storefronts, items, images) are enforced.
- Storage: uploads only into the caller's own folder for a business they own (and an item in it), with a strict filename and extension pattern (no SVG, no `..`, no executables). Other users can't list, update or delete your objects.

## 3. Public vs private data

**Public** (anyone with the link, only while the storefront is published): business name, description, tagline, category, location label, the contact details the owner chose to add (WhatsApp, phone, email, social links, website), logo, cover, theme, and published items with their photos, prices and availability.

**Private**: the account email and name, `owner_id`, drafts, unpublished storefronts, hidden items, onboarding progress and plan.

**Known trade-offs**

- The Storage bucket is **public-read**, so images are served fast from the CDN without signed URLs. Photos of hidden items, or of a storefront that has been unpublished, can still be downloaded by someone who already knows the exact URL. Paths contain random UUIDs and are only discoverable through RLS-protected rows. Owners should delete, not just hide, photos they consider sensitive. Deleting an item or business removes its files.
- Signed-in users can read the full row of *other* businesses that are published, including `owner_id` (a random UUID). Anonymous visitors cannot. Public pages use RPCs that return public fields only.
- `is_slug_available` reveals whether a slug is taken (including by a draft). Only signed-in users can call it.
- The Supabase linter flags `delete_my_account` and `is_slug_available` as `SECURITY DEFINER` functions callable by signed-in users. Both are intentional. `delete_my_account` can only delete `auth.uid()`, and `is_slug_available` returns only a boolean. The `rls_auto_enable()` helper that Supabase ships with new projects has had its API access revoked by migration `20261112090000_advisor_fixes.sql`.

## 4. Upload restrictions

Defence in depth for every uploaded file:

1. **Browser**: type must be JPEG/PNG/WebP, input ≤ 25 MB. Every image is decoded and re-encoded on a canvas, which strips EXIF/GPS metadata and any non-image payload, then capped at 1.5 MB.
2. **Storage bucket**: MIME allow-list (`image/jpeg`, `image/png`, `image/webp`) and a 2 MB file-size limit, enforced by the Storage API.
3. **Storage RLS**: path, filename pattern and ownership checks (§2).
4. **Database**: `catalogue_images.storage_path` and brand image paths must start with the owner's folder for that business or item.

SVG is never accepted (it can carry scripts).

## 5. Web application hardening

- User content is always rendered as text. There is no `dangerouslySetInnerHTML` anywhere. QR SVGs are shown through `<img src="data:…">`.
- Social links are normalised to their real hosts (`instagram.com`, `tiktok.com`, `facebook.com`/`fb.com`), and `website_url` must be `http(s)`. Both the app and DB CHECK constraints enforce this, so `javascript:` URLs can't be stored.
- Phone numbers are normalised to E.164 and validated in the app and the database.
- After sign-in, redirects only follow same-origin paths (`safeRedirect`).
- The share-preview function validates slugs before querying and HTML-escapes every interpolated value. It uses only the anon key and is cached on the CDN, so crawler traffic doesn't reach the database.
- Headers (`vercel.json`): CSP (`default-src 'self'`, scripts from self only, images and API from Supabase, `frame-ancestors 'none'`, `object-src 'none'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a restrictive `Permissions-Policy`. HTTPS is enforced by Vercel.
- Raw database and auth errors are never shown; `lib/utils/errors.ts` maps them to plain messages.
- The query cache is cleared on sign-out (shared-device safety).

## 6. Authentication settings

Production settings are in [DEPLOYMENT.md §3–4](DEPLOYMENT.md#3-configure-authentication): minimum 8 characters with letters and digits, custom SMTP, sensible rate limits, `token_hash` email templates, exact redirect URLs. Also consider leaked password protection and CAPTCHA if abuse appears.

Passwords are handled only by Supabase Auth (bcrypt). The app never stores or logs them.

### Email confirmation is off (owner's decision)

Sign-up gives an immediate session, so an email address on a password account is **not proven** to belong to its user. What that means:

- Someone could register a password account with another person's email before that person joins. The real owner can still take the account back with **Forgot password** once SMTP is set up, or by signing in with Google (below).
- Turning confirmation on later closes this gap. The app already supports it.

### Google sign-in and account linking

- Scopes: Supabase's defaults, `openid email profile`, for name, email and avatar. Nothing else is requested (checked by `npm run db:smoke`). The flow is PKCE, and Google returns only to the Supabase callback URL.
- Supabase links a Google sign-in to an existing account with the same email, because Google verifies that email. It never links on an unverified email: when a provider reports the email as unverified, Supabase creates a separate account instead of linking.
- With confirmation off, the existing account may have been registered by someone who didn't own the email (a "pre-account takeover"). To stop that person keeping access, the callback page calls `public.secure_linked_sign_in()` after every Google sign-in. For each non-email identity created **after** the account's email identity that hasn't been secured yet, the function:
  1. records it in `private.secured_identity_links` (once per identity, under an advisory lock);
  2. removes the account's password (`encrypted_password = null`);
  3. deletes every other session (their refresh tokens stop working).

  The Google owner is told, and can set a new password in Settings. Accounts created with Google first, and email-only accounts, are left alone. The function acts only on `auth.uid()`, isn't callable anonymously, and never blocks sign-in if it fails (it runs again next time).
- Remaining risk: an access token already issued to the other person stays valid until it expires (at most the JWT expiry, 1 hour by default). Refresh is blocked straight away.
- Google sign-in starts only from a button press. The "next page" is kept in the tab's `sessionStorage` (same-origin paths only, 15-minute lifetime), and errors from Google are shown with fixed wording, never raw provider text.

### Re-authentication for account deletion

`delete_my_account()` refuses unless the session's JWT shows a sign-in (`amr` claim) within the last 15 minutes. Password users re-enter their password. Google users are sent through Google again (`prompt=select_account`) and come back to Settings.

### OAuth server (consent page)

If the Supabase OAuth server is enabled, `/oauth/consent` shows the requesting app, its return address and plain-language scopes before **Allow** or **Deny**. Only well-formed `authorization_id` values are sent to Supabase, and only `http(s)` or app-scheme redirects are followed (`javascript:`, `data:` and similar are refused). Users can revoke apps under **Settings → Connected apps**.

## 7. Account and data deletion

- **Delete an item**: the row is deleted first (cascading to image rows), then its files are removed from Storage.
- **Delete a business**: every object under `{owner_id}/{business_id}/` is removed through the Storage API, then the row is deleted (cascading to categories, items and images). Confirmation requires typing the business name.
- **Delete an account**: a recent sign-in (password re-check, or Google re-confirmation for Google accounts, and enforced again in the database) and typing `DELETE`. Then every object under `{owner_id}/` is removed, and `public.delete_my_account()` runs. That `SECURITY DEFINER` function deletes `auth.users` where `id = auth.uid()` (nothing else is possible), cascading to the profile and all data. The local session is cleared.
- No privileged key is used in the browser. An Edge Function alternative is described in [DEPLOYMENT.md §10](DEPLOYMENT.md#10-account-deletion).

## 8. Production security checklist

Based on the Supabase production checklist (<https://supabase.com/docs/guides/deployment/going-into-prod>):

- [ ] Migrations applied with `npm run db:push`, and `npm run db:advisors` shows only the documented warnings (three signed-in-only RPCs, plus leaked-password protection until it is enabled)
- [ ] `npm run db:test:remote` and `npm run db:smoke` pass against the hosted project
- [ ] No `service_role`/secret key in Vercel, the repo or any `VITE_` variable
- [ ] Email confirmation decision reviewed (currently OFF by choice); custom SMTP configured, with SPF, DKIM and DMARC on the sending domain
- [ ] Google: client secret only in the Supabase dashboard; only basic scopes; redirect URI is the Supabase callback only; consent screen **published** (not "Testing")
- [ ] Site URL and redirect URLs restricted to your real domains
- [ ] Auth rate limits reviewed; CAPTCHA and leaked-password protection considered
- [ ] Supabase account protected with MFA; organisation members limited
- [ ] SSL enforcement enabled (`[remotes.production.db.ssl_enforcement]` in `config.toml`); network restrictions considered
- [ ] Backups: a paid plan with daily backups (PITR for critical data) before launch
- [ ] `seed.sql` **not** run in production
- [ ] CSP updated if you use a custom Supabase domain
- [ ] Vercel plan permits commercial use; deployment protection reviewed for preview URLs
- [ ] Privacy Policy and Terms reviewed by a legal professional (e.g. for Kenya's Data Protection Act, 2019)
- [ ] `npm run test` (including database tests) and `npm run test:e2e` pass on the release commit
