# Current Feature

**PokéPal** — a mobile-first, iOS-style Pokémon card companion app for kids
(scan → tag → collect). Rebuilt as a **Next.js 16 + React 19 + TypeScript +
Tailwind v4 + shadcn/ui** app (not a single HTML file). **Local-first**, ships
first as an installable **PWA**, then native **iPhone/iPad/Android** via
**Capacitor**, backed by **Supabase** (Postgres + Auth + Storage).

Overview: @context/project-overview.md · Roadmap: @context/features/feature-roadmap.md

## Status

**🟢 Phase 3 (Card & tile component system) complete.** Project sliced into 13
phases across four tracks (Core app → PWA milestone → Backend → Native).
**Up next: Phase 4 (Navigation & screen transitions).**

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
| 4 | Core | Navigation & screen transitions | `phase-4-navigation-spec.md` | **Up next** |
| 5 | Core | Home screen | `phase-5-home-spec.md` | Not started |
| 6 | Core | Collection screen | `phase-6-collection-spec.md` | Not started |
| 7 | Core | Card detail sheet | `phase-7-detail-sheet-spec.md` | Not started |
| 8 | Core | Scan flow (camera → confirm → tag) | `phase-8-scan-spec.md` | Not started |
| 9 | Core | Favorites & Settings | `phase-9-favorites-settings-spec.md` | Not started |
| 10 | Milestone | PWA — installable + offline (first release) | `phase-10-pwa-spec.md` | Not started |
| 11 | Backend | Supabase backend & Auth | `phase-11-supabase-auth-spec.md` | Not started |
| 12 | Backend | Cloud sync (local ↔ Supabase) | `phase-12-cloud-sync-spec.md` | Not started |
| 13 | Native | Native packaging — Capacitor iOS/iPad + Android | `phase-13-native-capacitor-spec.md` | Not started |

## Up Next — Phase 4 (Navigation & screen transitions)

Wire the phase-1 shell into a working tab router: Home / Collection / Favorites /
Settings screens with the cross-fade + lift transition, active-tab state, Scan
opening a modal (not a tab), tap-active-tab-to-scroll-top, and the navbar
title/border behavior. Full requirements:
@context/features/phase-4-navigation-spec.md

**Open decision before Phase 11:** confirm the kid-safe sign-in method (magic
link vs social, parent-assisted) given App Store kids-category rules.

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
