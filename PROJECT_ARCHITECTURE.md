# Project architecture

This document explains how Showcase is put together and why. For setup see [README.md](README.md); for the threat model see [SECURITY.md](SECURITY.md).

## 1. Overview

```
                      ┌──────────────────────────── Vercel ──────────────────────────────┐
  Visitor / owner ──▶ │ CDN: static SPA from dist/ (immutable hashed assets)              │
                      │ vercel.json rewrites                                               │
                      │   /s/:slug[/:item] + crawler User-Agent ──▶ api/share-preview.ts   │
                      │   everything else (not /api, not /assets) ─▶ /index.html           │
                      └──────────────┬──────────────────────────────────┬──────────────────┘
                                     │ HTTPS, anon key (+ user JWT)     │ HTTPS, anon key only
                                     ▼                                  ▼
                      ┌──────────────────────────── Supabase ────────────────────────────┐
                      │ Auth (email/password, JWT sessions)                               │
                      │ PostgREST → Postgres (RLS on every table, RPC functions)          │
                      │ Storage bucket catalog-media (public read, policy-guarded writes) │
                      └──────────────────────────────────────────────────────────────────┘
```

There is no application server. The browser talks to Supabase directly, and **Row Level Security is the authorisation layer**. The one server-side piece is a Vercel Function that renders Open Graph tags for link-preview crawlers, because those crawlers don't run JavaScript.

## 2. Frontend

### Layers

| Layer | Location | Rules |
|-------|----------|-------|
| Configuration | `src/config` | Brand, URLs and vocabulary (business types, price modes, themes, accents, media limits). One source of truth; DB CHECK values are tested against it. |
| Utilities | `src/lib/utils` | Pure functions with unit tests: phone (E.164, Kenyan formats), slugs, prices, WhatsApp links, social URLs, errors, image pipeline, sharing. |
| Validation | `src/lib/validation` | Zod schemas plus form↔column mapping. They mirror DB constraints, so users get instant feedback. |
| Services | `src/services` | Every Supabase call lives here, with explicit column lists. No React. |
| Hooks | `src/features/*/hooks.ts` | TanStack Query queries and mutations: cache updates, optimistic toggles, invalidation. |
| Components | `src/features/*`, `src/components` | Presentation and interaction only. |

### Routing and bundles

Every route is a lazy chunk (`src/app/router.tsx`). Route groups:

- **Public**: `/`, `/privacy`, `/terms`, `/s/:slug`, `/s/:slug/:itemSlug`. These never import `@supabase/supabase-js`. Storefronts call two RPCs through `lib/supabase/publicApi.ts`, a `fetch` wrapper of about 1 KB.
- **App shell** (`features/auth/AppShell.tsx`): a pathless layout that adds the `AuthProvider` (supabase-js) and the toaster. It covers `/login`, `/signup`, `/forgot-password`, `/auth/confirm`, `/auth/callback` and `/reset-password`, plus, behind `RequireAuth`, `/onboarding`, `/oauth/consent` and `/dashboard/*`.

On `/s/...` URLs, `main.tsx` starts the storefront API requests at boot, in parallel with downloading the route chunk (`features/storefront/prefetch.ts`). `index.html` also preconnects to the Supabase origin. Together these remove a network round-trip on slow mobile connections.

### State

- **Server state** lives in TanStack Query: 60 s stale time, no refetch on window focus (to save data), and retries only for network or 5xx errors. Query keys are centralised in `app/queryClient.ts`. The cache is cleared on sign-out so one account's data is never shown to the next person on a shared phone.
- **Drafts**: unsaved form input is mirrored to `localStorage` (`hooks/useFormDraft.ts`) so a refresh or dropped connection loses nothing. This is a convenience cache only; the database is the source of truth.
- **Current business**: the data model supports many businesses per account. The UI works on one at a time (`pickCurrentBusiness`), provided by the dashboard layout.

### Design system

Tokens are CSS variables in `src/styles/index.css`, mapped into Tailwind with `@theme inline`: warm off-white surfaces, navy ink, muted gold, a sage accent, and semantic danger/success/warning colours. Components live in `src/components/ui`, built on Radix primitives where accessibility matters (dialogs, alert dialogs, dropdown menus). Fonts are DM Sans for body text and Manrope for headings, self-hosted via Fontsource. They are never inlined as `data:` URLs (CSP).

The storefront components use **container queries** (`@container`, `@2xl:`…) instead of viewport breakpoints. The same `StorefrontView` therefore renders correctly full-screen, inside the dashboard's phone preview, and in the landing page's demos.

## 3. Data model

```
auth.users 1──1 profiles ──▶ plans (limits)
                   │
                   └─1──* businesses ─┬─1──* categories
                                      ├─1──* catalogue_items ─1──* catalogue_images
                                      └─ items.category_id ──▶ categories  (ON DELETE SET NULL)
```

Key decisions:

- **Slugs** are lowercase only (CHECK constraint), so a plain unique index is case-insensitive. Reserved words are blocked (`private.is_reserved_slug`). If no slug is given, a trigger generates one from the business name and de-duplicates it (`campus-kicks-2`). Item slugs are unique per business and never change on rename, so shared links keep working.
- **Composite foreign keys** (`(business_id, category_id)`, `(business_id, item_id)`) make it impossible to attach a category or image from another business, even with a valid id.
- **Prices**: `numeric(12,2)` in KES. A CHECK constraint requires a price exactly when the price mode displays one (`fixed`, `starting_from`).
- **Status**: `draft` (never published), `published`, `unpublished` (temporarily hidden). Visibility rules depend only on `status = 'published'`.
- **Plan limits** live in the `plans` table: free = 1 business, 1 published storefront, 300 items, 8 images per item. Triggers enforce them under a per-owner advisory lock, so concurrent requests can't exceed them. A future paid tier is a new row plus `profiles.plan_id`; the frontend only displays limits (`usePlan`).
- **Onboarding progress** is stored on the business (`onboarding_step`, `onboarding_completed_at`).

### Analytics (prepared, not built)

Aggregate counters can be added without touching existing tables: a `storefront_daily_stats(business_id, day, views, item_views, whatsapp_clicks)` table updated by a rate-limited `SECURITY DEFINER` RPC, with no IPs or fingerprints stored. The public pages already route every WhatsApp click through one component (`WhatsAppButton`), which makes it the single place to add tracking.

## 4. Authentication

- Email and password, and **Continue with Google**, with Supabase Auth. Sessions persist in `localStorage` and refresh automatically. `AuthProvider` restores the session before any guard decides anything, so there are no false redirects to `/login`.
- `RequireAuth` sends guests to `/login?next=…`. `GuestOnly` sends signed-in users to `next`, which must be a same-origin path (`safeRedirect` prevents open redirects).
- Email links: the recommended templates (`supabase/templates`) use `token_hash` links to `/auth/confirm`, verified with `verifyOtp`. These work even when the email opens in a different browser or app (common on Android). `/auth/callback` also handles the default PKCE `?code=` links, implicit `#access_token` links, and `error_code` redirects (expired or used links), each with a friendly message.
- When email confirmation is on, sign-up detects an existing account from Supabase's empty `identities` response. It is currently off, so sign-up returns a session and goes straight to onboarding.
- Google (`features/auth/GoogleSignIn.tsx`, `services/auth.service.ts`): the button shows only when `/auth/v1/settings` reports Google enabled. `signInWithOAuth` (PKCE, default scopes, `prompt=select_account`) returns to `<origin>/auth/callback`, and the destination is kept in `sessionStorage` (`takeOAuthState`). The callback exchanges the code, calls `secure_linked_sign_in()` (removes a pre-existing unverified password when Google is first linked; see SECURITY.md §6), then navigates. New Google users get a profile named from Google's `full_name`/`name` (`private.handle_new_user`) and go through onboarding like everyone else.
- `/oauth/consent` (`features/auth/OAuthConsentPage.tsx`, `services/oauth.service.ts`) is the Supabase OAuth 2.1 server's consent screen. Settings → Connected apps lists and revokes grants.
- Account deletion needs a recent sign-in, checked from the JWT `amr` claim inside `delete_my_account()`.
- Errors are mapped to friendly messages in `lib/utils/errors.ts`; raw database or auth messages are never shown.

## 5. Row Level Security

| Table | anon | authenticated (not owner) | owner |
|-------|------|---------------------------|-------|
| `plans` | – | read | read |
| `profiles` | – | – | read, update `full_name` only |
| `businesses` | read published rows, public columns only | read published | full CRUD (owner forced to `auth.uid()`, immutable) |
| `categories` | read for published businesses | same | full CRUD |
| `catalogue_items` | read published items of published businesses | same | full CRUD |
| `catalogue_images` | read images of public items | same | full CRUD |

- Ownership checks use `SECURITY DEFINER` helpers in a `private` schema that PostgREST doesn't expose (`is_business_owner`, `is_business_published`, `is_item_public`). This avoids recursive RLS.
- `anon` has **column-level** `SELECT` grants: `owner_id`, onboarding state and timestamps are unreadable even for published rows.
- All privileges are granted explicitly, so behaviour doesn't depend on a project's default privileges.
- The storefront RPCs (`get_storefront`, `get_storefront_items`, `get_storefront_item`) are `SECURITY INVOKER`, so RLS and column grants still apply. They exist to bundle data into one round-trip, not to bypass anything.

## 6. Storage

- Bucket `catalog-media`: public read, 2 MB file-size limit, MIME allow-list JPEG/PNG/WebP (no SVG), all set by migration.
- Paths: `{owner_id}/{business_id}/brand/{logo|cover|share}-{uuid}.{ext}` and `{owner_id}/{business_id}/{item_id}/{image_id}[-thumb].{ext}`.
- **Insert/update** require the caller's own folder, a business they own and (for item images) an item in that business, plus a strict filename regex (`private.can_write_media_object`).
- **Read via API/delete** only require the caller's own top-level folder (`private.owns_media_object`), so files can be cleaned up after their rows are deleted.
- Database triggers also validate that stored paths start with the correct owner/business/item prefix, so a row can't point at someone else's file.
- Objects are immutable (a new UUID per upload) and uploaded with `Cache-Control: max-age=31536000`, so the CDN and browsers cache them for a year.

## 7. Image pipeline

`src/lib/utils/image.ts`, all in the browser, so no paid Supabase image transformations are needed:

1. Validate type (JPEG/PNG/WebP) and size (≤ 25 MB input).
2. Decode with `createImageBitmap(file, { imageOrientation: 'from-image' })`, falling back to `<img>`. EXIF rotation is respected.
3. Resize on a canvas with high-quality smoothing: main image ≤ 1600 px, card thumbnail ≤ 640 px, logo ≤ 512 px, cover ≤ 1800 px, plus a 1200×630 JPEG **share image** cropped from the cover for social previews.
4. Encode WebP (JPEG fallback where WebP encoding isn't supported, detected from the returned blob type), stepping quality 0.82 → 0.54 until the target is met (~700 KB main, ~120 KB thumbnail). If still above the 1.5 MB hard cap, scale down and retry. Re-encoding strips metadata, including GPS.
5. The owner previews the optimised images, reorders them, sets the cover and removes or replaces images.
6. On save: create or update the item, then upload each image (main + thumbnail) with XHR progress to the documented Storage endpoint. Insert the `catalogue_images` row; if that fails, delete the uploaded files immediately. Failed uploads stay in the editor for retry. The final order is persisted with `reorder_images`.

Rendering: cards use the thumbnail. Every image frame reserves its aspect ratio (no layout shift) and shows a shimmer placeholder. Only the first row loads eagerly with `fetchpriority="high"`; the rest are `loading="lazy" decoding="async"`. The item gallery uses CSS scroll-snap with no carousel library.

## 8. Public storefront and social previews

- `/s/:slug` loads `get_storefront` (header, categories with counts, type counts) and `get_storefront_items` (24 per page, featured first, server-side search with literal `%`/`_`, and category/type filters) in parallel. Filters are kept in the URL (`?q=&category=&type=`).
- `/s/:slug/:itemSlug` loads `get_storefront_item` (all images, category name). Both URLs work on refresh thanks to the SPA rewrite.
- **Crawlers**: `vercel.json` matches the `User-Agent` of known link-preview bots (WhatsApp, facebookexternalhit, Twitterbot, TelegramBot, Slackbot, LinkedInBot, Discordbot…) and rewrites storefront URLs to `api/share-preview.ts`. The function validates the slug, calls the same public RPCs with the anon key, and returns minimal HTML with `og:title`, `og:description`, `og:image` (the 1200×630 share image, cover, logo, item thumbnail or `/og-default.png`), `og:url` and canonical. Every value is HTML-escaped. Responses are cached on Vercel's CDN (`s-maxage=300, stale-while-revalidate`), so crawler bursts never reach the database. Normal browsers never hit the function.
- `scripts/serve.ts` emulates these rules locally (filesystem → functions → rewrites with `has` conditions → headers), and the Playwright suite asserts both the crawler and the browser paths.

## 9. Sharing and QR codes

- Links come from `config/site.ts`, using `VITE_SITE_URL` in production so QR codes and copied links are stable regardless of preview domain.
- Share actions: Clipboard API (with a legacy `execCommand` fallback), the Web Share API when available (falling back to copy), `wa.me/?text=` and the Facebook sharer.
- QR codes (`features/sharing/qr.ts`) lazy-load the `qrcode` library only on the Share page. They use error correction M, a 4-module quiet zone and near-black on white, and download as SVG or 1200 px PNG. The printable card is either a 1200×1650 PNG drawn on canvas or printed directly with print-only CSS. The QR code is regenerated whenever the slug changes, and there is no logo overlay, for scan reliability.

## 10. Security decisions (summary)

- No secrets anywhere in the repo or frontend. Only the public anon/publishable key, and RLS decides everything.
- Ownership is derived in the database (`owner_id := auth.uid()` trigger), never from client input.
- Plan limits, slug rules, price rules and media paths are all enforced in Postgres.
- User content renders as text only (no `dangerouslySetInnerHTML`). Social URLs are normalised to known hosts, and `website_url` must be `http(s)`.
- Strict security headers and a CSP (`vercel.json`).
- Account deletion goes through a `SECURITY DEFINER` function that can only delete `auth.uid()`.

Details and trade-offs: [SECURITY.md](SECURITY.md).

## 11. Testing architecture

| Suite | Tooling | Scope |
|-------|---------|-------|
| Unit / component | Vitest + jsdom + RTL | utilities, schemas, error mapping, storefront rendering & filters, route guards, auth forms, onboarding step, preview adapters, share-preview function and routing rules |
| Database | Vitest + PGlite | migrations applied to real Postgres 17 (WASM) with a Supabase shim (roles, `auth.uid()`, `storage` schema); allowed and denied operations for anon / owner / other user; Storage path policies; plan limits; slugs; RPCs; seed; and an execution of the pgTAP file |
| pgTAP | `supabase test db` | the same core rules on a real Supabase stack |
| E2E | Playwright (desktop + Pixel 7) | production build + Vercel emulation + mock Supabase: marketing, auth, route protection, storefront, item pages, filters, WhatsApp links, social previews, headers, dashboard, catalogue, share/QR downloads, mobile horizontal overflow, console errors |
| E2E (real) | Playwright, opt-in | sign-up → onboarding with a real upload → publish → anonymous view → hide item → account deletion |
