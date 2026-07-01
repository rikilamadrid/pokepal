# PokéPal — Phase 2 Spec: Data Model & Local Storage Layer

## Overview

Phase 2 of 13. Builds the **headless, local-first data layer** the whole app
reads from: the card type, a persistent on-device store, seed data, the
type-gradient system, deterministic generated creature art, duplicate detection,
and helper utilities. This store is authoritative offline and when signed out;
it is deliberately shaped so the Supabase **cloud sync** engine (phase 12) bolts
on **without a rewrite**. No UI in this phase beyond what's needed to prove the
store works — the visible surfaces consume it from phase 3 on.

## Requirements

- Define the `Card` type in `src/types/` (strict, no `any`):
  `id: string`, `ownerId: string` (Supabase user id; empty string while local
  only), `name: string`, `dexNo: string` (zero-padded 3-digit), `type: CardType`,
  `rarity: Rarity`, `favorite: boolean`, `img: string` (base64 JPEG **or** SVG
  data URI), `caughtAt: string` (ISO 8601), `updatedAt: string` (ISO 8601 — for
  sync reconciliation later). `CardType = 'fire' | 'water' | 'grass' |
  'electric' | 'psychic' | 'rock'`; `Rarity = 'common' | 'uncommon' | 'rare' |
  'holo'`. Every mutation bumps `updatedAt`.
- **Collection store** (client-only) as a React Context provider (or zustand)
  exposing `cards` plus actions: `addCard`, `toggleFavorite(id)`,
  `releaseCard(id)`, `releaseAll()`. Persist the array to `localStorage` under
  key `"collection"` and rehydrate on load (guard against SSR / no `window`).
- **Seed-on-empty**: on first load or a cleared store, populate ~10 seed cards
  (generated SVG art so the app never opens empty) and persist immediately.
- **Type-gradient map** in `src/lib/`: each `CardType` → its light→dark gradient
  stops, used by art generation and consumed by UI for card art, frames, tiles,
  and the type picker. Single source of truth (mirror the phase-1 CSS tokens).
- **Generated creature art** (`src/lib/`): deterministic SVG from a hash of
  `name + dexNo`. Blob body path (pick of 3 shapes by hash), type-gradient fill,
  simple face (two eyes with hash-varied offset + a smile). Returns an SVG data
  URI. Same input → same creature, no extra stored fields.
- **Duplicate detection**: a selector/helper that, given the collection, returns
  the dex numbers (and counts) appearing more than once. Computed on read — no
  stored field. Used for the home "duplicates" row and the `×N` card badge.
- **`nextDexNumber()`**: scans the collection for the highest numeric dex value
  and returns the next, zero-padded to 3 digits — for the Scan form's blank-dex
  auto-increment.
- **Image compression util** (`src/lib/`): draw a source image (data URI or
  `File`) onto a canvas at max 640px wide and re-encode as JPEG quality 0.78,
  returning a data URI. (Used by Scan in phase 8; built here so the data layer is
  complete.)
- Provider mounted high in the tree (in `layout.tsx` or a client wrapper) so all
  screens share one collection instance.
- **Sync-ready shape (design only, no backend yet):** keep all reads/writes
  behind the store's actions (no component touches `localStorage` directly), bump
  `updatedAt` on every mutation, and prefer soft-delete-friendly action shapes so
  phase 12 can add a sync engine without touching callers. Do **not** add
  Supabase, network, or auth here.
- `npm run build` and `npm run lint` pass; verify in the browser that the seed
  collection persists across reloads.

## Out of scope (later phases)

- Rendering cards/tiles — phase 3
- Any screen consuming the store visually — phases 5–9
- The camera/capture flow that feeds `addCard` — phase 8
- Supabase, auth, networking, and the actual sync engine — phases 11–12

## References

- @context/project-overview.md (Data Model, Type system, Generated art,
  Duplicate detection, Key Implementation Notes)
- @context/coding-standards.md
- @context/features/phase-1-foundation-spec.md
- @context/features/phase-3-card-system-spec.md
- @context/features/phase-8-scan-spec.md
- @context/features/phase-12-cloud-sync-spec.md
