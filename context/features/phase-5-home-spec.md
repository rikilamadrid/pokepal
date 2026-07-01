# PokéPal — Phase 5 Spec: Home Screen

## Overview

Phase 5 of 13. Builds the **Home screen** — the app's landing surface. Composes
the phase-3 card components against the phase-2 collection store: a hero "latest
catch", a favorites row, and a duplicates row. Read-only consumption of the
store; tapping cards opens the detail sheet (wired in phase 7).

## Requirements

- **Latest catch hero**: the most recently caught card (max `caughtAt`) rendered
  large with a subtle floating + tilt animation, and the holo sweep when it's
  `holo` (reuse phase-3 behavior). Below it: name (Lilita One), `#dex · Type ·
  Rarity`, and a "Caught {relative date}" line. Respect `prefers-reduced-motion`.
- **Favorites row**: horizontal-scroll strip of favorited cards as `CardTile`s,
  **capped at 8**, with an eyebrow label + count pill ("FAVORITES ●3") and a
  "See all" affordance that switches to the Favorites tab (via phase-4 nav).
- **Duplicates row**: horizontal-scroll strip of every card whose `dexNo` is
  shared with another card (via the phase-2 duplicate helper), eyebrow + count
  pill. Tiles show the `×N` badge.
- **Empty states**: graceful handling when there are no favorites and/or no
  duplicates (hide the row or show a friendly hint) — but note the seed data
  means the app is never fully empty.
- Rows scroll horizontally with momentum, hidden scrollbars, and safe edge
  padding; the screen scrolls vertically within the shell.
- Tapping the hero or any tile calls the card-select handler (opens detail sheet
  once phase 7 lands; no-op/placeholder acceptable until then).
- Everything re-renders live when the collection changes (favorite toggles, new
  catches).
- `npm run build` and `npm run lint` pass; verify against the seed collection.

## Out of scope (later phases)

- The detail sheet the cards open into — phase 7
- The Favorites tab "See all" lands on — phase 9
- Adding new catches — phase 8

## References

- @context/project-overview.md (Features A, Screens → Home)
- @context/screenshots/pokepal_1.png (hero + favorites row)
- @context/features/phase-3-card-system-spec.md
- @context/features/phase-4-navigation-spec.md
- @context/features/phase-7-detail-sheet-spec.md
