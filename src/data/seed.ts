import type { Card, CardType, Rarity } from "@/types/card";
import { generateCreatureArt } from "@/lib/art-gen";

interface SeedSpec {
  name: string;
  dexNo: string;
  type: CardType;
  rarity: Rarity;
  favorite?: boolean;
}

/**
 * ~10 starter creatures so the app never opens empty. Includes a holo hero and
 * a shared dex number (#014) to exercise duplicate detection. Art is generated
 * deterministically from name + dexNo — no image bytes stored.
 */
const SEED_SPECS: SeedSpec[] = [
  { name: "Emberling", dexNo: "004", type: "fire", rarity: "common" },
  { name: "Sparkit", dexNo: "025", type: "electric", rarity: "uncommon", favorite: true },
  { name: "Mossling", dexNo: "010", type: "grass", rarity: "common" },
  { name: "Pebblor", dexNo: "074", type: "rock", rarity: "common" },
  { name: "Dreamly", dexNo: "036", type: "psychic", rarity: "rare", favorite: true },
  { name: "Bubblet", dexNo: "014", type: "water", rarity: "common" },
  { name: "Tidaltail", dexNo: "008", type: "water", rarity: "holo", favorite: true },
  { name: "Cindermaw", dexNo: "059", type: "fire", rarity: "rare" },
  { name: "Voltfin", dexNo: "014", type: "electric", rarity: "uncommon" },
  { name: "Glimmox", dexNo: "063", type: "psychic", rarity: "holo" },
];

/**
 * Fresh seed cards. Timestamps are staggered so the last spec is the newest
 * catch (drives the home hero). Built lazily so `Date.now()` reflects seed time.
 */
export function createSeedCards(): Card[] {
  const now = Date.now();
  return SEED_SPECS.map((spec, i) => {
    // oldest first → last item is newest; 1h apart
    const ts = new Date(now - (SEED_SPECS.length - 1 - i) * 3_600_000).toISOString();
    return {
      id: `seed-${i + 1}`,
      ownerId: "",
      name: spec.name,
      dexNo: spec.dexNo,
      type: spec.type,
      rarity: spec.rarity,
      favorite: spec.favorite ?? false,
      img: generateCreatureArt(spec.name, spec.dexNo, spec.type),
      caughtAt: ts,
      updatedAt: ts,
    };
  });
}
