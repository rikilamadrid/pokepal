# PokéPal — Phase 16 Spec: Account & Privacy Hardening

## Overview

Enhancement phase (post-launch). Fixes a data-integrity bug in the phase-12 sync
around **account switching on a shared device**, and confirms the sign-out data
policy. No new product surface — correctness + safety.

## Decisions (locked 2026-07-01)

- **Sign-out keeps local cards** (local-first default is retained — no clear on
  sign-out). Revisit only if a shared-device clear option is later requested.

## The bug

On sign-in the sync pushes every local card that isn't already in the current
user's cloud rows, and `cardToRow` **forces `owner_id` to the current user**. So on
a shared device: user A signs in (cards sync), signs out (cards remain locally),
user B signs in → A's cards are treated as "local-only", stamped with B's
`owner_id`, and pushed into **B's** account. Cross-account data leak + pollution.

## Requirements

- **Never push another user's cards.** The push set must exclude cards whose
  `ownerId` is a non-empty value different from the current user. Only unclaimed
  cards (`ownerId === ""`) or cards already owned by the current user are eligible
  to push. (`ownerId === ""` = genuinely local/unsynced → correct to adopt.)
- **Account-change reset.** Persist the last-synced owner id. When a *different*
  user signs in, drop the previous owner's synced cards from the local store before
  the first sync (keep unclaimed `ownerId === ""` cards — they're this device's own
  local work), so B starts from B's cloud collection, not A's.
- **Adoption still works** for the first sign-in of a fresh (signed-out) collection
  — that path is unchanged (all cards are `ownerId === ""`).
- Reconcile stays LWW; this is a guard on *what is eligible to push* and a reset on
  identity change, not a policy change.
- `npm run build` + `npm run lint` pass. Verify explicitly: A→sign-out→B sign-in on
  one device leaves A's rows untouched in the cloud and shows B only B's cards;
  first-sign-in adoption still uploads a signed-out collection.

## Touch points

- `src/hooks/useSync.tsx` (eligibility filter, last-owner tracking, reset)
- `src/lib/sync.ts` (optionally take `currentOwnerId` to exclude foreign cards)
- `src/lib/storage.ts` (persist `lastOwnerId`)

## Out of scope

- Subscription / billing — phase 17.
- Clear-on-sign-out UX (deferred by decision above).

## References

- @context/features/phase-12-cloud-sync-spec.md (sync engine, adoption)
- @context/project-overview.md (Backend → RLS, Sync)
