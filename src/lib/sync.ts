import type { Card } from "@/types/card";
import type { Tombstones } from "@/lib/storage";
import type { CardRow } from "@/lib/supabase-cards";

/**
 * Reconciliation plan produced by {@link reconcile}. Pure data — the caller
 * (useSync) performs the IO: resolving images, writing rows, applying to the
 * local store.
 */
export interface SyncPlan {
  /** Remote-won rows to insert/update locally (img resolved by caller). */
  localUpsertRows: CardRow[];
  /** Remote-deleted cards: id → deletedAt. Remove from live + tombstone locally. */
  localDeletes: Record<string, string>;
  /** Tombstones to drop locally (a remote edit resurrected the card). */
  clearTombstones: string[];
  /** Local-won cards to push to the cloud (img resolved by caller). */
  pushCards: Card[];
  /** Local deletions to propagate as remote soft-deletes. */
  pushDeletes: { id: string; deletedAt: string }[];
}

/** Parse an ISO timestamp to epoch ms. Postgres returns `+00:00`/microsecond
 * formats that differ textually from our locally-written `…Z` strings, so
 * comparisons must be numeric, not lexicographic. */
function t(iso: string): number {
  return Date.parse(iso);
}

/**
 * Last-writer-wins reconciliation of the local collection against the remote
 * rows, comparing timestamps by parsed epoch. Pure and deterministic so it can
 * be reasoned about (and unit-tested) in isolation.
 *
 * Cases per id (union of local / remote / tombstones):
 *  - locally deleted (tombstone): resurrect if a newer remote edit exists, else
 *    push the soft-delete;
 *  - remotely deleted: accept the delete if newer, else push the local card back;
 *  - both live: newer `updatedAt` wins;
 *  - one side only: insert into the other.
 */
export function reconcile(
  local: Card[],
  tombstones: Tombstones,
  remote: CardRow[],
): SyncPlan {
  const plan: SyncPlan = {
    localUpsertRows: [],
    localDeletes: {},
    clearTombstones: [],
    pushCards: [],
    pushDeletes: [],
  };

  const localById = new Map(local.map((c) => [c.id, c]));
  const remoteById = new Map(remote.map((r) => [r.id, r]));
  const ids = new Set<string>([
    ...localById.keys(),
    ...remoteById.keys(),
    ...Object.keys(tombstones),
  ]);

  for (const id of ids) {
    const l = localById.get(id);
    const r = remoteById.get(id);
    const tomb = tombstones[id];

    // Case A — locally deleted.
    if (tomb) {
      if (r && !r.deleted_at) {
        if (t(r.updated_at) > t(tomb)) {
          // Remote edited after our delete → resurrect locally.
          plan.localUpsertRows.push(r);
          plan.clearTombstones.push(id);
        } else {
          // Our delete wins → propagate the soft-delete.
          plan.pushDeletes.push({ id, deletedAt: tomb });
        }
      }
      // r deleted already, or never synced (no r): nothing to do, keep tombstone.
      continue;
    }

    // Case B — remotely deleted (no local tombstone).
    if (r && r.deleted_at) {
      if (l && t(l.updatedAt) > t(r.updated_at)) {
        // Local edit is newer than the remote delete → resurrect remote.
        plan.pushCards.push(l);
      } else {
        // Accept the delete: drop locally (if present) and tombstone it so we
        // don't re-pull it next time.
        plan.localDeletes[id] = r.updated_at;
      }
      continue;
    }

    // Case C — both live, or one side only.
    if (l && r) {
      if (t(r.updated_at) > t(l.updatedAt)) plan.localUpsertRows.push(r);
      else if (t(l.updatedAt) > t(r.updated_at)) plan.pushCards.push(l);
      // equal → already in sync
    } else if (r && !l) {
      plan.localUpsertRows.push(r); // cloud-only → insert locally
    } else if (l && !r) {
      plan.pushCards.push(l); // local-only → insert into the cloud
    }
  }

  return plan;
}
