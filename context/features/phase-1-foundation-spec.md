# PokéPal — Phase 1 Spec: Foundation (Setup, Design Tokens & Static Shell)

## Overview

Phase 1 of 10. Establishes the design system and the **static app shell** — the
fixed iOS-style frame every screen lives inside. Everything here is **display
only**: no navigation logic, no storage, no real cards. Use the screenshots and
overview for the look. The Next.js + Tailwind v4 project is already scaffolded;
this phase configures it and builds the chrome.

## Requirements

- Confirm Next.js (App Router) + TypeScript strict mode + Tailwind CSS v4 are
  configured. Tailwind theme lives in `src/app/globals.css` via `@theme` — **do
  not** create `tailwind.config.*`.
- **Configure static export** in `next.config.ts`: `output: 'export'`,
  `trailingSlash: true`, `images: { unoptimized: true }`. This is required so the
  same build ships as the PWA (phase 10) and inside the Capacitor shell (phase
  13). It means **no API routes / Server Actions** — plan all data access
  client-side (see @context/features/phase-11-supabase-auth-spec.md). Verify
  `npm run build` emits a clean `out/`.
- Establish the **file structure** from @context/project-overview.md
  (`components/{shell,card,…}`, `hooks/`, `lib/`, `types/`, `data/`) so later
  phases have a home. Empty/placeholder is fine.
- Initialize shadcn/ui and install base primitives we'll need later: `button`,
  `dialog`, `sheet`, `input`, `switch`, `sonner` (toast).
- Load fonts via `next/font`: **Lilita One** (display — names, titles,
  wordmark), **Space Mono** (mono — dex numbers, eyebrow labels, metadata).
  Body/UI text uses `system-ui` / SF Pro. Expose each as a CSS variable.
- Define the **color tokens** from @context/project-overview.md in `@theme` /
  `:root` + a `[data-theme="dark"]` (or `.dark`) override: `--bg`, `--surface`,
  `--surface-raised`, `--border`, `--text`, `--text-muted`, `--red` (#ff4655),
  `--gold` (#ffc857). Dark mode is the default/primary; light mode is the swap.
- Define the **type-gradient tokens** (fire/water/grass/electric/psychic/rock,
  light→dark stops) as CSS custom properties for reuse across card art, frames,
  tiles, and type pickers.
- Root `layout.tsx`: apply both fonts, set `data-theme="dark"` on `<html>`,
  add PWA-leaning meta (`viewport-fit=cover`, `theme-color`) and mount `<Toaster>`.
- Build the **fixed shell** as a static layout component: `position: fixed;
  inset: 0`, three stacked layers — frosted-glass **navbar** (top, ~48px +
  `env(safe-area-inset-top)`), **screen container** (`flex:1; overflow-y:auto`),
  frosted-glass **tab bar** (bottom, ~54px + `env(safe-area-inset-bottom)`).
- **Navbar (static):** PokéPal wordmark + Pokéball glyph, using Lilita One with
  the red/gold accent treatment from the screenshot.
- **Tab bar (static):** 5 slots — Home, Collection, Scan (center, raised Pokéball
  puck floating above the bar), Favorites, Settings — with outline icons and
  labels. Display only, no active state logic yet.
- A single static placeholder screen (e.g. "Home") rendered in the screen
  container to validate spacing, scroll, and safe areas.
- Frosted-glass utility classes (backdrop-filter + `-webkit-backdrop-filter`) for
  navbar/tab bar.
- Responsive sanity: shell is phone-width on mobile; on desktop it centers in a
  max-width column and does not break.
- `npm run build` and `npm run lint` pass.

## Out of scope (later phases)

- Tab navigation, screen switching, transitions — phase 4
- Any data, storage, or real cards — phase 2
- The Card component, holo sweep, badges — phase 3
- Scan, search, detail sheet, settings behavior — phases 6–9
- PWA manifest / installability — phase 10

## References

- @context/project-overview.md (color tokens, typography, App Shell & Navigation)
- @context/screenshots/pokepal_1.png (navbar + tab bar reference)
- @context/coding-standards.md
- @context/features/phase-2-data-storage-spec.md
- @context/features/phase-4-navigation-spec.md
- @context/features/phase-10-pwa-spec.md
- @context/features/phase-13-native-capacitor-spec.md
