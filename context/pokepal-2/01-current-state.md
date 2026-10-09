# PokéPal 2.0 — Current-State Audit

Audited 2026-10-09 against `main` @ `f32548f` (after merging
`fix-vercel-black-page`). Read-only audit; no product code changed.

## Summary

PokéPal 1.x is a polished, working **local-first photo log**, not a TCG
catalog. Its `Card` record fuses three concepts PokéPal 2.0 must separate —
the Pokémon species, the printed card, and the physical copy a child owns —
and its stored image is usually the child's own photo. Nothing in the app
knows what a real Pokémon TCG card is. The shell, visual identity, sync engine,
PWA and iOS packaging are solid foundations worth keeping.

## What exists and works

| Area | State | Evidence |
| --- | --- | --- |
| App shell, tabs, transitions, theming | Solid, keep | `src/components/shell/`, `globals.css` |
| Card visuals (`PokeCard`, `CardTile`, holo sweep) | Solid, keep and extend | `src/components/card/` |
| Local-first store | Works; one React context over localStorage | `src/hooks/useCollection.tsx`, `src/lib/storage.ts` |
| Storage boundary normalization | Repairs/filters malformed rows | `src/lib/storage.ts` (`normalizeCard`) |
| Cloud sync (LWW + tombstones) | Verified in-browser (phase 12) | `src/lib/sync.ts` (pure `reconcile`), `src/hooks/useSync.tsx` |
| Auth (magic link, native deep link) | Verified | `src/hooks/useAuth.tsx` |
| Scan flow (camera → confirm → manual tag) | Works; single card, manual entry | `src/components/scan/` |
| Camera adapter (web + Capacitor) | Good seam, reuse | `src/lib/camera.ts`, `src/hooks/useCamera.ts` |
| PWA + iOS (Capacitor 7) | Shipped to simulator / TestFlight prep | `public/sw.js`, `ios/`, `NATIVE.md` |
| CI | Lint + build only (GitHub Actions) | `.github/workflows/ci.yml` |

## Gaps and defects relevant to 2.0

### Domain model

- **One flat `Card`** (`src/types/card.ts`): `name`, `dexNo`, `type`, `rarity`,
  `img`, `favorite`, `caughtAt`. No printing identity (set, collector number,
  language, variant), no species identity, no quantity.
- **`dexNo` is user-typed**, auto-incremented (`nextDexNumber`) when blank. It is
  neither a National Pokédex number nor a collector number.
- **`type`** is 6 invented values (fire/water/grass/electric/psychic/rock). Real
  TCG energy types are 11 (Grass, Fire, Water, Lightning, Psychic, Fighting,
  Darkness, Metal, Fairy, Dragon, Colorless), distinct from the 18 video-game
  Pokémon types. Trainer and Energy cards have no Pokémon type at all.
- **`rarity`** is 4 invented values; real rarities are dozens of strings
  ("Holo Rare VMAX", "Illustration Rare", …).
- **Seed data is fictional** ("Emberling", "Tidaltail") with generated SVG art.

### Duplicate logic is wrong for 2.0

`findDuplicates` (`src/lib/collection-utils.ts`) groups by `dexNo`. Two different
Charizard printings would count as duplicates; the same printing entered with
different typed numbers would not. Trade Check needs exact-printing counts.

### ID generation breaks batch inserts

`addCard` mints `card-${Date.now()}`. Two cards added in the same millisecond
(a batch import) collide; the later one overwrites the earlier on sync (upsert by
primary key). `addCard` also adds one card per state update.

### Photos are collection assets today

- Captured photos are stored as **base64 JPEG data URIs in localStorage**
  (≈40–80 KB each; localStorage quota is ~5 MB, so roughly 60–120 photo cards
  before writes silently fail — `writeCollection` swallows the error).
- On sync, photos upload to the private **`card-images`** Supabase bucket
  (`{userId}/{cardId}.jpg`), tracked by the `collection:uploaded` key, and are
  displayed via 7-day signed URLs. This directly contradicts the 2.0 principle
  and is the legacy-photo migration surface.

### Backend

- Single `cards` table (Prisma migration `20260701212313_init_cards`) mirroring
  the flat `Card`; RLS owner-only; soft delete via `deleted_at`.
- **No Edge Functions** (`supabase/` does not exist). No server-side code at all.
- **Known cross-account leak** on shared devices (phase-16 spec): signing in as
  user B pushes user A's leftover local cards into B's account because
  `cardToRow` forces `owner_id`. Still open; 2.0 sync changes must not widen it.

### Quality

- **No automated tests and no test runner.** `reconcile()` was written to be
  unit-testable but never was. CI proves only lint + build.
- No error tracking, no latency measurement, no fixtures.

### Repository hygiene

- File-sync-service duplicates (`* 2.*`) recur — 11 untracked in the working
  tree and 188 inside `node_modules` (which broke `next build`; fixed by
  `npm ci` on 2026-10-09). Untracked duplicates were left untouched.

## Constraints 2.0 must respect

- **Static export** (`output: 'export'`): no API routes or Server Actions. Vision
  inference and any key-holding call must run in a **Supabase Edge Function**.
- **Local-first**: browsing must work offline; recognition requires network and
  must say so clearly.
- **Capacitor 7 / Node 20** toolchain pin.
- **Kids-category** App Store rules: no third-party ad/analytics SDKs; photos
  sent to an AI provider need parental notice and a privacy-policy update.

## Catalog provider facts gathered during the audit

- **pokemontcg.io** is deprecated: no new key registrations; existing keys work
  until 2027-03-01; successor **Scrydex** is paid (from $29/month, no free tier).
- **TCGdex** (`api.tcgdex.net/v2/{lang}`): free, no key, open-source (MIT code),
  10+ languages incl. Japanese. Verified live: `GET /v2/en/cards/swsh3-20`
  returns exact printing id `swsh3-20`, `localId` (collector number) `20`, set
  `swsh3` "Darkness Ablaze" (189 official / 201 total), `dexId: [6]`,
  `types: ["Fire"]`, `stage`, `rarity: "Holo Rare VMAX"`, `variants`
  (normal/reverse/holo/firstEdition), `illustrator`, and an image base URL
  (`…/high.webp` → 200, 92 KB WebP).
- TCGdex also returns **market prices** (Cardmarket/TCGplayer) — 2.0 must strip
  them (pricing is out of scope).
- Some TCGdex printings have **no image** (e.g. `30th-c-001`), so the
  metadata-only placeholder is a real requirement, not an edge case.
- Card artwork is © Pokémon/Nintendo/Creatures/GAME FREAK regardless of the
  API's code license. Hot-linking catalog images is the lowest-risk default;
  any self-hosted art cache needs explicit approval.
