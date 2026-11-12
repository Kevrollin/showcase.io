# Showcase

> **Everything you sell or do, in one simple link.**

Showcase is a digital storefront and portfolio builder for student entrepreneurs, freelancers and small local businesses. An owner signs up, answers a few guided questions, adds products, services or previous work from their phone, and gets a fast public storefront at `/s/their-business` — with a QR code and one-tap WhatsApp enquiries.

**Create → Showcase → Share → Get enquiries.**

---

## Features

| Area | What's included |
|------|-----------------|
| Marketing site | Landing page (hero with a live storefront demo, problem, solution, how it works, audiences, product preview, benefits, CTA), Privacy Policy, Terms |
| Accounts | Email + password and **Continue with Google** (basic profile and email only, safe account linking), sign-out, optional email confirmation, forgot/reset password, persistent sessions, protected routes, friendly error messages, OAuth consent page for "Sign in with Showcase" apps |
| Onboarding | 6-step guided wizard (type → identity → contact → appearance → first items → preview & publish), saved after every step, resumable, drafts survive refreshes |
| Catalogue | Products, services and portfolio items; fixed / "from" / quote / contact / hidden prices (KES); availability; featured; publish/hide; search & filters; duplicate; reorder; delete with confirmation |
| Images | In-browser resize + WebP compression (JPEG fallback), thumbnails, previews, progress, reorder, set cover, replace, retry, orphan clean-up |
| Categories | Create, rename, reorder, delete with item reassignment (items are never deleted with a category) |
| Storefront | 4 themes × 8 accent colours, logo, cover, tagline, search, category/type filters, item pages with gallery, WhatsApp/call/email/social contact, load-more pagination |
| Sharing | Copy link, native share, WhatsApp, Facebook, per-item links, QR code (PNG/SVG), printable QR card |
| Social previews | Crawler-specific Open Graph HTML from a Vercel Function (`api/share-preview.ts`) |
| Settings | Business & contact details, link (slug) change with warning, publish/unpublish/restore, password change, delete business, delete account |
| Security | RLS on every table, column-limited anonymous access, Storage path policies, plan limits enforced in Postgres, no secrets in the frontend |

Out of scope for v1 (by design): carts, checkout, payments, delivery, customer accounts, marketplace discovery, reviews, custom domains, staff accounts, AI features.

## Technology

- **Frontend:** React 19, TypeScript 6, Vite 8, Tailwind CSS 4, Radix UI primitives (shadcn-style components), Lucide icons, React Router 8, TanStack Query 5, React Hook Form + Zod 4, Sonner toasts, `qrcode`
- **Backend:** Supabase (Auth, Postgres with RLS, Storage, SQL migrations)
- **Hosting:** Vercel (static SPA + one Node.js function for share previews)
- **Testing:** Vitest + React Testing Library, PGlite (real Postgres in WASM) for RLS tests, pgTAP for `supabase test db`, Playwright for end-to-end

## Project structure

```text
api/
  share-preview.ts          Vercel Function: Open Graph HTML for link-preview crawlers
public/                     favicon, social image, manifest, robots.txt
scripts/
  serve.ts                  Local Vercel emulation (+ mock Supabase) for E2E tests
  build-e2e.ts              E2E production build
  generate-assets.ts        Renders PNG icons and the default social image
  screenshots.ts            Captures screenshots of key screens
src/
  app/                      router, query client, root layout
  components/ui/            design-system primitives (button, inputs, dialogs, …)
  components/shared/        logo, error screens, media image, brand icons
  config/                   brand, site URLs, catalogue vocabulary & themes (single source of truth)
  features/
    auth/                   provider, guards, auth pages
    onboarding/             wizard + steps
    dashboard/              layout, overview, checklist
    catalogue/              list, item editor, image manager
    categories/             category management
    settings/               appearance + settings pages
    sharing/                share page, QR generation
    storefront/             public storefront, item page, presentation components
    marketing/              landing + legal pages
    businesses/ media/      shared business forms, slug check, brand image upload
  hooks/                    page meta, drafts, debounce, hash scroll
  lib/
    supabase/               supabase-js client (signed-in areas) + tiny public REST client
    utils/                  phone, slug, price, WhatsApp, social, image pipeline, errors, share
    validation/             Zod schemas
  services/                 all Supabase calls (no React)
  types/                    generated DB types + domain models/parsers
supabase/
  migrations/               schema, business rules, RLS, API functions, Storage
  tests/database/           pgTAP tests (supabase test db)
  templates/                auth email templates (token_hash links)
  config.toml, seed.sql     local development
tests/
  db/                       RLS/Storage/RPC tests on PGlite
  api/                      share-preview + routing tests
  e2e/                      Playwright specs, fixtures, helpers
```

## Getting started

Requirements: **Node.js 22.22+** (24 recommended), npm. For a local Supabase stack you also need Docker.

```bash
npm install
cp .env.example .env.local      # then fill in the values below
npm run dev                     # http://localhost:5173
```

### Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_SUPABASE_URL` | browser | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | browser | Public anon / publishable key (never a secret key) |
| `VITE_SITE_URL` | browser | Canonical site URL for links, QR codes and auth redirects (empty = current origin) |
| `VITE_CONTACT_EMAIL` | browser | Optional public contact address in the footer and legal pages |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Vercel Function | Same public values, for share previews |
| `SITE_URL` | Vercel Function | Canonical URL used in preview HTML |

Only public values are used anywhere. **Never** put a `service_role` / secret key in this project.

### Option A — local Supabase (Docker)

```bash
npm run db:start                 # starts Postgres, Auth, Storage, Studio, Inbucket (emails)
npm run db:reset                 # applies migrations + seed.sql
# copy the printed API URL and anon key into .env.local
npm run dev
```

Seeded demo: `demo@showcase.test` / `demo-password-1`, storefront `/s/kelvin-designs`. Auth emails appear in Inbucket at http://localhost:54324.

### Option B — a hosted Supabase project

Create a project, then apply the migrations (see [DEPLOYMENT.md](DEPLOYMENT.md)):

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npm run db:push
npx supabase config push   # auth + storage settings (see DEPLOYMENT.md section 3)
```

### Option C — no backend (UI work only)

`npm run serve:local` builds the app against a mock Supabase API (fixtures in `tests/e2e/fixtures.ts`) and serves it at http://127.0.0.1:4173 with the same routing and headers as Vercel. Sign in with `owner@example.com` / `correct-horse-9`; the storefront is at `/s/campus-kicks`.

## Database

Migrations live in `supabase/migrations` and are the only way the schema changes:

| Migration | Contents |
|-----------|----------|
| `…090000_core_schema.sql` | `plans`, `profiles`, `businesses`, `categories`, `catalogue_items`, `catalogue_images`, constraints, indexes, `updated_at` triggers |
| `…090100_business_rules.sql` | ownership from `auth.uid()`, slug generation/normalisation, plan limits, media path validation |
| `…090200_rls_policies.sql` | RLS policies, explicit table/column privileges |
| `…090300_api_functions.sql` | storefront RPCs, slug availability, reorder helpers, `delete_my_account` |
| `…090400_storage.sql` | `catalog-media` bucket and Storage object policies |

After changing migrations, push them (`npm run db:push:dry`, then `npm run db:push`) and regenerate types: `npm run db:types:remote` (or `npm run db:types` against a local stack). Supabase CLI 3 targets the local stack unless a command is given `--remote`; the npm scripts handle this.

## Testing

| Command | What it runs |
|---------|--------------|
| `npm run lint` | ESLint (TypeScript, React Hooks, React Refresh) |
| `npm run typecheck` | `tsc -b` across app, scripts, tests and the Vercel function |
| `npm run test` | Unit + component tests (jsdom) and database tests (PGlite) |
| `npm run test:db` | Only the database suite: migrations, RLS, Storage policies, RPCs, plan limits, seed, pgTAP file |
| `npm run test:e2e` | Playwright on desktop Chrome and a Pixel 7 profile, against the production build with Vercel routing emulated and Supabase mocked |
| `npm run test:e2e:real` | Opt-in full journey against a real Supabase project (see `playwright.real.config.ts`) |
| `npm run db:test` | pgTAP tests against the local Supabase stack (Docker) |
| `npm run db:test:remote` | The same pgTAP suite against the linked hosted project, without Docker (rolled back) |
| `npm run db:smoke` | Public-API smoke test of the hosted project (what an anonymous browser can and cannot do) |
| `npm run db:advisors` | Supabase security/performance advisors for the hosted project |
| `npm run e2e:user` | Creates a disposable confirmed user for `test:e2e:real` (the test deletes it) |
| `npm run check` | lint + typecheck + test + build |

First-time Playwright setup: `npm run test:e2e:install`.

## Building and deploying

```bash
npm run build      # type-checks, then writes the static site to dist/
npm run preview    # serves dist/ (SPA only; use `npm run serve:local` to emulate Vercel)
```

Deployment, Supabase configuration, SMTP, domains and the go-live checklist: **[DEPLOYMENT.md](DEPLOYMENT.md)**.
Architecture: **[PROJECT_ARCHITECTURE.md](PROJECT_ARCHITECTURE.md)**. Security model: **[SECURITY.md](SECURITY.md)**.

## Renaming the product

Brand values live in `src/config/brand.ts` (also used to fill `index.html`). Two copies must be kept in sync and are checked by tests or are static files: `PREVIEW_BRAND` in `api/share-preview.ts` (asserted by `tests/api/share-preview.test.ts`), and `public/site.webmanifest`, `public/favicon/*`, `public/og-default.png` (regenerate PNGs with `npm run assets`). Email subjects/templates are in `supabase/config.toml` and `supabase/templates/`.
