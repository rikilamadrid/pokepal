import type { CardPrinting } from "@/types/catalog";
import type { NewOwnedCard } from "@/lib/owned-cards";

/**
 * DEV ONLY — loaded by `useOwnedCollection` through a dynamic import that runs
 * only when `NODE_ENV === "development"` and the URL has `?seed-v2`, so the UI
 * has 2.0 data before recognition exists. Never imported by production code.
 *
 * Each snapshot is `mapTcgdexCard` applied to a recorded TCGdex fixture under
 * `test/fixtures/tcgdex/` (fetchedAt pinned); the "dev seed" suite in
 * `test/collection/owned-store.test.ts` fails if they drift. Includes three
 * Charizard VMAX printings (en + es Darkness Ablaze, en Champion's Path) so
 * exact-printing counts are visible, and `30th-c-001`, which has no catalog
 * image, so the placeholder is visible.
 */
export const DEV_PRINTINGS: readonly CardPrinting[] = [
  {
    "id": "tcgdex:en:swsh3-20",
    "provider": "tcgdex",
    "providerCardId": "swsh3-20",
    "language": "en",
    "name": "Charizard VMAX",
    "category": "pokemon",
    "collectorNumber": "20",
    "set": {
      "id": "swsh3",
      "name": "Darkness Ablaze",
      "officialCount": 189,
      "totalCount": 201,
      "releaseDate": null,
      "symbolUrl": "https://assets.tcgdex.net/univ/swsh/swsh3/symbol",
      "logoUrl": "https://assets.tcgdex.net/en/swsh/swsh3/logo"
    },
    "rarity": "Holo Rare VMAX",
    "energyTypes": [
      "fire"
    ],
    "stage": "VMAX",
    "hp": 330,
    "dexNos": [
      6
    ],
    "illustrator": "aky CG Works",
    "regulationMark": "D",
    "availableFinishes": [
      "holo"
    ],
    "imageUrl": "https://assets.tcgdex.net/en/swsh/swsh3/20",
    "fetchedAt": "2026-10-09T12:00:00.000Z"
  },
  {
    "id": "tcgdex:es:swsh3-20",
    "provider": "tcgdex",
    "providerCardId": "swsh3-20",
    "language": "es",
    "name": "Charizard VMAX",
    "category": "pokemon",
    "collectorNumber": "20",
    "set": {
      "id": "swsh3",
      "name": "Oscuridad Incandescente",
      "officialCount": 189,
      "totalCount": 201,
      "releaseDate": null,
      "symbolUrl": "https://assets.tcgdex.net/univ/swsh/swsh3/symbol",
      "logoUrl": "https://assets.tcgdex.net/es/swsh/swsh3/logo"
    },
    "rarity": "Holo Rara VMAX",
    "energyTypes": [
      "fire"
    ],
    "stage": "VMAX",
    "hp": 330,
    "dexNos": [
      6
    ],
    "illustrator": "aky CG Works",
    "regulationMark": "D",
    "availableFinishes": [
      "holo"
    ],
    "imageUrl": "https://assets.tcgdex.net/es/swsh/swsh3/20",
    "fetchedAt": "2026-10-09T12:00:00.000Z"
  },
  {
    "id": "tcgdex:en:swsh3.5-74",
    "provider": "tcgdex",
    "providerCardId": "swsh3.5-74",
    "language": "en",
    "name": "Charizard VMAX",
    "category": "pokemon",
    "collectorNumber": "74",
    "set": {
      "id": "swsh3.5",
      "name": "Champion's Path",
      "officialCount": 73,
      "totalCount": 80,
      "releaseDate": null,
      "symbolUrl": "https://assets.tcgdex.net/univ/swsh/swsh3.5/symbol",
      "logoUrl": "https://assets.tcgdex.net/en/swsh/swsh3.5/logo"
    },
    "rarity": "Secret Rare",
    "energyTypes": [
      "fire"
    ],
    "stage": "VMAX",
    "hp": 330,
    "dexNos": [
      6
    ],
    "illustrator": "aky CG Works",
    "regulationMark": "D",
    "availableFinishes": [
      "holo"
    ],
    "imageUrl": "https://assets.tcgdex.net/en/swsh/swsh3.5/74",
    "fetchedAt": "2026-10-09T12:00:00.000Z"
  },
  {
    "id": "tcgdex:ja:SV2a-006",
    "provider": "tcgdex",
    "providerCardId": "SV2a-006",
    "language": "ja",
    "name": "リザードンex",
    "category": "pokemon",
    "collectorNumber": "006",
    "set": {
      "id": "SV2a",
      "name": "ポケモンカード151",
      "officialCount": 165,
      "totalCount": 210,
      "releaseDate": null,
      "symbolUrl": null,
      "logoUrl": null
    },
    "rarity": "Double rare",
    "energyTypes": [
      "fire"
    ],
    "stage": "Stage2",
    "hp": 330,
    "dexNos": [
      6
    ],
    "illustrator": "PLANETA Mochizuki",
    "regulationMark": "G",
    "availableFinishes": [
      "holo"
    ],
    "imageUrl": "https://assets.tcgdex.net/ja/SV/SV2a/006",
    "fetchedAt": "2026-10-09T12:00:00.000Z"
  },
  {
    "id": "tcgdex:en:swsh1-178",
    "provider": "tcgdex",
    "providerCardId": "swsh1-178",
    "language": "en",
    "name": "Professor's Research (Professor Magnolia)",
    "category": "trainer",
    "collectorNumber": "178",
    "set": {
      "id": "swsh1",
      "name": "Sword & Shield",
      "officialCount": 202,
      "totalCount": 216,
      "releaseDate": null,
      "symbolUrl": "https://assets.tcgdex.net/univ/swsh/swsh1/symbol",
      "logoUrl": "https://assets.tcgdex.net/en/swsh/swsh1/logo"
    },
    "rarity": "Holo Rare",
    "energyTypes": [],
    "stage": null,
    "hp": null,
    "dexNos": [],
    "illustrator": "Yusuke Ohmura",
    "regulationMark": "D",
    "availableFinishes": [
      "holo",
      "reverse"
    ],
    "imageUrl": "https://assets.tcgdex.net/en/swsh/swsh1/178",
    "fetchedAt": "2026-10-09T12:00:00.000Z"
  },
  {
    "id": "tcgdex:en:30th-c-001",
    "provider": "tcgdex",
    "providerCardId": "30th-c-001",
    "language": "en",
    "name": "Charizard",
    "category": "pokemon",
    "collectorNumber": "001",
    "set": {
      "id": "30th-c",
      "name": "30th Classic Collection",
      "officialCount": 30,
      "totalCount": 30,
      "releaseDate": null,
      "symbolUrl": null,
      "logoUrl": null
    },
    "rarity": null,
    "energyTypes": [
      "fire"
    ],
    "stage": "Stage2",
    "hp": 120,
    "dexNos": [
      6
    ],
    "illustrator": "Mitsuhiro Arita",
    "regulationMark": null,
    "availableFinishes": [
      "holo"
    ],
    "imageUrl": null,
    "fetchedAt": "2026-10-09T12:00:00.000Z"
  }
];

const [charizardEn, charizardEs, charizardCp, charizardExJa, research, noImage] =
  DEV_PRINTINGS;

/** Three copies of one printing (×3), plus one copy each of five others. */
export const DEV_OWNED_SEED: readonly NewOwnedCard[] = [
  { printing: charizardEn, source: "manual", finish: "holo", favorite: true },
  { printing: charizardEn, source: "manual", finish: "holo" },
  { printing: charizardEn, source: "manual", finish: null },
  { printing: charizardEs, source: "manual", finish: "holo" },
  { printing: charizardCp, source: "manual", finish: null },
  { printing: charizardExJa, source: "manual", finish: null, favorite: true },
  { printing: research, source: "manual", finish: "holo" },
  { printing: noImage, source: "manual", finish: null },
];
