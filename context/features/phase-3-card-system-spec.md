# PokéPal — Phase 3 Spec: Card & Tile Component System

## Overview

Phase 3 of 13. Builds the **reusable card components** every screen renders. This
is purely the presentation layer over a `Card` from phase 2 — the gold-framed
full card (hero/detail), the compact grid/row tile, the type badge, rarity, the
duplicate `×N` badge, the favorite star, and the earned holo sweep animation.
Data-driven from props; no screen wiring yet.

## Requirements

- **`PokeCard`** (full card) component, props typed against `Card`. Matches the
  screenshot: rounded gold/aqua frame, type-gradient art panel up top (photo
  `img` if present, otherwise the generated SVG), dex number chip top-left, type
  badge top-right (with star overlay when favorited), and a dark name plate at
  the bottom showing **name** (Lilita One), **rarity** (mono), and caught date.
- **`CardTile`** (compact) variant for grids and horizontal rows: art thumbnail,
  name, and `#dex` + type glyph, sized for the 2-column collection grid and the
  scrollable home rows. Shares styling tokens with `PokeCard`.
- **Type badge**: pill tinted by the card's type gradient, label in mono caps
  (FIRE / WATER / …). Consistent with the type-gradient tokens from phase 2.
- **Rarity** display and a **holo sweep** animation that renders **only** when
  `rarity === 'holo'` — an animated foil sheen across the art. It is the one
  decorative animation; respect `prefers-reduced-motion` (static when reduced).
- **Duplicate `×N` badge**: shown on a card when its dex number is a duplicate in
  the collection (count passed in / derived via the phase-2 helper). Gold badge,
  per the screenshot.
- **Favorite star**: gold star indicator on favorited cards (in the badge / name
  area). Display state only here — toggling lives in the detail sheet (phase 7).
- **Press feedback**: tappable cards/tiles get the `scale(.96)` active-press
  response used app-wide.
- Components accept an `onClick`/`onSelect` so screens can later open the detail
  sheet, but wiring is deferred.
- Build a throwaway demo route or storybook-style page (or render against the
  seed collection) to verify every type, rarity (incl. holo), favorited, and
  duplicate state renders correctly. Remove/disable before merge if a scratch
  route.
- `npm run build` and `npm run lint` pass.

## Out of scope (later phases)

- Placing cards into Home / Collection / Favorites layouts — phases 5, 6, 9
- Opening the detail sheet / toggling favorite — phase 7
- The hero tilt + float motion (home-specific) — phase 5

## References

- @context/project-overview.md (UI/UX, Type system, holo sweep, Screens mockups)
- @context/screenshots/pokepal_1.png, @context/screenshots/pokepal.png
- @context/features/phase-2-data-storage-spec.md
- @context/features/phase-5-home-spec.md
- @context/features/phase-7-detail-sheet-spec.md
