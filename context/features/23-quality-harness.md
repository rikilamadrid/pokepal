# Quality Harness & Regression Fixtures

## Status

Proposed

## Goal

Every push proves PokéPal 2.0's critical rules automatically: exact-printing
counting, no silent matches, sync safety, legacy preservation, and no
persisted photos.

## Context

- Read: `context/pokepal-2/02-target-architecture.md` (rules, image
  lifecycle), `.github/workflows/ci.yml`
- Relevant area: `.github/workflows/`, `test/` or co-located `*.test.ts`,
  `src/lib/sync.ts`
- Avoid: feature implementation

## Requirements

- CI runs `npm test` in addition to lint and build.
- Regression tests for legacy `reconcile` (LWW, tombstones, resurrection) and
  the phase-16 owner guard.
- Privacy guard test: after a scripted scan + save, persisted local state
  contains no image data URIs for 2.0 records; Edge Function source contains
  no logging of request bodies.
- Legacy compatibility test: a recorded 1.x `collection` payload (with photo
  data URIs) loads unchanged alongside 2.0 data.

## Out of Scope

- End-to-end device automation.

## Acceptance Criteria

- CI fails when any of the above rules is broken (demonstrated by a
  deliberately failing local run).

## Notes / Decisions

- Independent review of other workers' tickets is the `tester` role in each
  ticket's lifecycle, not this Feature.
