import { z } from "zod";
import type { CardType, Rarity } from "@/types/card";

/** The six card types, in picker order — tied to `CardType`. */
export const CARD_TYPES = [
  "fire",
  "water",
  "grass",
  "electric",
  "psychic",
  "rock",
] as const satisfies readonly CardType[];

/** The four rarities, in ascending order — tied to `Rarity`. */
export const RARITIES = [
  "common",
  "uncommon",
  "rare",
  "holo",
] as const satisfies readonly Rarity[];

/**
 * Validation for the Scan tag form. `dexNo` is optional — blank means the store
 * auto-increments via `nextDexNumber()` on save; a provided value must be digits.
 */
export const scanFormSchema = z.object({
  name: z.string().trim().min(1, "Give your card a name"),
  type: z.enum(CARD_TYPES),
  dexNo: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d+$/.test(v), "Dex must be a number"),
  rarity: z.enum(RARITIES),
  favorite: z.boolean(),
});

export type ScanFormValues = z.infer<typeof scanFormSchema>;
