import type { Card } from "@/types/card";
import type { Tombstones } from "@/lib/storage";
import type { CardRow } from "@/lib/supabase-cards";

/**
 * Generic last-writer-wins plan produced by {@link reconcileRecords}. Pure
 * data — the caller performs the IO (writing rows, applying to the local store).
 * `L` is the local record shape, `R` the remote row shape.
 */
export interface LwwPlan<L, R> {
  /** Remote-won rows to insert/update locally. */
  localUpsertRows: R[];
  /** Remote-deleted records: id → deletedAt. Remove from live + tombstone locally. */
  localDeletes: Record<string, string>;
  /** Tombstones to drop locally (a remote edit resurrected the record). */
  clearTombstones: string[];
  /** Local-won records to push to the cloud. */
  pushCards: L[];
  /** Local deletions to propagate as remote soft-deletes. */
  pushDeletes: { id: string; deletedAt: string }[];
}

/** How {@link reconcileRecords} reads ids and timestamps from each side. */
export interface LwwAccessors<L, R> {
  localId: (record: L) => string;
  localUpdatedAt: (record: L) => string;
  remoteId: (row: R) => string;
  remoteUpdatedAt: (row: R) => string;
  remoteDeletedAt: (row: R) => string | null;
}

/**
 * Reconciliation plan produced by {@link reconcile}. Pure data — the caller
 * (useSync) performs the IO: resolving images, writing rows, applying to the
 * local store.
 */
export type SyncPlan = LwwPlan<Card, CardRow>;

/** Parse an ISO timestamp to epoch ms. Postgres returns `+00:00`/microsecond
 * formats that differ textually from our locally-written `…Z` strings, so
 * comparisons must be numeric, not lexicographic. */
function t(iso: string): number {
  return Date.parse(iso);
}

/**
 * Last-writer-wins reconciliation of local records against remote rows,
 * comparing timestamps by parsed epoch. Pure and deterministic so it can be
 * reasoned about (and unit-tested) in isolation.
 *
 * Cases per id (union of local / remote / tombstones):
 *  - locally deleted (tombstone): resurrect if a newer remote edit exists, else
 *    push the soft-delete;
 *  - remotely deleted: accept the delete if newer, else push the local record back;
 *  - both live: newer `updatedAt` wins;
 *  - one side only: insert into the other.
 */
export function reconcileRecords<L, R>(
  local: readonly L[],
  tombstones: Tombstones,
  remote: readonly R[],
  at: LwwAccessors<L, R>,
): LwwPlan<L, R> {
  const plan: LwwPlan<L, R> = {
    localUpsertRows: [],
    localDeletes: {},
    clearTombstones: [],
    pushCards: [],
    pushDeletes: [],
  };

  const localById = new Map(local.map((c) => [at.localId(c), c]));
  const remoteById = new Map(remote.map((r) => [at.remoteId(r), r]));
  const ids = new Set<string>([
    ...localById.keys(),
    ...remoteById.keys(),
    ...Object.keys(tombstones),
  ]);

  for (const id of ids) {
    const l = localById.get(id);
    const r = remoteById.get(id);
    const tomb = tombstones[id];
    const rDeleted = r ? at.remoteDeletedAt(r) : null;

    // Case A — locally deleted.
    if (tomb) {
      if (r && !rDeleted) {
        if (t(at.remoteUpdatedAt(r)) > t(tomb)) {
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
    if (r && rDeleted) {
      if (l && t(at.localUpdatedAt(l)) > t(at.remoteUpdatedAt(r))) {
        // Local edit is newer than the remote delete → resurrect remote.
        plan.pushCards.push(l);
      } else {
        // Accept the delete: drop locally (if present) and tombstone it so we
        // don't re-pull it next time.
        plan.localDeletes[id] = at.remoteUpdatedAt(r);
      }
      continue;
    }

    // Case C — both live, or one side only.
    if (l && r) {
      const remoteAt = t(at.remoteUpdatedAt(r));
      const localAt = t(at.localUpdatedAt(l));
      if (remoteAt > localAt) plan.localUpsertRows.push(r);
      else if (localAt > remoteAt) plan.pushCards.push(l);
      // equal → already in sync
    } else if (r && !l) {
      plan.localUpsertRows.push(r); // cloud-only → insert locally
    } else if (l && !r) {
      plan.pushCards.push(l); // local-only → insert into the cloud
    }
  }

  return plan;
}

const LEGACY_ACCESSORS: LwwAccessors<Card, CardRow> = {
  localId: (c) => c.id,
  localUpdatedAt: (c) => c.updatedAt,
  remoteId: (r) => r.id,
  remoteUpdatedAt: (r) => r.updated_at,
  remoteDeletedAt: (r) => r.deleted_at,
};

/** Legacy 1.x `Card` reconciliation — {@link reconcileRecords} over `cards` rows. */
export function reconcile(
  local: Card[],
  tombstones: Tombstones,
  remote: CardRow[],
): SyncPlan {
  return reconcileRecords(local, tombstones, remote, LEGACY_ACCESSORS);
}
