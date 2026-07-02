import type { Card, CardType, Rarity } from "@/types/card";
import { generateCreatureArt } from "@/lib/art-gen";

/** id → deletedAt (ISO). Soft-delete tombstones so releases propagate on sync. */
export type Tombstones = Record<string, string>;

/**
 * localStorage access for the collection. This is the ONLY module that touches
 * localStorage directly — everything else goes through the collection store's
 * actions, so the phase-12 sync engine can slot in without touching callers.
 */
export const COLLECTION_KEY = "collection";
/** Soft-delete tombstones (id → deletedAt ISO) so a release propagates via sync. */
export const TOMBSTONES_KEY = "collection:tombstones";
/** Ids whose captured image has been uploaded to Storage (avoids re-upload). */
export const UPLOADED_KEY = "collection:uploaded";

const CARD_TYPES = ["fire", "water", "grass", "electric", "psychic", "rock"] as const;
const RARITIES = ["common", "uncommon", "rare", "holo"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCardType(value: unknown): value is CardType {
  return typeof value === "string" && CARD_TYPES.includes(value as CardType);
}

function isRarity(value: unknown): value is Rarity {
  return typeof value === "string" && RARITIES.includes(value as Rarity);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function normalizeDate(value: unknown, fallback: string): string {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
    ? value
    : fallback;
}

function normalizeCard(value: unknown, index: number): Card | null {
  if (!isRecord(value)) return null;
  if (!isNonEmptyString(value.name)) return null;

  const now = new Date().toISOString();
  const type = isCardType(value.type) ? value.type : "water";
  const dexNo = isNonEmptyString(value.dexNo) ? value.dexNo.trim() : "000";
  const name = value.name.trim();
  const caughtAt = normalizeDate(value.caughtAt, now);

  return {
    id:
      isNonEmptyString(value.id)
        ? value.id
        : `recovered-${Date.now()}-${index}`,
    ownerId: typeof value.ownerId === "string" ? value.ownerId : "",
    name,
    dexNo,
    type,
    rarity: isRarity(value.rarity) ? value.rarity : "common",
    favorite: typeof value.favorite === "boolean" ? value.favorite : false,
    img:
      isNonEmptyString(value.img)
        ? value.img
        : generateCreatureArt(name, dexNo, type),
    caughtAt,
    updatedAt: normalizeDate(value.updatedAt, caughtAt),
  };
}

/** Read the persisted collection. Returns null when absent / unreadable / SSR. */
export function readCollection(): Card[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COLLECTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .map((item, index) => normalizeCard(item, index))
      .filter((card): card is Card => Boolean(card));
  } catch {
    return null;
  }
}

/** Persist the collection. No-ops during SSR. */
export function writeCollection(cards: Card[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COLLECTION_KEY, JSON.stringify(cards));
  } catch {
    // storage full / unavailable — the in-memory store stays authoritative
  }
}

/** Read soft-delete tombstones. Returns an empty map when absent / SSR. */
export function readTombstones(): Tombstones {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(TOMBSTONES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    const tombstones: Tombstones = {};
    for (const [id, deletedAt] of Object.entries(parsed)) {
      if (
        id.trim() !== "" &&
        typeof deletedAt === "string" &&
        Number.isFinite(Date.parse(deletedAt))
      ) {
        tombstones[id] = deletedAt;
      }
    }
    return tombstones;
  } catch {
    return {};
  }
}

/** Persist soft-delete tombstones. No-ops during SSR. */
export function writeTombstones(tombstones: Tombstones): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOMBSTONES_KEY, JSON.stringify(tombstones));
  } catch {
    // ignore — in-memory state stays authoritative
  }
}

/** Read the set of card ids whose captured image is already uploaded. */
export function readUploadedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(UPLOADED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter(isNonEmptyString));
  } catch {
    return new Set();
  }
}

/** Persist the uploaded-image id set. No-ops during SSR. */
export function writeUploadedIds(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(UPLOADED_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}
