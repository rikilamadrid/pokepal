# Legacy Photo Migration

## Status

Proposed

## Goal

Every card saved by PokéPal 1.x is resolved to a verified printing (or kept as
an explicitly unresolved legacy card), and legacy photos are deleted only after
the human approves.

## Context

- Read: `context/pokepal-2/02-target-architecture.md` §Legacy collection
- Relevant area: `src/lib/storage.ts`, `src/lib/supabase-cards.ts`,
  `card-images` bucket

## Requirements

- Per-card resolution using the Feature 19 pipeline (legacy photo used once as
  a scanning input) or manual search; creates `OwnedCard` with
  `source: "legacy-migration"`.
- Dry-run report before any deletion; deletion is a separate, approved step;
  rollback keeps legacy rows until the human confirms.

## Out of Scope

- Anything before Features 18–20 are complete.

## Acceptance Criteria

- TBD — sliced into tickets only after Features 18–20 land.

## Notes / Decisions

- Not ticketed in this run.
