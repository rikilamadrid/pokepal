# PokéPal 2.0 — Target Architecture & Shared Contracts

Status: **Proposed** (2026-10-09). Becomes binding when the human approves
Features 18–23. Every worker builds against this file; changing a contract
here is a planning act, not a ticket-local decision.

## Principle

**Photos are temporary scanning inputs, not collection assets.** The collection
stores references to verified catalog printings plus the facts about the
physical copies a child owns. Artwork always comes from the catalog, or from a
clearly labelled metadata placeholder — never from a child's photo and never
generated to look like a real card.

## Domain boundaries

Three identities, never fused again:

| Concept | Identity | Answers |
| --- | --- | --- |
| `PokemonSpecies` | National Pokédex number | "Which Pokémon is this?" (browse by Pokémon, region) |
| `CardPrinting` | Language-qualified catalog printing id (e.g. `tcgdex:es:swsh3-20`) | "Which exact card is this?" (Trade Check, set progress) |
| `OwnedCard` | Random UUID per physical copy | "How many of this card does Dalí have, which ones are favorites, where are they?" |

`ScanBatch` / `ScanCandidate` are **transient** recognition state. They live in
memory for one review session and are never synced or persisted with images.
`StorageLocation` is contract-only in this release.

### Contract (lives in `src/types/catalog.ts`, `src/types/collection.ts`, `src/types/scan.ts`)

```ts
// ---- catalog.ts ---------------------------------------------------------
/** TCG energy types printed on cards — NOT the 18 video-game Pokémon types. */
export type EnergyType =
  | "grass" | "fire" | "water" | "lightning" | "psychic" | "fighting"
  | "darkness" | "metal" | "fairy" | "dragon" | "colorless";

export type CardCategory = "pokemon" | "trainer" | "energy";

/** Physical finish of a copy. A property of the owned copy, not the printing. */
export type CardFinish = "normal" | "holo" | "reverse" | "firstEdition";

/** Card languages supported in 2.0 (decision D10). */
export type CatalogLanguage = "en" | "es" | "ja";

export interface PokemonSpecies {
  dexNo: number;            // National Pokédex number, e.g. 6
  name: string;             // localized species name, e.g. "Charizard"
  region: PokedexRegion;    // derived from dexNo via a static range table
}

export type PokedexRegion =
  | "kanto" | "johto" | "hoenn" | "sinnoh" | "unova"
  | "kalos" | "alola" | "galar" | "hisui" | "paldea";

export interface CardSetRef {
  id: string;               // provider set id, e.g. "swsh3"
  name: string;             // "Darkness Ablaze"
  officialCount: number;    // printed denominator, e.g. 189 ("020/189")
  totalCount: number;       // incl. secret rares, e.g. 201
  releaseDate: string | null;
  symbolUrl: string | null;
  logoUrl: string | null;
}

/** One exact printed card, as verified against the catalog. Immutable snapshot. */
export interface CardPrinting {
  id: string;               // "{provider}:{language}:{providerCardId}", e.g. "tcgdex:es:swsh3-20"
  provider: "tcgdex";       // widened only by an approved provider decision
  providerCardId: string;   // "swsh3-20"
  language: CatalogLanguage;
  name: string;             // "Charizard VMAX"
  category: CardCategory;
  collectorNumber: string;  // printed local id, e.g. "20", "TG05", "SWSH050"
  set: CardSetRef;
  rarity: string | null;    // printed rarity string, verbatim ("Holo Rare VMAX")
  energyTypes: EnergyType[];// [] for trainers/most energies
  stage: string | null;     // "Basic", "Stage 1", "VMAX", …
  hp: number | null;
  dexNos: number[];         // species on the card; [] for trainers/energy
  illustrator: string | null;
  regulationMark: string | null;
  availableFinishes: CardFinish[];
  /** Base image URL from the catalog, or null → metadata placeholder. */
  imageUrl: string | null;
  fetchedAt: string;        // ISO; snapshot time
}

// ---- collection.ts ------------------------------------------------------
export type AcquisitionSource = "scan" | "manual" | "trade" | "legacy-migration";

/** One physical copy Dalí owns. Quantity = count of live OwnedCards per printing. */
export interface OwnedCard {
  id: string;               // crypto.randomUUID() — never time-based
  ownerId: string;          // Supabase user id, "" while local-only
  printingId: string;       // → CardPrinting.id
  finish: CardFinish | null;// null = unknown/not recorded
  favorite: boolean;
  source: AcquisitionSource;
  acquiredAt: string;       // ISO
  storageLocationId: string | null; // future StorageLocation; always null in 2.0
  updatedAt: string;        // ISO; LWW sync
}

/** Future — contract only. Not rendered, not synced in 2.0. */
export interface StorageLocation {
  id: string;
  ownerId: string;
  kind: "album" | "tin" | "box" | "deck";
  name: string;
  updatedAt: string;
}

/** Derived, never stored. */
export interface OwnershipSummary {
  printingId: string;
  copies: number;           // live OwnedCards with this printingId
  finishes: Partial<Record<CardFinish, number>>;
}

// ---- scan.ts (transient) --------------------------------------------------
export interface ExtractedCardFields {   // what the vision model read; unverified
  name: string | null;
  collectorNumber: string | null;        // "20" from "020/189"
  setOfficialCount: number | null;       // 189 from "020/189"
  setCodeHint: string | null;            // printed set code / symbol description
  hp: number | null;
  language: CatalogLanguage | null;
  regulationMark: string | null;
  finishHint: CardFinish | null;
  /** Normalized [0..1] box in the source photo, for review overlays. */
  bbox: { x: number; y: number; w: number; h: number } | null;
  modelConfidence: number;               // 0..1, self-reported; never trusted alone
}

export type MatchTier = "exact" | "ambiguous" | "unmatched";

export interface PrintingMatch {
  printing: CardPrinting;
  score: number;                          // 0..1 from the resolver, not the model
  reasons: string[];                      // e.g. ["number+total", "name≈"]
}

export type CandidateStatus = "pending" | "confirmed" | "corrected" | "rejected";

export interface ScanCandidate {
  id: string;
  extracted: ExtractedCardFields;
  tier: MatchTier;
  matches: PrintingMatch[];               // ranked; [] when unmatched
  chosenPrintingId: string | null;        // set only by an explicit confirm/correct
  status: CandidateStatus;
  ownedCopies: number;                    // computed at review time
}

export interface ScanBatch {
  id: string;
  mode: "batch" | "trade-check";
  createdAt: string;
  candidates: ScanCandidate[];
  timings: { uploadMs: number; modelMs: number; resolveMs: number; totalMs: number };
}
```

Rules attached to the contract:

- **No silent acceptance.** Only `tier: "exact"` may be pre-selected, and even
  then the child/adult sees it in review before save. `ambiguous` requires a
  choice; `unmatched` requires a manual search or rejection.
- **Exact-printing ownership.** Trade Check and duplicate badges compare
  `printingId`, never name or species. Same Pokémon in another set = NEW.
- **Finish** is shown but does not change the Trade Check verdict by default
  (see open decision D4).
- **Pokémon type ≠ energy type.** `energyTypes` is what the card prints; species
  browsing uses `dexNos`. No video-game type data in 2.0.
- Catalog responses are validated with Zod and **pricing fields are dropped**
  at the adapter boundary.

## Catalog provider decision (proposed)

| Provider | Exact printing | Images | Languages | Cost / licence | Risk |
| --- | --- | --- | --- | --- | --- |
| **TCGdex** | Yes (`set-localId`, set counts, variants) | Yes, most cards; some missing | 10+ incl. JA | Free, no key; MIT code | Community-run; no SLA |
| pokemontcg.io | Yes | Yes | English only | Free key; **deprecated, keys end 2027-03-01**; no new keys | Sunset |
| Scrydex | Yes | Yes | EN + JA | **Paid, $29+/mo** (recurring → needs approval) | Vendor lock, cost |

**Proposal:** TCGdex as the single provider behind a `CatalogProvider`
interface (`src/lib/catalog/`), with an on-device cache of every printing the
child owns or has scanned. Scrydex stays an unapproved fallback. Worker B's
evaluation must confirm TCGdex coverage on the actual fixture before this is
treated as final (decision D1).

## Recognition pipeline

```text
camera/upload ──► client resize (~1600px long edge, JPEG) ──► HTTPS POST (JWT)
   │                                                            │
   │ (image held in memory only)                                ▼
   │                                    Edge Function `recognize-cards`
   │                                      1. verify JWT, rate limit
   │                                      2. vision model → ExtractedCardFields[]
   │                                      3. resolver → PrintingMatch[] per card
   │                                      4. return ScanBatch (no image), drop bytes
   ▼                                                            │
review UI ◄─────────────────────────────────────────────────────┘
   └─► confirm/correct ─► OwnedCard[] + CardPrinting snapshots ─► local store ─► sync
```

- **One pipeline, two modes.** `mode: "batch"` (5–10 cards) and
  `mode: "trade-check"` (one card, smaller image, latency-first) share the same
  Edge Function, model prompt family, resolver, and client module
  (`src/lib/recognition/`). Trade Check is not a second scanner.
- **Resolver is pure TypeScript** (`src/lib/recognition/resolve.ts`) and shared
  by the Edge Function and tests: candidates come from catalog lookups by
  `(collectorNumber, setOfficialCount)` first, then name; scored on number,
  denominator, name similarity, HP, regulation mark, language.
- **Model:** start with a cost-efficient Claude vision model (Haiku-class) via
  the Edge Function; escalate only if measured accuracy requires it and the
  budget allows. Structured output validated by Zod.
- **Transport seam:** the client's recognition module accepts a transport, so
  UI work proceeds against recorded responses before the Edge Function is
  deployed. Recorded responses live in test fixtures, never in the shipped
  bundle.
- **Offline:** recognition is disabled with a clear "needs internet" state;
  browsing and Trade Check *results for already-cached printings* stay local.

## Image lifecycle

| Stage | Where | Retention |
| --- | --- | --- |
| Capture | Browser memory (Blob/canvas) | Released when the scan sheet closes |
| Upload | TLS request body to the Edge Function | Request lifetime only |
| Model call | Provider API request | Provider's API retention policy (record in privacy notice) |
| Results | `ScanBatch` in memory | No image bytes, no crops, no data URIs |
| Collection | `OwnedCard` + `CardPrinting` | Catalog image **URL** only |

Never: write photos to localStorage, IndexedDB, Supabase Storage, Edge Function
logs, or error reports. A test asserts persisted state contains no `data:image`
JPEG/PNG payloads for 2.0 records.

## Persistence

- **Local:** new keys via `src/lib/storage.ts` (still the only localStorage
  module): `v2:owned` (OwnedCard[]), `v2:printings` (id → CardPrinting),
  `v2:owned:tombstones`. Legacy keys (`collection`, `collection:tombstones`,
  `collection:uploaded`) are **read-only and untouched** in 2.0.
- **Cloud (additive migration):** new `owned_cards` table
  (`id uuid pk, owner_id, printing_id, printing jsonb, finish, favorite, source,
  acquired_at, storage_location_id null, updated_at, deleted_at`) with the same
  owner-only RLS. Legacy `cards` table and `card-images` bucket untouched.
  Rollback = drop the new table; no legacy data is touched.
- **Sync:** reuse the pure `reconcile` approach (LWW + tombstones) for
  `owned_cards`; enforce the phase-16 owner guard (never push another user's
  rows) in the same change.
- **Offline art:** catalog images load from the network; when offline a card
  without a cached image shows the metadata placeholder (decision D3).

## Legacy collection

Legacy `Card` records stay visible in a clearly labelled "Old cards" section
until migrated. Migration (Feature 24, later) re-scans or manually resolves each
legacy card to a printing, creates `OwnedCard`s with `source:
"legacy-migration"`, and only after the human approves deletes legacy photos.
Nothing in Features 18–23 deletes or rewrites legacy data.

## Open decisions (need human approval)

| ID | Decision | Recommendation | Reversible? |
| --- | --- | --- | --- |
| D1 | Catalog provider | TCGdex only, confirmed by fixture coverage | Yes (adapter) |
| D2 | Vision model + spend control | Haiku-class Claude via Edge Function; €5 eval cap; key + console spend limit confirmed before any call | Yes |
| D3 | Offline artwork | Service-worker runtime cache of catalog images *on the device only* (no server-side art cache) | Yes |
| D4 | Trade Check and finishes | Verdict by printing; finish shown as a hint ("you have the normal one") | Yes |
| D5 | Recognition when signed out | Require sign-in (or Supabase anonymous auth) so the Edge Function can rate-limit per user | Partly |
| D6 | Test runner | Add `vitest` (dev dependency) | Yes |
| D7 | Child privacy | Parental notice before first AI scan; privacy policy names the vision provider; no photo retention | Production gate |
| D8 | Artwork licensing | Hot-link catalog images only; no redistribution; review before store release | Production gate |
| D9 | Live DB migration | Apply `owned_cards` migration to the live Supabase project | Gate at ticket 18.3 |
| D10 | Card languages and printing identity | **Decided 2026-10-09** (see below) | Yes (contract change) |
| D11 | Batch partial failure | **Decided 2026-10-10** (see below) | Yes |

### Decided

- **D10 — Card languages and printing identity (2026-10-09, human decision on
  ticket 18.1).** 2.0 supports card languages `en`, `es` and `ja` only:
  `CatalogLanguage = "en" | "es" | "ja"`. `fr`, `de`, `it` and `pt` are removed
  from the contract until a later Feature adds them, because TCGdex localizes
  category and energy-type names per language and each language needs its own
  recorded mapping. `CardPrinting.id` is language-qualified,
  `"{provider}:{language}:{providerCardId}"` (e.g. `tcgdex:es:swsh3-20`), so an
  English and a Spanish copy of the same card are different printings for
  ownership, duplicate badges and Trade Check. `getPrinting` accepts that form or
  the bare provider card id. The catalog adapter rejects an unmapped category or
  energy-type name with `CatalogError` instead of dropping it.

- **D11 — Batch partial failure (2026-10-10, human decision during the 19.1
  review).** When one card in a scan cannot be resolved — its catalog lookup
  fails, or its data trips the image-data guard — the rest of the batch is still
  returned. That card becomes `tier: "unmatched"` with a reason, so the child can
  retry or search for it manually. Only a failure of the whole request (no
  response, invalid response) rejects the scan with a `RecognitionError`.
  Implemented in 19.2 (server) and 20.1 (Batch Scan); 19.1 keeps its merged
  whole-batch behaviour until then.
