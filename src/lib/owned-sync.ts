import type { CardPrinting } from "@/types/catalog";
import type { OwnedCard } from "@/types/collection";
import type { OwnedState } from "@/lib/owned-cards";
import type { PrintingCache, Tombstones } from "@/lib/storage";
import { reconcileRecords, type LwwAccessors, type LwwPlan } from "@/lib/sync";
import {
  ownedCardToRow,
  rowToOwnedCard,
  type OwnedCardRow,
} from "@/lib/supabase-owned-cards";

/**
 * Pure sync logic for PokéPal 2.0 owned cards. The hook (`useOwnedSync`) does
 * the IO; everything here is deterministic and unit-tested.
 *
 * Owner guard (phase-16, applied to 2.0 data): a copy is eligible to sync for
 * `ownerId` only when it is unclaimed (`""`, this device's local work) or
 * already owned by `ownerId`. Another account's copies are never pushed, and
 * another account's rows are never pulled.
 */

export type OwnedSyncPlan = LwwPlan<OwnedCard, OwnedCardRow>;

const OWNED_ACCESSORS: LwwAccessors<OwnedCard, OwnedCardRow> = {
  localId: (c) => c.id,
  localUpdatedAt: (c) => c.updatedAt,
  remoteId: (r) => r.id,
  remoteUpdatedAt: (r) => r.updated_at,
  remoteDeletedAt: (r) => r.deleted_at,
};

/** True when `card` may sync for `ownerId`: unclaimed, or already theirs. */
export function isEligibleForOwner(card: OwnedCard, ownerId: string): boolean {
  return card.ownerId === "" || card.ownerId === ownerId;
}

/**
 * Last-writer-wins reconciliation of local copies against `ownerId`'s rows,
 * behind the owner guard: foreign local copies are excluded from the push set,
 * and foreign remote rows are ignored.
 *
 * `unreadableIds` are rows that exist in the cloud but failed validation. Their
 * state (a newer edit or soft-delete) is unknown, so nothing is pushed for them
 * and the local copy is left untouched.
 */
export function reconcileOwnedCards(
  local: readonly OwnedCard[],
  tombstones: Tombstones,
  remote: readonly OwnedCardRow[],
  ownerId: string,
  unreadableIds: readonly string[] = [],
): OwnedSyncPlan {
  const eligible = local.filter((card) => isEligibleForOwner(card, ownerId));
  const own = remote.filter((row) => row.owner_id === ownerId);
  const plan = reconcileRecords(eligible, tombstones, own, OWNED_ACCESSORS);
  if (unreadableIds.length === 0) return plan;
  const unreadable = new Set(unreadableIds);
  return {
    ...plan,
    pushCards: plan.pushCards.filter((card) => !unreadable.has(card.id)),
    pushDeletes: plan.pushDeletes.filter((del) => !unreadable.has(del.id)),
  };
}

/**
 * Account-change reset: drop every copy synced under another account, keeping
 * unclaimed local work and `ownerId`'s own copies. Run before syncing as
 * `ownerId`, so a different user on this device starts from their own cloud
 * collection. Tombstones and the printing cache are kept (ids are UUIDs, and
 * printings are public catalog data). Unchanged state is returned as-is.
 */
export function resetForOwner(state: OwnedState, ownerId: string): OwnedState {
  const owned = state.owned.filter((card) => isEligibleForOwner(card, ownerId));
  return owned.length === state.owned.length ? state : { ...state, owned };
}

/** Rows to push: local winners with their printing snapshot, owned by `ownerId`. */
export function buildPushRows(
  cards: readonly OwnedCard[],
  printings: PrintingCache,
  ownerId: string,
): OwnedCardRow[] {
  const rows: OwnedCardRow[] = [];
  for (const card of cards) {
    if (!isEligibleForOwner(card, ownerId)) continue;
    const printing = printings[card.printingId];
    // Without its snapshot a copy can't render elsewhere; it stays local and
    // is retried on the next sync.
    if (!printing) continue;
    rows.push(ownedCardToRow(card, ownerId, printing));
  }
  return rows;
}

/** The local half of a sync, applied to the store in one transition. */
export interface OwnedSyncChanges {
  /** Remote-won copies to insert/update. */
  upsert: OwnedCard[];
  /** Printing snapshots of pulled copies. */
  printings: CardPrinting[];
  /** Remote deletions: id → deletedAt. */
  deletes: Record<string, string>;
  /** Tombstones to drop (a remote edit resurrected the copy). */
  clearTombstones: string[];
  /** Unclaimed copies that were pushed for `ownerId`. */
  claimedIds: string[];
  ownerId: string;
}

/** Build the local changes for a plan whose pushes succeeded. */
export function toOwnedSyncChanges(
  plan: OwnedSyncPlan,
  pushed: readonly OwnedCardRow[],
  ownerId: string,
): OwnedSyncChanges {
  return {
    upsert: plan.localUpsertRows.map(rowToOwnedCard),
    printings: plan.localUpsertRows.map((row) => row.printing),
    deletes: plan.localDeletes,
    clearTombstones: plan.clearTombstones,
    claimedIds: pushed.map((row) => row.id),
    ownerId,
  };
}

/** True when applying `changes` would alter local state. */
export function hasOwnedSyncChanges(changes: OwnedSyncChanges): boolean {
  return (
    changes.upsert.length > 0 ||
    Object.keys(changes.deletes).length > 0 ||
    changes.clearTombstones.length > 0 ||
    changes.claimedIds.length > 0
  );
}

function newestFirst(a: OwnedCard, b: OwnedCard): number {
  return Date.parse(b.acquiredAt) - Date.parse(a.acquiredAt);
}

/**
 * Apply a sync's local changes to the current store state. The state may have
 * moved on since the plan was made: a copy released meanwhile is not
 * resurrected by a pull (unless the plan itself cleared its tombstone), a
 * newer local edit is not overwritten, and only still-unclaimed copies are
 * claimed.
 */
export function applyOwnedSync(
  state: OwnedState,
  changes: OwnedSyncChanges,
): OwnedState {
  const tombstones: Tombstones = { ...state.tombstones };
  for (const id of changes.clearTombstones) delete tombstones[id];
  Object.assign(tombstones, changes.deletes);

  const claimed = new Set(changes.claimedIds);
  const byId = new Map<string, OwnedCard>();
  for (const card of state.owned) {
    if (changes.deletes[card.id]) continue;
    const claim = claimed.has(card.id) && card.ownerId === "";
    byId.set(card.id, claim ? { ...card, ownerId: changes.ownerId } : card);
  }
  for (const card of changes.upsert) {
    if (tombstones[card.id] || changes.deletes[card.id]) continue;
    const current = byId.get(card.id);
    // A local edit made while the sync ran wins; it is pushed next sync.
    if (current && Date.parse(current.updatedAt) > Date.parse(card.updatedAt)) continue;
    byId.set(card.id, card);
  }

  const printings: PrintingCache = { ...state.printings };
  for (const printing of changes.printings) printings[printing.id] = printing;

  return {
    owned: [...byId.values()].sort(newestFirst),
    printings,
    tombstones,
  };
}
