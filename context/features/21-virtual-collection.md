# Virtual Collection

## Status

Proposed

## Goal

Dalí browses his collection as beautiful, accurate virtual cards — real
artwork, exact quantities, and simple ways to find any card — on the existing
PokéPal shell.

## Context

- Read: `context/pokepal-2/02-target-architecture.md` (contracts),
  `context/project-overview.md` §UI / UX
- Relevant area: `src/components/card/`, `src/components/screens/`,
  `src/components/collection/`, `src/components/home/`,
  `src/lib/collection-utils.ts`
- Avoid: scan pipeline, sync internals

## Requirements

- `PokeCard` / `CardTile` render a `CardPrinting` with catalog artwork; a
  clearly labelled metadata placeholder when `imageUrl` is null or offline
  and uncached — never generated creature art for real cards.
- Quantity badge "×N" counts copies of the exact printing.
- Detail sheet: artwork large, set + collector number, rarity, energy types,
  Pokédex number/region, copies owned (by finish), favorite, release one copy.
- Browse by Pokémon (species grid ordered by Pokédex number).
- Filters: energy type, region, expansion, rarity, favorites, duplicates.
  Search: name, Pokédex number, collector number. Existing 120 ms debounce.
- Loading skeletons, empty, offline, and error states.
- Legacy cards remain visible in a labelled "Old cards" group.

## Out of Scope

- Discovery & delight features (set progress, celebrations) — later.
- Storage locations.

## Acceptance Criteria

- Two printings of Charizard show as two tiles; three copies of one printing
  show one tile with ×3.
- Every filter and search mode narrows correctly (unit-tested selectors).
- A printing without an image shows the labelled placeholder.
- Favorites and release still work for both 2.0 and legacy cards.

## Notes / Decisions

- Depends on Feature 18. Uses representative printing fixtures from the
  catalog adapter's recorded responses until real data exists.
