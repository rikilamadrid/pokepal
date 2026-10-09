# Card Recognition & Catalog Resolution

## Status

Proposed

## Goal

A photo of 1–10 Pokémon cards returns, per card, either an exact catalog
printing, a short ranked list of possible printings, or an honest "couldn't
identify" — measured on real photos for accuracy, ambiguity, latency, and cost.

## Context

- Read: `context/pokepal-2/02-target-architecture.md` §Recognition pipeline,
  §Image lifecycle, §Open decisions
- Relevant area: `src/lib/recognition/` (new), `supabase/functions/recognize-cards/`
  (new), `src/lib/catalog/` (from Feature 18), `evals/recognition/` (new)
- Avoid: collection UI, legacy scan flow

## Requirements

- Pure resolver `resolve(extracted, catalog) → { tier, matches }` shared by the
  Edge Function and tests; scoring documented; never invents a printing.
- Edge Function `recognize-cards`: verifies JWT, rate-limits, calls a
  cost-efficient Claude vision model with structured output validated by Zod,
  resolves server-side, returns a `ScanBatch` without image data; never writes
  or logs image bytes; API key only in Supabase secrets.
- Client module `src/lib/recognition/` with a pluggable transport (Edge
  Function | recorded fixture) — the single entry point for Batch Scan and
  Trade Check.
- Evaluation harness that runs the same prompt + resolver over a labelled
  fixture of real photos and reports exact-printing accuracy, ambiguity rate,
  wrong-match rate, p50/p95 latency, and cost per photo; hard-stops at the €5
  budget.

## Out of Scope

- Deploying the Edge Function to production (needs approval).
- Paid catalog providers.
- On-device ML.

## Acceptance Criteria

- Resolver unit tests cover exact, ambiguous (same number in different sets),
  unmatched, promo/secret-rare numbering, and non-English cards.
- No paid model call happens before a key and spend limit are confirmed.
- An evaluation report exists under `evals/recognition/reports/` with the
  measured numbers and the fixture they came from.
- Wrong-match rate (confident but incorrect) is reported separately from
  ambiguity.

## Notes / Decisions

- D1 (provider), D2 (model + spend control), D5 (signed-out recognition).
- Real accuracy needs real photos of real cards with ground-truth labels
  supplied by the human; synthetic composites may be used for pipeline tests
  but are never reported as accuracy.
