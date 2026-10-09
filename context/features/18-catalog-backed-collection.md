# Catalog-Backed Collection Model

## Status

Proposed

## Goal

PokéPal stores what Dalí owns as physical copies (`OwnedCard`) of verified
catalog printings (`CardPrinting`), counts ownership per exact printing, and
syncs it — while every legacy card stays visible and untouched.

## Context

- Read: `context/pokepal-2/02-target-architecture.md` (contracts, persistence),
  `context/pokepal-2/01-current-state.md` §Gaps
- Relevant area: `src/types/`, `src/lib/storage.ts`, `src/lib/catalog/` (new),
  `src/hooks/useCollection.tsx`, `src/lib/sync.ts`, `src/hooks/useSync.tsx`,
  `src/lib/supabase-cards.ts`, `prisma/`
- Avoid: scan UI, recognition, visual redesign

## Requirements

- Contract types exactly as in the target architecture (`catalog.ts`,
  `collection.ts`, `scan.ts`), Zod schemas beside them.
- `CatalogProvider` interface + TCGdex adapter: fetch printing by id, search by
  `(collectorNumber, setOfficialCount)` and by name; Zod-validated; pricing
  dropped; missing image → `imageUrl: null`.
- On-device printing cache (`v2:printings`) so owned printings render offline.
- OwnedCard store: `crypto.randomUUID()` ids; `addOwnedCards(batch)` is one
  atomic state update; `ownershipFor(printingId)` / exact-printing duplicate
  counts; favorites; release with tombstones.
- Legacy `Card` data is read-only: still loaded and shown, never rewritten.
- Additive Prisma migration for `owned_cards` + RLS SQL; sync reuses the
  LWW/tombstone approach and enforces the phase-16 owner guard.
- A test runner (`vitest`, decision D6) with unit tests for every pure module
  touched.

## Out of Scope

- Legacy photo migration or deletion (Feature 24).
- StorageLocation UI or sync.
- Any change to the legacy `cards` table or `card-images` bucket.

## Acceptance Criteria

- Adding 10 copies in one call yields 10 distinct ids and survives reload.
- Two printings of the same Pokémon never count as duplicates of each other.
- Legacy cards render exactly as before.
- `owned_cards` round-trips through sync between two sessions (local Supabase
  or approved live project); a different signed-in user never receives or
  pushes another user's rows.
- `npm run lint`, `npm run build`, `npm test` pass.

## Notes / Decisions

- Applying the migration to the live project is gate D9.
- Contract changes go through `02-target-architecture.md`, not a ticket.
