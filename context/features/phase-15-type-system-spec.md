# PokéPal — Phase 15 Spec: Expanded Type System (+ optional card stage)

## Overview

Enhancement phase (post-launch). The app ships with only 6 creature types; real
cards span more. This phase expands the type set (with matching gradients, badges,
art, and the type picker) and adds an optional **stage** field so "Basic /
Stage 1 / Stage 2 / Trainer / Energy" can be recorded (the user's "basic" request
— a card *stage*, not an energy type).

## Requirements

### Types

- Extend `CardType` (`src/types/card.ts`) with: **dragon, fighting, dark, metal,
  fairy, colorless** (added to the existing fire / water / grass / electric /
  psychic / rock).
- Define a light→dark gradient for each new type, added **once** as CSS tokens in
  `globals.css @theme` and mirrored in the typed map in `src/lib/type-gradients.ts`
  (single source of truth — art backgrounds, frame tints, tiles, and picker all
  read it). Suggested palettes (tune in-app):
  - dragon `#c9a86a → #7a5cff` · fighting `#e0a06a → #b3402e` · dark
    `#7a7f8c → #2b2d36` · metal `#cfd4dc → #7d8794` · fairy `#ffc2e6 → #ff6fb0`
    · colorless `#eceef2 → #b7bcc7`.
- `TypeBadge` and the Scan type picker render all types; the picker wraps/scrolls
  gracefully now that there are 12. `art-gen` already fills from the gradient map,
  so new types get art for free.

### Stage (optional field)

- Add `stage?: CardStage` to the `Card` model — `CardStage = "basic" | "stage-1" |
  "stage-2" | "trainer" | "energy"`. Optional / nullable so existing cards and the
  local-first store stay valid.
- Scan Tag form: a stage picker (defaulting to Basic); Zod schema updated.
- **Backend:** Prisma migration adds a nullable `stage` column to `cards`; the
  Supabase row mapper (`cardToRow`/`rowToCard`) round-trips it; sync unaffected
  (still LWW on `updatedAt`).
- Card detail sheet / stat grid surfaces stage where shown.

## Requirements (shared)

- Strict typing, no `any`; keep the gradient map the single source.
- `npm run build` + `npm run lint` pass; `prisma migrate status` in sync.
- Verify: each new type renders correct gradient on card/tile/badge/picker; a card
  saved with a stage round-trips through sync.

## Out of scope

- Auto-detecting type/stage from the photo — phase 17.

## References

- @context/project-overview.md (Type system, Generated art, Data Model)
- @context/features/phase-3-card-system-spec.md · phase-8-scan-spec.md
- @context/features/phase-12-cloud-sync-spec.md (row mappers, migration flow)
