# Batch Scan Import

## Status

In Progress

## Goal

Dalí photographs several cards at once, reviews what PokéPal found (with real
card artwork), fixes anything uncertain, sees which ones he already has, and
adds them all to his collection in one tap — without the photo being kept.

## Context

- Read: `context/pokepal-2/02-target-architecture.md` (contracts, rules,
  image lifecycle)
- Relevant area: `src/components/scan/`, `src/lib/recognition/`,
  `src/hooks/useCollection.tsx`, `src/lib/camera.ts`
- Avoid: Trade Check screens, collection filters

## Requirements

- Replaces the manual Tag step for new scans; the camera adapter and
  upload fallback are reused. Capture resolution raised to read collector
  numbers (~1600px long edge for upload; never stored).
- Review screen: one row per detected card showing the catalog artwork (or
  metadata placeholder), name, set, collector number, tier badge, and
  "you have N" for exact-printing duplicates.
- Ambiguous → choose among the ranked printings visually; unmatched → manual
  search by name / collector number, or remove. Nothing uncertain is saved
  without an explicit choice.
- "Add N cards" saves confirmed candidates in one `addOwnedCards` call with
  `source: "scan"`.
- Offline: clear "needs internet to scan" state; no capture attempt.
- Kid-friendly copy, big tap targets, loading skeletons per card.

## Out of Scope

- Trade Check.
- Editing finish beyond an optional picker.
- Legacy migration.

## Acceptance Criteria

- With a recorded fixture transport, a 6-card photo produces a review list,
  ambiguous cards cannot be saved until chosen, and saving adds exactly the
  confirmed cards.
- After closing the sheet no photo data remains in app state or storage
  (verified by test/inspection).
- With the Edge Function available (non-production), the same flow works on a
  real phone.

## Notes / Decisions

- Depends on Features 18 and 19.
