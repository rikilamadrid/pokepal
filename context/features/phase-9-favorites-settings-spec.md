# PokéPal — Phase 9 Spec: Favorites & Settings

## Overview

Phase 9 of 13. Builds the two remaining core screens: the **Favorites** grid and
the **Settings** screen. Both consume the phase-2 store; Settings also holds the
theme toggle and the destructive "release entire collection" action. The Account
row is stubbed here and made real in phase 11.

## Requirements

### Favorites tab

- Full-page **2-column grid** of all favorited cards (`CardTile`), reusing the
  phase-6 grid styling.
- **Live-updates** when cards are favorited/unfavorited (from the detail sheet).
- Friendly **empty state** when nothing is favorited.
- Tapping a tile opens the detail sheet (phase 7).
- This is the destination for Home's "See all" (phase 5).

### Settings tab

- **Dark mode** toggle (iOS-style `switch`): reads `prefers-color-scheme` on first
  load, flips `data-theme`, and persists the choice; all tokens respond via CSS
  custom properties.
- **Total caught**: live count of all cards.
- **Unique species**: live count of distinct `dexNo` values.
- **Release entire collection**: destructive row that **confirms first** (dialog),
  then calls `releaseAll()` and re-renders all screens. Clear, kid-safe copy.
- **Account row (stub)**: a visible "Sign in to back up your cards" placeholder
  row that does nothing yet — made functional in phase 11. Keep layout ready for
  signed-in/signed-out states.
- Settings uses grouped, inset list styling consistent with iOS.
- `npm run build` and `npm run lint` pass; verify counts, theme persistence, and
  release-all confirm.

## Out of scope (later phases)

- Real sign-in / account behavior — phase 11
- Cloud sync status UI — phase 12

## References

- @context/project-overview.md (Features D + E)
- @context/features/phase-3-card-system-spec.md
- @context/features/phase-7-detail-sheet-spec.md
- @context/features/phase-11-supabase-auth-spec.md
