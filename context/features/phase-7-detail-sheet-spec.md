# PokéPal — Phase 7 Spec: Card Detail Sheet

## Overview

Phase 7 of 13. Builds the **card detail bottom sheet** — the modal that opens when
any card is tapped anywhere in the app. It shows the full card, its stats, and the
two mutating actions (favorite, release). This is the shared "open a card"
surface all screens route into; wire the phase-5/6 tap handlers to it here.

## Requirements

- **Bottom-sheet modal** built on the shadcn `sheet` (or `dialog`) primitive,
  presented from the bottom with a **drag handle**, rounded top corners, frosted
  backdrop, and safe-area bottom inset. Dismiss via drag-down, backdrop tap, the
  `✕` button, or `Escape`.
- **Selected-card state**: a small store/context (or lift into the phase-4 nav
  state) holding the currently-open card id; `openCard(id)` / `closeCard()`.
- **Contents** (match the screenshot):
  - Card name in the header (Lilita One) + `✕` close.
  - The full `PokeCard` (phase 3) at the top, including holo sweep + `×N` badge.
  - A **2×2 stat grid**: Dex no., Type, Rarity, Caught (formatted date).
- **Favorite button**: toggles `favorite` via the store action; label/star
  reflects state ("★ Favorited" vs "☆ Favorite") and **all screens update
  instantly** (home favorites row, tiles).
- **Release button**: removes the card via the store action, then closes the
  sheet; the collection re-renders everywhere. (A confirm step is optional here;
  full-collection release with confirm lives in Settings, phase 9.)
- Wire the card-select handlers from Home (phase 5) and Collection (phase 6) to
  `openCard`.
- Consider lazy-loading the sheet contents with `next/dynamic` (it's not needed
  on first paint).
- Respect `prefers-reduced-motion` for the present/dismiss animation.
- `npm run build` and `npm run lint` pass; verify open/close, favorite toggle
  propagation, and release.

## Out of scope (later phases)

- Creating cards — phase 8
- Settings-level "release entire collection" — phase 9

## References

- @context/project-overview.md (Features F, Screens → Card detail sheet)
- @context/screenshots/pokepal.png (detail sheet reference)
- @context/features/phase-3-card-system-spec.md
- @context/features/phase-5-home-spec.md
- @context/features/phase-6-collection-spec.md
