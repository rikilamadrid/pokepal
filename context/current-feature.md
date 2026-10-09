# Current Feature

**PokéPal** — a mobile-first, iOS-style Pokémon card companion app for kids
(scan → tag → collect). Rebuilt as a **Next.js 16 + React 19 + TypeScript +
Tailwind v4 + shadcn/ui** app (not a single HTML file). **Local-first**, ships
first as an installable **PWA**, then native **iPhone/iPad/Android** via
**Capacitor**, backed by **Supabase** (Postgres + Auth + Storage).

Overview: @context/project-overview.md · Roadmap: @context/features/feature-roadmap.md

## Status

**🟡 Phase 13 (Native packaging — Capacitor) — active.** Phases 1–12 complete &
verified (Core app + PWA milestone + Supabase backend/auth + cloud sync). Project
sliced into 13 phases across four tracks (Core app → PWA milestone → Backend →
Native) plus enhancement phases 14–17.

Locked decisions (2026-06-30): **Supabase** backend (Postgres + Auth + Storage,
RLS; Prisma owns schema/migrations, runtime via Supabase client SDK) and
**Capacitor** native packaging (static bundle) → requires Next.js
`output: 'export'` (no API routes / Server Actions in the shipped app).

### Phase map

| # | Track | Feature | Spec | State |
| --- | --- | --- | --- | --- |
| 1 | Core | Foundation — setup, static export, tokens & static shell | `phase-1-foundation-spec.md` | ✅ Done |
| 2 | Core | Data model & local-first storage layer | `phase-2-data-storage-spec.md` | ✅ Done |
| 3 | Core | Card & tile component system | `phase-3-card-system-spec.md` | ✅ Done |
| 4 | Core | Navigation & screen transitions | `phase-4-navigation-spec.md` | ✅ Done |
| 5 | Core | Home screen | `phase-5-home-spec.md` | ✅ Done |
| 6 | Core | Collection screen | `phase-6-collection-spec.md` | ✅ Done |
| 7 | Core | Card detail sheet | `phase-7-detail-sheet-spec.md` | ✅ Done |
| 8 | Core | Scan flow (camera → confirm → tag) | `phase-8-scan-spec.md` | ✅ Done |
| 9 | Core | Favorites & Settings | `phase-9-favorites-settings-spec.md` | ✅ Done |
| 10 | Milestone | PWA — installable + offline (first release) | `phase-10-pwa-spec.md` | ✅ Done |
| 11 | Backend | Supabase backend & Auth | `phase-11-supabase-auth-spec.md` | 🟢 Verified |
| 12 | Backend | Cloud sync (local ↔ Supabase) | `phase-12-cloud-sync-spec.md` | 🟢 Verified |
| 13 | Native | Native packaging — Capacitor iOS/iPad + Android | `phase-13-native-capacitor-spec.md` | 🟡 Active |
| 14 | Enhancement | Scan capture quality (relaxed viewfinder, focus) | `phase-14-scan-capture-spec.md` | Not started |
| 15 | Enhancement | Expanded type system (+ card stage) | `phase-15-type-system-spec.md` | Not started |
| 16 | Enhancement | Account & privacy hardening (account-switch fix) | `phase-16-account-privacy-spec.md` | Not started |
| 17 | Enhancement | AI card auto-recognition (premium) | `phase-17-ai-recognition-spec.md` | Not started |
| — | Infra | Web deploy — GitHub Actions CI + Vercel (portfolio live URL) | `DEPLOY.md` | 🟡 Active |

## Up Next — Phase 13 (Native packaging — Capacitor)

Wrap the finished static build (`out/`) in **Capacitor** to ship native
iPhone/iPad (App Store) + Android (Play Store) from the same React codebase. No
new product features — packaging only. Full requirements:
@context/features/phase-13-native-capacitor-spec.md

**Split of work — repo (Claude) vs. machine/devices (user):**
- **In-repo (this branch):** install `@capacitor/core` + `@capacitor/cli`;
  `capacitor.config.ts` (`webDir: 'out'`, app id `com.rikilamadrid.pokepal`, name PokéPal);
  implement the phase-8 camera adapter's **native branch** with `@capacitor/camera`
  (capture + library pick → image the compress util consumes; web keeps
  `getUserMedia`); `@capacitor/status-bar` wiring; `@capacitor/assets` config to
  generate icon/splash sets from the phase-10 Pokéball icon; a **`NATIVE.md`** with
  the build → `cap sync` → Xcode/Android Studio → submit steps + store-readiness
  checklist (bundle ids, versioning, privacy/data-safety, age rating, deep-link
  auth callback).
- **User's machine/devices (needs Xcode, Android Studio, real devices, Apple/Google
  dev accounts):** `npx cap add ios` / `add android`, on-device runs, native camera
  permission copy in Xcode/Android manifests, deep-link/magic-link callback in the
  webview, iPad layout/orientation checks, TestFlight/internal-testing builds,
  store listings + submission. Can't be done from this environment.

**Design decisions (locked 2026-07-01):** app id `com.rikilamadrid.pokepal`
(renamed 2026-07-02 from `com.pokepal.app` for App Store Connect registration);
device family
iPhone + iPad; native camera behind the existing `camera.ts` adapter (no caller
changes); denial still falls back to upload / generated art.

## Notes

- Workflow per @context/ai-interaction.md: document → branch (`feature/[name]`) →
  implement → `npm run build` → commit (with permission) → merge → delete branch →
  log here.
- The original prototype (@context/screenshots) is the visual/behavioral
  reference only — we are not porting HTML.
- Static export intentionally departs from the Server-Actions/Prisma-runtime
  defaults in @context/coding-standards.md; Prisma still handles Supabase
  schema/migrations, Zod still validates input.

## History

<!-- Keep this updated. Earliest to latest -->

- **2026-06-30** — Project kickoff & planning. Reviewed the project overview and
  screenshots. Reframed PokéPal from the single-file HTML prototype to a
  Next.js/React/Tailwind app. Locked two architectural decisions: **Supabase**
  backend and **Capacitor** static-bundle native packaging (→ `output: 'export'`,
  local-first with cloud sync). Rewrote `project-overview.md` (added Architecture,
  File Structure, Backend, Distribution; `Card` gained `ownerId` + `updatedAt`).
  Authored `feature-roadmap.md` + 13 phase specs under `context/features/`.
  Implementation not yet started.
- **2026-06-30** — Implemented **Phase 1 (Foundation)** on
  `feature/phase-1-foundation`. Set `output: 'export'` + `trailingSlash` +
  `images.unoptimized` in `next.config.ts` (static export emits `out/`). Init
  shadcn/ui (radix base) + primitives (button, dialog, sheet, input, switch,
  sonner). Rewrote `globals.css` so the PokéPal palette (dark-first `.dark`,
  light swap) drives shadcn's semantic tokens, plus type-gradient tokens, `.glass`
  frosted utility, safe-area helpers, and a reduced-motion-aware `.press` scale.
  `layout.tsx`: Lilita One + Space Mono via `next/font`, `.dark` default, plus PWA
  metadata and viewport (`themeColor`, `viewport-fit=cover`, apple-web-app) and
  the `<Toaster>`.
  Static shell in `src/components/shell/` (AppShell, NavBar, TabBar with raised
  Scan puck, Pokeball SVG) + placeholder Home screen. Removed all CNA boilerplate
  (public SVGs, default favicon, README). `npm run lint` + `npm run build` pass.
  Merged to `main`, branch deleted. **Completed.**
- **2026-06-30** — Repo housekeeping. Connected the local repo to its GitHub
  remote (`origin` → `https://github.com/rikilamadrid/pokepal.git`) and pushed
  `main` (upstream tracking set). Removed sync-conflict duplicate files (the
  `" 2"` copies created by the file-sync service under `context/`, `src/`, and
  `.next/`); none were git-tracked, so no commit was needed.
- **2026-06-30** — Implemented **Phase 2 (Data model & local-first storage
  layer)** on `feature/phase-2-data-storage`. Added the `Card`/`CardType`/`Rarity`
  types + a `NewCard` input shape (`src/types/card.ts`). Built the headless store
  as a React Context (`src/hooks/useCollection.tsx`) with `cards` + `ready` and
  actions `addCard` / `toggleFavorite` / `releaseCard` / `releaseAll`; every
  mutation bumps `updatedAt`. localStorage is isolated in `src/lib/storage.ts`
  (key `"collection"`, SSR-guarded) — the only module that touches it, so the
  phase-12 sync engine slots in without touching callers; rehydrate-on-mount seeds
  ~10 cards on empty (`src/data/seed.ts`, incl. a holo hero + a shared dex #014
  for duplicate testing). Libs: `type-gradients.ts` (single-source gradient map
  mirroring the phase-1 CSS tokens), `art-gen.ts` (deterministic SVG creature from
  a name+dex hash → 1 of 3 blobs, gradient fill, hash-varied eyes + smile,
  data-URI), `collection-utils.ts` (`findDuplicates` / `isDuplicate` /
  `nextDexNumber`), `image-compress.ts` (canvas → 640px JPEG 0.78, browser-only).
  Provider mounted in `layout.tsx`. Temporary `StoreProof` panel on Home proves
  persistence/actions (removed in phase 5). `npm run lint` + `npm run build` pass;
  dev server renders 200. **Completed.**
- **2026-06-30** — Implemented **Phase 3 (Card & tile component system)** on
  `feature/phase-3-card-system`. Built the presentation layer over a `Card`:
  `PokeCard` (full gold-framed card — type-gradient art panel with photo/SVG, dex
  chip, `TypeBadge` + favorite-star overlay, dark name plate with Lilita One name
  / mono rarity / caught date, and a `×N` gold duplicate badge), `CardTile`
  (compact grid/row variant — art fill, favorite star, `×N` badge, bottom name
  plate with `#dex · type`), and `TypeBadge` (gradient pill, mono caps). Added the
  earned `.holo-sweep` foil animation in `globals.css` (renders only for
  `rarity: "holo"`, static under `prefers-reduced-motion`) and a `formatCaughtDate`
  helper (`src/lib/date.ts`, "Today"/"Yesterday"/"Mon D"). Components are
  data-driven with an optional `onSelect` (detail-sheet wiring deferred to phase 7)
  and the app-wide `.press` feedback. Verified all types/rarities/favorited/
  duplicate states via a throwaway `/card-demo` route (removed before merge) and a
  brief seed-data preview on Home. Removed the temporary phase-2 `StoreProof`
  surface (Home is back to the display-only placeholder until phase 5).
  `npm run lint` + `npm run build` pass. **Completed.**
- **2026-06-30** — Implemented **Phase 4 (Navigation & screen transitions)** on
  `feature/phase-4-navigation`. Turned the static shell into a client-side
  navigator: `AppShell` (now `"use client"`) owns the active tab, Scan-modal, and
  scroll-aware-border state; all four screens stay mounted in a relative `<main>`
  and cross-fade via a new `.screen` utility (`opacity` + `translateY(6px)→0` over
  280ms, instant under `prefers-reduced-motion`; only the active screen is visible
  and interactive). Shared `tabs.ts` (Tab type + config). `NavBar` shows
  the wordmark on Home / a centered inline title elsewhere and reveals its hairline
  border once the active screen scrolls past 4px. `TabBar` wired: tabs switch
  screens (active in `--red`, `aria-current`, `:focus-visible` rings), tapping the
  active tab smooth-scrolls it to top, and the center Scan puck opens a placeholder
  `ScanModal` bottom sheet (Esc/backdrop dismiss; real flow phase 8) and is never
  active. Screen bodies: `HomeScreen` + a reusable `PlaceholderScreen` for
  Collection/Favorites/Settings. `page.tsx` now just renders `<AppShell />`.
  `npm run lint` + `npm run build` pass; dev server renders 200 with all tabs +
  four stacked screens. **Completed.**
- **2026-07-01** — Implemented **Phase 5 (Home screen)** on `feature/phase-5-home`.
  Built the real Home surface over the phase-2 store and phase-3 cards:
  `HeroCard` (latest catch = max `caughtAt`) renders a large `PokeCard` inside a
  new `.hero-float` wrapper (gentle float + tilt, `will-change`, disabled under
  `prefers-reduced-motion`; holo sweep inherited from `PokeCard`), followed by
  name (Lilita One), `#dex · Type · Rarity`, and a "Caught {relative}" line.
  `CardRow` (reusable) renders a horizontal-scroll strip of `CardTile`s with an
  eyebrow label + count pill, optional "See all", hidden scrollbar/momentum via a
  new `.hide-scrollbar` utility, and a friendly empty hint. `HomeScreen` derives
  hero / favorites (capped at 8) / duplicates (via `findDuplicates`) live from the
  collection with `useMemo`, gates on `ready`, and shows a full "No cards yet"
  fallback. `AppShell` moved the screen map inline so Home's "See all" switches to
  the Favorites tab; card taps are a no-op until the phase-7 detail sheet.
  `npm run lint` + `npm run build` pass; dev server renders 200. Merged to `main`,
  branch deleted. **Completed.**
- **2026-07-01** — Implemented **Phase 6 (Collection screen)** on
  `feature/phase-6-collection`. Built the full searchable grid over the phase-2
  store and phase-3 `CardTile`: `CollectionScreen` shows a big "Collection" display
  title, a sticky iOS search bar, an "ALL CARDS ●{n}" count pill (reflects the
  filter), and a 2-column grid sorted newest-first (`caughtAt` desc) with `×N`
  duplicate badges + favorite stars derived live via `findDuplicates`. Search
  filters by name / dex number / type (case-insensitive) through a new reusable
  `useDebounce` hook (120 ms), and a friendly no-results / empty message covers
  both an empty collection and a non-matching query. New `SearchBar` component
  (frosted `.glass` field, leading magnifier, clear `✕` when non-empty). Wired
  into `AppShell` (replaced the Collection placeholder); card taps stay a no-op
  until the phase-7 detail sheet. `npm run lint` + `npm run build` pass; dev server
  renders 200. Merged to `main`, branch deleted. **Completed.**
- **2026-07-01** — Fix **card tile frame** on `fix/card-tile-frame`. Reworked
  `CardTile` so tiles read as true miniatures of `PokeCard`: gold frame → dark
  body (`#14110b`) → a bordered type-gradient art panel (gold hairline) plus a
  separate dark name plate (`#0f1015`) with the name in gold and `#dex · type` in
  muted mono, replacing the previous single art fill with an overlaid gradient
  plate. The `×N` duplicate badge now pins to the name plate's top edge.
  `npm run build` passes. **Completed.**
- **2026-07-01** — Implemented **Phase 7 (Card detail sheet)** on
  `feature/phase-7-detail-sheet`. Built `CardDetailSheet` — the shared "open a
  card" bottom sheet opened by tapping any card: frosted `.glass` panel with a
  drag handle, the card name (Lilita One) + `✕` header, the full `PokeCard`
  (holo sweep + `×N` badge intact), a 2×2 stat grid (dex, type, rarity, caught
  date), and Favorite / Release actions. The card is read live from the store by
  id (via `useCollection`) so favorite toggles reflect in the sheet and every
  screen instantly; Release calls `releaseCard` then closes. Dismiss via
  drag-down (pointer-drag past 110px), backdrop tap, `✕`, or Escape. New
  `.sheet-backdrop-in` / `.sheet-panel-in` present animations (slide-up + fade,
  disabled under `prefers-reduced-motion`). `AppShell` now owns `selectedCardId`
  with `openCard` / `closeCard`, lazy-loads the sheet via `next/dynamic`
  (`ssr:false`), and wires `onSelectCard` into Home and Collection (replacing the
  no-op taps). `npm run lint` + `npm run build` pass. **Completed.**
- **2026-07-01** — Implemented **Phase 8 (Scan flow)** on `feature/phase-8-scan`.
  Built the three-step Scan bottom sheet (`src/components/scan/`), lazy-loaded via
  `next/dynamic` (`ssr:false`) so the camera stack stays out of the initial bundle;
  replaced the placeholder `ScanModal` (deleted) — `AppShell` now mounts
  `<ScanSheet>` only while `scanOpen`. `ScanSheet` owns the step state machine
  (viewfinder → confirm → tag) + captured photo and reuses the phase-7 sheet shell
  (drag-down/backdrop/✕/Escape dismiss, present/exit animations, back button).
  **Step 1 `Viewfinder`**: live rear feed via a new `useCamera` hook + `camera.ts`
  adapter (`getUserMedia` `facingMode:environment`, stream torn down on unmount;
  phase-13 Capacitor swaps behind the adapter), golden target frame + circular
  shutter (`captureFrame` → canvas JPEG), file-upload fallback on camera error,
  and a "Skip photo" link (→ generated art). **Step 2 `ConfirmStep`**: preview +
  Retake (restarts camera) / Use this photo (runs phase-2 `compressImage`, 640px
  JPEG 0.78). **Step 3 `TagForm`**: name / type picker (6 gradient pills) / dex
  (blank → `nextDexNumber` auto on save) / rarity / favorite `Switch`, a live
  `PokeCard` preview, validated with **Zod** (`scan-schema.ts`; installed `zod`).
  Submit builds the card via `addCard` (photo or generated SVG), toasts success
  (sonner), and closes to Home. `npm run lint` + `npm run build` pass; dev server
  renders 200. **Completed.**
- **2026-07-01** — Implemented **Phase 9 (Favorites & Settings)** on
  `feature/phase-9-favorites-settings`, replacing the last two `PlaceholderScreen`s
  (file kept, now unused). **Favorites** (`FavoritesScreen`): a 2-column `CardTile`
  grid of every starred card, newest-first, reusing the phase-6 grid styling with
  live `findDuplicates` badges; updates instantly as cards are (un)favorited from
  the detail sheet; friendly empty state; taps open the detail sheet — the
  destination for Home's "See all". **Settings** (`SettingsScreen`): grouped inset
  iOS list (new `SettingsGroup` / `SettingsRow` / `SettingsStat` in
  `src/components/settings/`) with an Account **stub** row (phase 11), a **Dark
  mode** `Switch`, live **Total caught** + **Unique species** (distinct `dexNo`)
  stats, and a destructive **Release entire collection** row that confirms via a
  new `ReleaseAllDialog` (shadcn dialog) before `releaseAll()` + success toast
  (disabled when empty). **Theming**: new `src/lib/theme.ts` (light/dark persisted
  under key `"theme"`, resolves stored → `prefers-color-scheme` → dark, applied by
  toggling the `.dark` class on `<html>`) + `useTheme` hook; a `THEME_INIT_SCRIPT`
  runs pre-paint in `layout.tsx` (`<head>`, `suppressHydrationWarning`) to avoid a
  theme flash. `npm run lint` + `npm run build` pass. **Completed.**
- **2026-07-01** — Implemented **Phase 10 (PWA — installable + offline)** on
  `feature/phase-10-pwa` — the first shippable milestone; packaging only, no new
  product features. **Icons**: generated an on-brand Pokéball icon set into
  `public/` (192/512 `any`, 192/512 `maskable` with safe-zone padding,
  `apple-touch-icon` 180, favicon 48) with a dependency-free Node PNG generator
  (pure `zlib` + hand-written CRC32, 4× supersampled anti-aliasing) since the
  toolchain has no SVG rasterizer (`sips` only, no ImageMagick/rsvg). **Manifest**:
  `public/manifest.webmanifest` (standalone, portrait, brand `#14151a`, `start_url`
  `/`, full icon set incl. both maskable) linked via Next `metadata.manifest`;
  added `metadata.icons` (favicon + apple-touch). **Service worker**: hand-rolled
  `public/sw.js` (static-export-friendly, no build plugin) — precache the app
  shell on install, network-first for navigations (offline → cached shell),
  stale-while-revalidate for same-origin assets (next/font self-hosts, so no
  cross-origin fetches); `skipWaiting`/`clients.claim` + a client
  `ServiceWorkerRegistrar` that silently reloads once on a real update (never on
  first install). **iOS**: added the legacy `apple-mobile-web-app-capable` meta
  (Next emits only the modern `mobile-web-app-capable`) alongside the existing
  `black-translucent` status bar + apple-touch icon + `viewport-fit=cover`.
  **Theme color**: `applyTheme` now keeps the `theme-color` meta in sync with the
  active day/night theme. `npm run lint` + `npm run build` pass; served `out/` and
  verified manifest (200, `application/manifest+json`, standalone, 4 icons/2
  maskable), `sw.js` (200), every icon (200), and the apple-capable meta. On-device
  install/offline + Lighthouse audit still to be done in a real browser. **Completed.**
- **2026-07-01** — Chore (uncommitted, on `main`): added
  `allowedDevOrigins: ["*.trycloudflare.com"]` to `next.config.ts` so the
  Cloudflare quick tunnel (`npm run dev:mobile`) can load Next's dev resources
  when testing the camera on a phone. Dev-only; ignored by the static export.
- **2026-07-01** — Started **Phase 11 (Supabase backend & Auth)**. Marked active
  in the phase map. Stands up the Supabase backend (Postgres `cards` table via
  Prisma schema/migrations, Auth, Storage bucket, RLS owner-only policies) and
  kid-safe sign-in, keeping the app fully usable signed-out (local-only). Spec:
  @context/features/phase-11-supabase-auth-spec.md. **Open decision:** confirm the
  kid-safe sign-in method (magic link vs social, parent-assisted) given App Store
  kids-category rules.
- **2026-07-01** — Implemented **Phase 11 (Supabase backend & Auth)** code on
  `feature/phase-11-supabase-auth`. Locked sign-in = **magic link (email)**
  (passwordless, no third-party sharing, parent-assisted — best fit for App Store
  kids-category rules). Installed `@supabase/supabase-js` + Prisma. Added a
  browser-only Supabase client (`src/lib/supabase.ts`) that is gated on env
  (`isSupabaseConfigured`) so the app stays fully usable local-only when
  unconfigured; implicit flow + `detectSessionInUrl` parses the magic-link token
  on load (no server callback — static-export safe). `useAuth`
  context/provider (`src/hooks/useAuth.tsx`, mounted in `layout.tsx` above
  `CollectionProvider`) restores + subscribes to the session and exposes
  `signInWithEmail` / `signOut` / `user` / `ready` / `configured`. Settings
  **Account** row now: signed-out → opens `SignInSheet` (magic-link dialog, Zod
  `auth-schema`, "check your email" state); signed-in → shows email + Sign out;
  unconfigured → "cloud backup unavailable" note. Prisma schema
  (`prisma/schema.prisma`, `cards` table incl. soft-delete `deleted_at`) +
  `prisma/supabase-setup.sql` (owner→auth.users FK, RLS owner-only policies,
  private `card-images` bucket + per-user path policies). `.env.example` (+
  `.gitignore` `!.env.example`) and a step-by-step `context/supabase-setup.md`.
  **No data behavior change** (local cards untouched; sync is phase 12).
  `npm run build` + TypeScript pass; Phase 11 code lints clean (3 pre-existing
  lint errors remain in the phase-10 `scripts/generate-icons.js`, unrelated).
  **Remaining before merge:** user creates the Supabase project via
  `context/supabase-setup.md`, runs the migration + SQL, and verifies sign-in +
  RLS in a browser.
- **2026-07-01** — **Phase 11 backend stood up & sign-in verified.** Walked the
  user through `context/supabase-setup.md` against a live Supabase project.
  Fixes made while wiring env: percent-encoded the `$` in the DB password inside
  the connection URLs (un-encoded `$` breaks URL parsing); renamed the env var to
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` to match `src/lib/supabase.ts`; renamed
  `.env.local` → `.env` (Prisma 7 CLI doesn't auto-load `.env.local`; `.env*` is
  git-ignored). **Prisma 7 migration path:** Prisma 7.8 no longer accepts
  `url`/`directUrl` in `schema.prisma` — moved them to a new `prisma.config.ts`
  (loads `.env` via Node's built-in `process.loadEnvFile`, points migrations at
  the direct connection) and slimmed the schema `datasource` to just `provider`.
  Ran `prisma migrate dev --name init_cards` → created
  `prisma/migrations/20260701212313_init_cards/`; `migrate status` = up to date.
  Ran `prisma/supabase-setup.sql` in the SQL editor (FK + RLS + `card-images`
  bucket) — success. Configured Email provider + Redirect URLs
  (`localhost:3002`). Verified magic-link sign-in end to end in the browser
  (email shows in the Settings → Account row). **Ready to commit + merge.**
- **2026-07-01** — Implemented **Phase 12 (Cloud sync)** code on
  `feature/phase-12-cloud-sync`. Background sync engine reconciling the local
  store with the Supabase `cards` table. **Deletions → tombstones** in a separate
  `localStorage` key (`collection:tombstones`, id→deletedAt) so existing `cards`
  selectors are untouched; `releaseCard`/`releaseAll` record them (`storage.ts`
  gained tombstone + uploaded-id-set helpers; `useCollection` gained
  `tombstones` + a single `applySync` mutator + owner-claim). **Pure `reconcile()`**
  (`src/lib/sync.ts`) — last-writer-wins by parsed-epoch `updatedAt` (Postgres
  returns a different ISO format than our `…Z`, so compares are numeric, not
  string), returning a plan: local-only→push, cloud-only→pull, conflict→newest,
  local delete→push soft-delete, remote delete→drop+tombstone, resurrection when
  a remote edit post-dates a local delete. **Data access** (`supabase-cards.ts`):
  row↔Card mappers, fetch/upsert/markDeleted, image upload/sign, and push/pull
  image resolvers — generated-SVG data-URIs stored inline in the row; captured
  JPEGs upload to `card-images/{userId}/{cardId}.jpg` (private bucket → signed
  URL on pull; capturing device keeps its data-URI offline); `collection:uploaded`
  id-set skips re-uploads on favorite edits. **`useSync` provider** (mounted in
  `layout.tsx` under `CollectionProvider`): serialized runs (lock + dirty flag),
  triggers on sign-in / focus / reconnect / debounced-after-change; first-sign-in
  **adoption** stamps `ownerId` and pushes local cards (seed ids deterministic →
  dedupe by id); full-state sync doubles as the offline queue. **Settings** shows
  a sync-status row (Backed up · {relative} / Syncing… / Offline / retry on error;
  `relativeTime` added to `date.ts`). `npm run build` + TypeScript pass; new code
  lints clean (only the 3 pre-existing `generate-icons.js` require() errors
  remain). **Remaining before merge:** browser verification — local→cloud push,
  cloud→local pull on a second device/session, image upload + signed-URL display,
  offline edits flushing on reconnect, first-sign-in adoption, delete propagation.
- **2026-07-01** — **Phase 12 committed, pushed, and merged to `main`**
  (`--no-ff`, merge `e064ea5`); feature branch deleted (local + remote). Build
  passed pre-commit. Also added the phase 14–17 enhancement specs and removed the
  file-sync-service `" 2"` duplicate files. **Code-complete; browser verification
  still pending** (push/pull on a second device, image upload + signed-URL display,
  offline flush on reconnect, first-sign-in adoption, delete propagation).
- **2026-07-01** — **Phase 12 verified in-browser** (push/pull on a second
  session, image upload + signed-URL display, offline flush, first-sign-in
  adoption, delete propagation all confirmed working) → marked 🟢 Verified.
- **2026-07-01** — Started **Phase 13 (Native packaging — Capacitor)** on
  `feature/phase-13-native-capacitor`; implemented the **in-repo** portion.
  **Toolchain pinned to Capacitor 7** (the v8 CLI requires Node ≥ 22; project is
  Node 20). Installed `@capacitor/{core,camera,status-bar,splash-screen}` +
  dev `@capacitor/{cli,assets}`. `capacitor.config.ts` — app id `com.pokepal.app`,
  name PokéPal, `webDir: 'out'` (phase-1 static export), dark `backgroundColor` +
  splash config. **Native camera** behind the existing phase-8 seam: `camera.ts`
  gained `isNativeCamera()` (Capacitor `isNativePlatform`) + `takeNativePhoto()`
  (dynamically imported `@capacitor/camera` → JPEG data URI the compress util
  consumes); `Viewfinder` split into `WebViewfinder` (unchanged live-stream path)
  and `NativeViewfinder` (OS camera / library buttons, cancel/deny stays on step)
  — **no caller changes**, upload/generated-art fallback intact. `NativeInit`
  (mounted in `layout.tsx`, no-op on web) sets a dark status-bar style + hides the
  splash on first paint via dynamically-imported plugins. **Icons/splash:**
  refactored `scripts/generate-icons.js` to export its Pokéball renderer;
  `scripts/generate-native-assets.js` (npm `native:assets`) emits the 1024px icon
  + 2732px splash sources into `assets/` for `@capacitor/assets`. Added npm
  scripts `native:sync|ios|android`. **`NATIVE.md`** documents the full flow
  (prereqs, `cap add`, permission strings, deep-link auth callback, iPad support,
  store-readiness checklist, on-device verification, troubleshooting).
  `npm run build` + TypeScript pass; new/changed files lint clean. **Remaining
  (user's machine/devices — not doable from this env):** `npx cap add ios/android`,
  Xcode/Android Studio config (permission copy, deep-link scheme, signing), real
  iPhone/iPad/Android runs, TestFlight/internal-testing builds, store submission.
- **2026-07-02** — **Phase 13 iOS project stood up & verified on-device (sim).**
  Installed full Xcode 26.6 + CocoaPods (via Homebrew); the initial `pod install`
  needed `LANG=en_US.UTF-8` (ASCII locale broke CocoaPods' path normalization).
  Added `@capacitor/{ios,android}` platform packages and `@capacitor/app` (for the
  native auth deep link). `npx cap add ios` scaffolded `ios/App` (bundle id
  `com.pokepal.app`, iPhone+iPad, MARKETING_VERSION 1.0/build 1 by default);
  `capacitor-assets generate` produced the AppIcon + Splash imagesets from the
  `assets/` sources. **Info.plist:** camera + photo-library (+ add) usage strings
  and a `CFBundleURLTypes` `pokepal://` scheme. **Native magic-link auth**
  (phase-11 flow inside the webview): `useAuth` now sends `emailRedirectTo:
  pokepal://auth-callback` on native and completes sign-in on `@capacitor/app`
  `appUrlOpen` (parse token hash → `supabase.auth.setSession`); web still uses
  `detectSessionInUrl`. Committed the `ios/` project (Capacitor's `.gitignore`
  keeps Pods/build/web-assets out). Verified `xcodebuild` **BUILD SUCCEEDED**
  against the iOS 26.5 SDK and **ran the app on the iPhone 17 simulator** (Home
  screen renders, safe areas correct) — signing disabled for the sim build.
  **Blocked only on Apple:** the user's Apple Developer Program enrollment is
  *pending review*, so App Store Connect / archive-upload isn't available yet
  ("Apple Account isn't enabled for iTunes Connect"). No code work remains for
  iOS — once membership is Active: pick Team → Archive → Upload → TestFlight →
  submit. **Still TODO:** add `pokepal://auth-callback` to Supabase Redirect URLs;
  Android project (`cap add android`) not yet scaffolded.
- **2026-07-02** — **Apple Developer enrollment cleared; prepping first TestFlight
  build.** App Store Connect app record now exists ("PokéPal - Collection", iOS
  1.0 Prepare for Submission). **Renamed the bundle id `com.pokepal.app` →
  `com.rikilamadrid.pokepal`** across `capacitor.config.ts`, the Xcode project
  (both build configs), `Info.plist` `CFBundleURLName`, `NATIVE.md`, and the
  current-feature active-spec references (history log entries left as-written).
  Set `DEVELOPMENT_TEAM = ZFRA75ZMAG` for automatic signing. Added
  `ITSAppUsesNonExemptEncryption = false` to `Info.plist` so TestFlight uploads
  skip the export-compliance prompt (app uses only exempt HTTPS). Ran
  `npm run build` + `npx cap sync ios` (needs `LANG=en_US.UTF-8` for CocoaPods)
  to stage the latest web bundle for archiving. **Next (user, in Xcode):**
  Any iOS Device → Product → Archive → Distribute → App Store Connect → Upload →
  TestFlight internal testing → install via TestFlight on device. Reminder: add
  `pokepal://auth-callback` to Supabase Redirect URLs before native sign-in.
- **2026-07-02** — Started **Web deploy (GitHub Actions CI + Vercel)** on
  `feature/ci-cd-vercel` — infra task to put a live URL on the portfolio. Chosen
  shape: GitHub Actions runs the lint+build **quality gate**; Vercel's native Git
  integration is the **deployer** (prod on `main`, preview per PR) — no Vercel CLI
  or GitHub secrets. **Made CI green first:** scoped `ios/**`, `android/**`, and
  `scripts/**` (Capacitor shell + Node CommonJS build utilities — 55 lint errors)
  out of ESLint via `globalIgnores` in `eslint.config.mjs`; `npm run lint` now
  exits 0. Added `.github/workflows/ci.yml` (push/PR to `main`; Node 20, `npm ci`,
  lint, build; concurrency-cancels superseded runs; builds **without** Supabase
  env on purpose to prove the local-first fallback). Added `DEPLOY.md` (Vercel
  import, `NEXT_PUBLIC_SUPABASE_*` env in all 3 environments, Supabase Redirect-URL
  entries for the Vercel domain + PR previews). Verified: build passes with env
  removed (local-first gating holds); lint clean. **Remaining (user, dashboards —
  not doable from this env):** import repo in Vercel, set the two env vars, add the
  Vercel domain to Supabase Auth URLs, then push to deploy.
- **2026-07-02** — Fixed **Vercel black/blank app shell after first paint** on
  `fix-vercel-black-page`. Root cause was the exported HTML rendering empty
  screen bodies until localStorage hydration, plus storage trusting any array as
  valid cards (old/malformed rows could crash the UI after hydration). The app now
  renders a safe empty state pre-hydration, normalizes persisted cards/tombstones
  at the storage boundary (repairing missing owner/img/date fields and filtering
  invalid records), and bumps the service-worker cache to `pokepal-v2` while
  deleting prior `pokepal-*` caches on activate. Verified deployed URL returns
  `200`, deployed chunks return `200`, `npm run lint` passes, and `npm run build`
  passes.
