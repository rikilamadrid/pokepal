"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useOwnedCollection } from "@/hooks/useOwnedCollection";
import { hasOwnedSyncChanges } from "@/lib/owned-sync";
import { runOwnedSyncRound } from "@/lib/owned-sync-round";
import { OwnedCardsUnavailableError } from "@/lib/supabase-owned-cards";
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
      const changes = await runOwnedSyncRound({
        supabase,
        ownerId,
        state: stateRef.current,
        isCurrentOwner: () => userIdRef.current === ownerId,
      });
      // null: the signed-in user changed mid-flight; the new owner's run takes over.
      if (!changes) return;
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
        // Next task, so the rerun plans from the committed state (stateRef is
        // written in an effect after React commits this run's applySync).
        setTimeout(() => void runSyncRef.current(), 0);
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
