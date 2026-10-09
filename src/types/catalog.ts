/**
 * PokéPal 2.0 catalog contract — verbatim from
 * context/pokepal-2/02-target-architecture.md §Domain boundaries.
 * Change the contract there, not here.
 */

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
