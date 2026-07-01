import type { Card } from "@/types/card";

/**
 * localStorage access for the collection. This is the ONLY module that touches
 * localStorage directly — everything else goes through the collection store's
 * actions, so the phase-12 sync engine can slot in without touching callers.
 */
export const COLLECTION_KEY = "collection";

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
