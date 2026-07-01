# PokéPal — Phase 12 Spec: Cloud Sync (Local-first ↔ Supabase)

## Overview

Phase 12 of 13. Connects the local-first store (phase 2) to the Supabase backend
(phase 11) with a **background sync engine**: local changes push up, remote
changes pull down, and card images upload to Supabase Storage. The result is
cloud backup + multi-device (phone ↔ iPad) while keeping the app instant and
fully functional offline.

## Requirements

- **Sync engine** (`src/lib/sync.ts` + a `useSync` hook): when signed in,
  reconcile the local collection with the `cards` table. Runs on sign-in, on
  reconnect, on app focus, and after local mutations (debounced). No-ops when
  signed out.
- **Reconciliation policy**: last-writer-wins by `updatedAt`; use `deleted_at`
  soft-deletes so a release on one device propagates (don't resurrect deleted
  cards). Define behavior for: local-only cards (insert to cloud), cloud-only
  cards (insert to local), and conflicts (newer `updatedAt` wins).
- **Image upload**: on push, upload locally-captured images (data URIs) to the
  `card-images` bucket under the user's path, then set the row's `img` to the
  Storage URL; local store updates to the URL once uploaded. Generated-SVG cards
  need no upload (store the SVG or regenerate deterministically — pick one and
  document it).
- **First sign-in adoption**: when a user with a local (signed-out) collection
  signs in, **claim** those local cards — stamp `ownerId`, upload images, and push
  them — merging rather than wiping either side. This is the critical
  data-integrity case; test it explicitly.
- **Offline queue**: mutations made offline are captured locally and flushed on
  reconnect; the UI never blocks on the network.
- **Sync status UI**: lightweight indicator in Settings (e.g. "Backed up ·
  {time}", "Syncing…", "Offline"), plus error toasts on failure with retry.
- **Realtime (optional)**: consider Supabase realtime subscriptions so a change on
  one device reflects on another live; otherwise sync on focus/interval.
- Respect RLS (all writes carry the user's `owner_id`); never trust client to set
  another user's rows.
- `npm run build` and `npm run lint` pass; verify: local→cloud push, cloud→local
  pull on a second device, image upload + URL rewrite, offline edits flushing,
  first-sign-in adoption, and delete propagation.

## Out of scope (later phases)

- Native packaging — phase 13

## References

- @context/project-overview.md (Architecture, Backend → Sync, Key Implementation
  Notes: cloud sync)
- @context/features/phase-2-data-storage-spec.md (local store, updatedAt)
- @context/features/phase-11-supabase-auth-spec.md (client, schema, Storage, auth)
