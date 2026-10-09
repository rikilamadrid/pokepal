# Trade Check — "Do I Have This?"

## Status

Proposed

## Goal

From the Home screen, Dalí taps "Check a Card", photographs one card, and
within a few seconds sees the real card with a clear verdict: NEW!, ALREADY
OWNED (1 copy), DUPLICATE (N copies), or NOT SURE.

## Context

- Read: `context/pokepal-2/02-target-architecture.md` (pipeline, rules)
- Relevant area: `src/components/trade/` (new), `src/lib/recognition/`,
  `src/hooks/useCollection.tsx`, `src/components/shell/`
- Avoid: batch review UI, collection filters

## Requirements

- Dedicated entry point ("Check a Card") distinct from "Add cards".
- Uses `recognize(…, { mode: "trade-check" })` from `src/lib/recognition/`;
  no second scanner or matcher.
- Verdict computed from exact-printing ownership (`printingId`), never name or
  species. A different printing of an owned Pokémon is NEW!, optionally noting
  "you have a different <name> card".
- NOT SURE shows the ranked candidates for an adult/child to pick, then
  re-computes the verdict.
- Optional "We traded! Add it" button adds one `OwnedCard` with
  `source: "trade"`; scanning alone never adds.
- Latency instrumentation (`ScanBatch.timings`) shown in a dev overlay.
- Offline: clear "needs internet" state.

## Out of Scope

- Pricing, valuation, or trade fairness hints.
- Social features.

## Acceptance Criteria

- With recorded fixtures: owned ×0/×1/×3 and ambiguous responses produce the
  four verdicts; a different-set Charizard yields NEW!.
- No card is added unless "We traded! Add it" is tapped.
- Measured p50/p95 end-to-end latency on a real phone recorded in the
  recognition evaluation report.

## Notes / Decisions

- D4 (finishes). Depends on Features 18 and 19.
