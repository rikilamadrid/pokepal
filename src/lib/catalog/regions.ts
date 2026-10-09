import type { PokedexRegion } from "@/types/catalog";

/** Last National Pokédex number of each region, in dex order. */
const REGION_RANGES: ReadonlyArray<readonly [PokedexRegion, number]> = [
  ["kanto", 151],
  ["johto", 251],
  ["hoenn", 386],
  ["sinnoh", 493],
  ["unova", 649],
  ["kalos", 721],
  ["alola", 809],
  ["galar", 898],
  ["hisui", 905],
  ["paldea", 1025],
];

/** Region a National Pokédex number belongs to, or null outside the table. */
export function regionForDexNo(dexNo: number): PokedexRegion | null {
  if (!Number.isInteger(dexNo) || dexNo < 1) return null;
  for (const [region, last] of REGION_RANGES) {
    if (dexNo <= last) return region;
  }
  return null;
}
