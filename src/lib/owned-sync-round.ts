import type { SupabaseClient } from "@supabase/supabase-js";
import type { OwnedState } from "@/lib/owned-cards";
import {
  buildPushRows,
  reconcileOwnedCards,
  resetForOwner,
  toOwnedSyncChanges,
  type OwnedSyncChanges,
} from "@/lib/owned-sync";
import {
  fetchOwnedRows,
  markOwnedRowDeleted,
  upsertOwnedRows,
} from "@/lib/supabase-owned-cards";

export interface OwnedSyncRoundInput {
  supabase: SupabaseClient;
  ownerId: string;
  /** Local state snapshot to plan from. */
  state: OwnedState;
  /** True while `ownerId` is still the signed-in user. Checked after every await. */
  isCurrentOwner: () => boolean;
}

/**
 * One owned-cards sync round: pull, reconcile, push. Returns the local changes
 * to apply, or `null` when the signed-in user changed while the round awaited
 * IO — the stale round stops and leaves its local half to the new owner's run.
 */
export async function runOwnedSyncRound({
  supabase,
  ownerId,
  state: snapshot,
  isCurrentOwner,
}: OwnedSyncRoundInput): Promise<OwnedSyncChanges | null> {
  const state = resetForOwner(snapshot, ownerId);
  const { rows, unreadableIds } = await fetchOwnedRows(supabase, ownerId);
  if (!isCurrentOwner()) return null;
  const plan = reconcileOwnedCards(state.owned, state.tombstones, rows, ownerId, unreadableIds);

  const pushRows = buildPushRows(plan.pushCards, state.printings, ownerId);
  await upsertOwnedRows(supabase, pushRows);
  if (!isCurrentOwner()) return null;
  for (const del of plan.pushDeletes) {
    await markOwnedRowDeleted(supabase, ownerId, del.id, del.deletedAt);
    if (!isCurrentOwner()) return null;
  }

  return toOwnedSyncChanges(plan, pushRows, ownerId);
}
