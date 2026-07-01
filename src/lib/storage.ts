import type { Card } from "@/types/card";

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

/** Read the persisted collection. Returns null when absent / unreadable / SSR. */
export function readCollection(): Card[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COLLECTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Card[]) : null;
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
    return parsed && typeof parsed === "object" ? (parsed as Tombstones) : {};
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
    return Array.isArray(parsed) ? new Set(parsed as string[]) : new Set();
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
