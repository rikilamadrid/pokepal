# PokéPal — Phase 6 Spec: Collection Screen

## Overview

Phase 6 of 13. Builds the **Collection screen** — the full, searchable grid of
every card. Consumes the phase-2 store and phase-3 `CardTile`. Read-only; tiles
open the detail sheet (phase 7).

## Requirements

- **Big display title** "Collection" (Lilita One) at the top of the screen body,
  in addition to the navbar inline title from phase 4.
- **iOS-style search bar**: rounded, frosted, with a leading magnifier glyph and a
  clear (`✕`) button when non-empty. Filters the grid by **name, dex number, or
  type** in real time with a **120 ms debounce**. Case-insensitive.
- **Card count pill**: "ALL CARDS ●{n}" eyebrow with the live count (reflects the
  current filter).
- **2-column grid** of `CardTile`s, sorted **newest first** (`caughtAt` desc).
  Responsive gutters; tiles show `×N` duplicate badges and favorite stars.
- **Empty / no-results state**: friendly message when the search matches nothing.
- Grid scrolls vertically within the shell; search bar can scroll with content or
  stick — match the iOS reference (sticky preferred).
- Tapping a tile calls the card-select handler (opens detail sheet in phase 7).
- Live-updates when the collection changes.
- `npm run build` and `npm run lint` pass; verify search filters and sorting.

## Out of scope (later phases)

- The detail sheet — phase 7
- Adding cards — phase 8

## References

- @context/project-overview.md (Features B, Screens → Collection)
- @context/features/phase-3-card-system-spec.md
- @context/features/phase-7-detail-sheet-spec.md
