# PokéPal — Feature Roadmap

PokéPal is a mobile-first, iOS-style Pokémon card companion app for kids: scan a
card, tag it, and browse a collection. It is a **Next.js 16 (App Router) + React
19 + TypeScript + Tailwind CSS v4 + shadcn/ui** app — *not* a single HTML file.
It is **local-first** (works offline against on-device storage), ships first as
an **installable PWA**, then as **native iPhone/iPad/Android apps via Capacitor**,
backed by **Supabase** (Postgres + Auth + Storage) for accounts and cloud sync.

See @context/project-overview.md for the full architecture and
@context/coding-standards.md for the stack rules. The original prototype
(@context/screenshots) is the visual & behavioral reference only.

Each phase is its own spec + branch (`feature/[name]`) and follows the workflow
in @context/ai-interaction.md (document → branch → implement → build → commit →
merge → delete branch → log in @context/current-feature.md).

## Phase map

Three tracks: **Core app** (local-first, offline, no account) → **PWA milestone**
→ **Backend** (accounts + cloud) → **Native** (app stores).

| # | Track | Feature | Spec | State |
| --- | --- | --- | --- | --- |
| 1 | Core | Foundation — setup, static-export config, design tokens & static shell | `phase-1-foundation-spec.md` | Not started |
| 2 | Core | Data model & local-first storage layer | `phase-2-data-storage-spec.md` | Not started |
| 3 | Core | Card & tile component system | `phase-3-card-system-spec.md` | Not started |
| 4 | Core | Navigation & screen transitions | `phase-4-navigation-spec.md` | Not started |
| 5 | Core | Home screen | `phase-5-home-spec.md` | Not started |
| 6 | Core | Collection screen | `phase-6-collection-spec.md` | Not started |
| 7 | Core | Card detail sheet | `phase-7-detail-sheet-spec.md` | Not started |
| 8 | Core | Scan flow (camera → confirm → tag) | `phase-8-scan-spec.md` | Not started |
| 9 | Core | Favorites & Settings | `phase-9-favorites-settings-spec.md` | Not started |
| 10 | **Milestone** | **PWA — installable + offline** (first shippable release) | `phase-10-pwa-spec.md` | Not started |
| 11 | Backend | Supabase backend & Auth (schema, RLS, Storage, sign-in) | `phase-11-supabase-auth-spec.md` | Not started |
| 12 | Backend | Cloud sync (local-first ↔ Supabase, image upload, multi-device) | `phase-12-cloud-sync-spec.md` | Not started |
| 13 | Native | Native packaging — Capacitor iOS/iPad + Android, store submission | `phase-13-native-capacitor-spec.md` | Not started |
| 14 | Enhancement | Scan capture quality — relaxed viewfinder, framing guides, tap-to-focus | `phase-14-scan-capture-spec.md` | Not started |
| 15 | Enhancement | Expanded type system (+ optional card stage) | `phase-15-type-system-spec.md` | Not started |
| 16 | Enhancement | Account & privacy hardening — account-switch fix, sign-out handling | `phase-16-account-privacy-spec.md` | Not started |
| 17 | Enhancement | AI card auto-recognition (premium / subscription) | `phase-17-ai-recognition-spec.md` | Not started |

> **Live status lives in @context/current-feature.md** (this table is the original
> plan). Phases 1–12 are complete; 14–17 were added 2026-07-01 from on-device
> testing feedback and follow the same per-phase workflow.

### Enhancement track — decisions (locked 2026-07-01)

- **Sign-out (phase 16):** keep the local-first default — signing out leaves cards
  on the device. No clear-on-sign-out. But the account-switch ownership bug (below)
  is fixed regardless.
- **Account-switch bug (phase 16):** today the sync forces `owner_id` to the current
  user, so on a shared device a second account would absorb the first account's
  cards. Phase 16 must never push cards owned by a different user.
- **AI recognition (phase 17):** gated behind a **subscription** (premium). Requires
  a server-side entitlement check + a billing mechanism (web + native IAP) and a
  Supabase Edge Function proxy so the AI key never ships to the client.

## Dependency notes

- **1 → 2 → 3** are the spine: shell + static-export config + design system, then
  the local-first data layer, then the Card component everything renders.
- **4** wires the static shell into a real navigable app.
- **5, 6, 7, 9** are screens/surfaces consuming phases 2–4; after those land they
  can move in any order (suggested numeric order).
- **8 (Scan)** is the only *write* path and the most complex (camera + canvas).
  Depends on 2 (storage) + 3 (card preview); build any time after 4.
- **10 (PWA)** is the first shippable milestone — the whole core app, installable
  and offline. No backend required.
- **11 → 12** add accounts and cloud. The phase-2 store is deliberately built
  local-first so sync bolts on **without a rewrite**. 11 before 12.
- **13 (Native)** is last; it wraps the finished static build. Depends on 1's
  static-export config and swaps web camera for the Capacitor Camera plugin
  (touch point defined in phase 8).

## Conventions (all phases)

- **Static export.** Next.js `output: 'export'` from phase 1 on — no API routes /
  Server Actions in the shipped bundle. Backend access is via the **Supabase
  client SDK under Row-Level Security**. (This intentionally departs from the
  generic Server-Actions/Prisma-runtime guidance in @context/coding-standards.md;
  Prisma is still used for Supabase **schema + migrations**, and Zod still
  validates all input.)
- **Local-first.** The on-device store is authoritative offline and when signed
  out; cloud sync reconciles in the background when signed in.
- Mobile-first: a fixed phone-sized shell; desktop just centers it. Safe-area
  insets respected throughout.
- Dark mode first (token table in @context/project-overview.md), light as swap.
- Strict TypeScript, no `any`; interfaces for every prop and data model.
- Tailwind v4 CSS-based config in `globals.css` `@theme` — **no
  `tailwind.config.*`**.
- Code splitting: lazy-load heavy/rare surfaces (Scan camera, detail sheet) via
  `next/dynamic`; the camera stack never ships in the initial bundle.
- File structure per @context/coding-standards.md and the Architecture section of
  @context/project-overview.md.

## References

- @context/project-overview.md
- @context/screenshots/pokepal.png, @context/screenshots/pokepal_1.png
- @context/coding-standards.md
- @context/ai-interaction.md
