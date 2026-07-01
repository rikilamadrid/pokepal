# Current Feature

**PokéPal** — a mobile-first, iOS-style Pokémon card companion app for kids
(scan → tag → collect). Rebuilt as a **Next.js 16 + React 19 + TypeScript +
Tailwind v4 + shadcn/ui** app (not a single HTML file). **Local-first**, ships
first as an installable **PWA**, then native **iPhone/iPad/Android** via
**Capacitor**, backed by **Supabase** (Postgres + Auth + Storage).

Overview: @context/project-overview.md · Roadmap: @context/features/feature-roadmap.md

## Status

**🟢 Phase 1 (Foundation) complete & merged.** Project sliced into 13 phases
across four tracks (Core app → PWA milestone → Backend → Native). **Up next:
Phase 2 (Data model & local-first storage layer).**

Locked decisions (2026-06-30): **Supabase** backend (Postgres + Auth + Storage,
RLS; Prisma owns schema/migrations, runtime via Supabase client SDK) and
**Capacitor** native packaging (static bundle) → requires Next.js
`output: 'export'` (no API routes / Server Actions in the shipped app).

### Phase map

| # | Track | Feature | Spec | State |
| --- | --- | --- | --- | --- |
| 1 | Core | Foundation — setup, static export, tokens & static shell | `phase-1-foundation-spec.md` | ✅ Done |
| 2 | Core | Data model & local-first storage layer | `phase-2-data-storage-spec.md` | **Up next** |
| 3 | Core | Card & tile component system | `phase-3-card-system-spec.md` | Not started |
| 4 | Core | Navigation & screen transitions | `phase-4-navigation-spec.md` | Not started |
| 5 | Core | Home screen | `phase-5-home-spec.md` | Not started |
| 6 | Core | Collection screen | `phase-6-collection-spec.md` | Not started |
| 7 | Core | Card detail sheet | `phase-7-detail-sheet-spec.md` | Not started |
| 8 | Core | Scan flow (camera → confirm → tag) | `phase-8-scan-spec.md` | Not started |
| 9 | Core | Favorites & Settings | `phase-9-favorites-settings-spec.md` | Not started |
| 10 | Milestone | PWA — installable + offline (first release) | `phase-10-pwa-spec.md` | Not started |
| 11 | Backend | Supabase backend & Auth | `phase-11-supabase-auth-spec.md` | Not started |
| 12 | Backend | Cloud sync (local ↔ Supabase) | `phase-12-cloud-sync-spec.md` | Not started |
| 13 | Native | Native packaging — Capacitor iOS/iPad + Android | `phase-13-native-capacitor-spec.md` | Not started |

## Up Next — Phase 2 (Data model & local-first storage layer)

Build the headless, local-first data layer: the `Card` type, a persistent
on-device store (Context/zustand → `localStorage`) with `addCard` /
`toggleFavorite` / `releaseCard` / `releaseAll`, seed-on-empty (~10 cards),
the type-gradient map, deterministic generated SVG creature art, duplicate
detection, `nextDexNumber()`, and the 640px/0.78 image-compression util. Shape it
so the phase-12 sync engine bolts on without a rewrite (all access behind store
actions, bump `updatedAt` on mutation). No UI beyond proving the store persists.
Full requirements: @context/features/phase-2-data-storage-spec.md

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
