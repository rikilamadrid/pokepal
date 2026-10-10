"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useOwnedCollection } from "@/hooks/useOwnedCollection";
import {
  buildPushRows,
  hasOwnedSyncChanges,
  reconcileOwnedCards,
  resetForOwner,
  toOwnedSyncChanges,
} from "@/lib/owned-sync";
import {
  fetchOwnedRows,
  markOwnedRowDeleted,
  OwnedCardsUnavailableError,
  upsertOwnedRows,
} from "@/lib/supabase-owned-cards";
import type { OwnedState } from "@/lib/owned-cards";

/** Debounce window for syncing after a local mutation. */
const CHANGE_DEBOUNCE_MS = 1500;
const ERROR_TOAST_ID = "owned-sync-error";

/**
 * Background cloud sync of PokéPal 2.0 owned cards against `owned_cards`.
 * Runs beside the legacy `cards` sync (useSync), which it never touches.
 * Signed out or unconfigured → does nothing.
 */
export function useOwnedSync(): void {
  const { configured, user } = useAuth();
  const { owned, printings, tombstones, applySync, resetForOwner: resetOwner } =
    useOwnedCollection();

  // Latest state read inside the stable runSync; written in effects.
  const stateRef = useRef<OwnedState>({ owned, printings, tombstones });
  const userIdRef = useRef<string | null>(user?.id ?? null);
  useEffect(() => {
    stateRef.current = { owned, printings, tombstones };
  }, [owned, printings, tombstones]);
  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user?.id]);

  const running = useRef(false);
  const dirty = useRef(false);
  const runSyncRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const enabled = configured && Boolean(user);

  const runSync = useCallback(async (): Promise<void> => {
    if (!configured) return;
    const ownerId = userIdRef.current;
    const supabase = getSupabase();
    if (!ownerId || !supabase) return;
    // Account-change reset first, even offline: another account's copies
    // leave this device's view as soon as a different user is signed in.
    resetOwner(ownerId);
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (running.current) {
      dirty.current = true;
      return;
    }
    running.current = true;

    try {
      const state = resetForOwner(stateRef.current, ownerId);
      const remote = await fetchOwnedRows(supabase, ownerId);
      const plan = reconcileOwnedCards(state.owned, state.tombstones, remote, ownerId);

      const pushRows = buildPushRows(plan.pushCards, state.printings, ownerId);
      await upsertOwnedRows(supabase, pushRows);
      for (const del of plan.pushDeletes) {
        await markOwnedRowDeleted(supabase, ownerId, del.id, del.deletedAt);
      }

      const changes = toOwnedSyncChanges(plan, pushRows, ownerId);
      if (hasOwnedSyncChanges(changes)) applySync(changes);
      toast.dismiss(ERROR_TOAST_ID);
    } catch (err) {
      // Table not migrated on this project yet (gate D9): stay local, quietly.
      if (err instanceof OwnedCardsUnavailableError) return;
      toast.error("Couldn’t back up your cards.", {
        id: ERROR_TOAST_ID,
        action: { label: "Retry", onClick: () => void runSyncRef.current() },
      });
    } finally {
      running.current = false;
      if (dirty.current) {
        dirty.current = false;
        void runSyncRef.current();
      }
    }
  }, [configured, applySync, resetOwner]);

  useEffect(() => {
    runSyncRef.current = runSync;
  }, [runSync]);

  // Sign-in / account change: reset + pull the user's cloud copies.
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => void runSync(), 0);
    return () => clearTimeout(t);
  }, [enabled, user?.id, runSync]);

  // Debounced sync after local mutations (add / favorite / release).
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => void runSync(), CHANGE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [enabled, owned, tombstones, runSync]);

  // Sync on focus + reconnect.
  useEffect(() => {
    if (!enabled) return;
    const onWake = () => void runSync();
    window.addEventListener("focus", onWake);
    window.addEventListener("online", onWake);
    return () => {
      window.removeEventListener("focus", onWake);
      window.removeEventListener("online", onWake);
    };
  }, [enabled, runSync]);
}
