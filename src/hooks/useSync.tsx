"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import type { Card } from "@/types/card";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useCollection } from "@/hooks/useCollection";
import { reconcile } from "@/lib/sync";
import {
  cardToRow,
  fetchAllRows,
  markRowDeleted,
  resolvePullImg,
  resolvePushImg,
  rowToCard,
  upsertRows,
  type CardRow,
} from "@/lib/supabase-cards";
import { readUploadedIds, writeUploadedIds } from "@/lib/storage";

export type SyncStatus = "idle" | "syncing" | "offline" | "error";

interface SyncContextValue {
  /** Whether cloud sync applies (configured + signed in). */
  enabled: boolean;
  status: SyncStatus;
  /** Epoch ms of the last successful sync, or null. */
  lastSyncedAt: number | null;
  error: string | null;
  /** Manually trigger a sync (e.g. a Retry button). */
  syncNow: () => void;
}

const SyncContext = createContext<SyncContextValue | null>(null);

/** Debounce window for syncing after a local mutation. */
const CHANGE_DEBOUNCE_MS = 1500;

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { configured, user } = useAuth();
  const { cards, tombstones, applySync } = useCollection();

  const [status, setStatus] = useState<SyncStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Latest state read inside the stable runSync (avoids stale closures without
  // re-creating the sync callback on every card change). Written in effects —
  // refs must not be mutated during render.
  const cardsRef = useRef(cards);
  const tombstonesRef = useRef(tombstones);
  const userIdRef = useRef<string | null>(user?.id ?? null);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);
  useEffect(() => {
    tombstonesRef.current = tombstones;
  }, [tombstones]);
  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user?.id]);

  const running = useRef(false);
  const dirty = useRef(false);
  // Lets runSync re-invoke itself (retry / dirty flush) without self-referencing.
  const runSyncRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const enabled = configured && Boolean(user);

  const runSync = useCallback(async (): Promise<void> => {
    if (!configured) return;
    const ownerId = userIdRef.current;
    if (!ownerId) return;
    const supabase = getSupabase();
    if (!supabase) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline");
      return;
    }
    // Serialize: if a sync is running, mark dirty so we re-run once it finishes.
    if (running.current) {
      dirty.current = true;
      return;
    }
    running.current = true;
    setStatus("syncing");

    try {
      const remote = await fetchAllRows(supabase, ownerId);
      const plan = reconcile(cardsRef.current, tombstonesRef.current, remote);

      // Push local-won cards (uploading captured images once).
      const uploaded = readUploadedIds();
      let uploadedChanged = false;
      const pushRows: CardRow[] = [];
      for (const card of plan.pushCards) {
        const { img, uploadedId } = await resolvePushImg(
          supabase,
          ownerId,
          card,
          uploaded,
        );
        if (uploadedId) {
          uploaded.add(uploadedId);
          uploadedChanged = true;
        }
        pushRows.push(cardToRow(card, ownerId, img));
      }
      if (uploadedChanged) writeUploadedIds(uploaded);
      await upsertRows(supabase, pushRows);

      // Propagate local deletions as remote soft-deletes.
      for (const del of plan.pushDeletes) {
        await markRowDeleted(supabase, del.id, del.deletedAt);
      }

      // Resolve pulled images (private Storage paths → signed URLs).
      const upsertCards: Card[] = await Promise.all(
        plan.localUpsertRows.map(async (row) => ({
          ...rowToCard(row),
          img: await resolvePullImg(supabase, row),
        })),
      );

      const hasUnowned = cardsRef.current.some((c) => c.ownerId === "");
      const hasLocalChange =
        upsertCards.length > 0 ||
        Object.keys(plan.localDeletes).length > 0 ||
        plan.clearTombstones.length > 0 ||
        hasUnowned;
      if (hasLocalChange) {
        applySync({
          upsert: upsertCards,
          deletes: plan.localDeletes,
          clearTombstones: plan.clearTombstones,
          claimOwnerId: hasUnowned ? ownerId : undefined,
        });
      }

      setLastSyncedAt(Date.now());
      setError(null);
      setStatus("idle");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      setError(message);
      setStatus("error");
      toast.error("Couldn’t back up your cards.", {
        action: { label: "Retry", onClick: () => void runSyncRef.current() },
      });
    } finally {
      running.current = false;
      if (dirty.current) {
        dirty.current = false;
        void runSyncRef.current();
      }
    }
    // Stable: reads mutable state via refs; only auth-config identity matters.
  }, [configured, applySync]);

  useEffect(() => {
    runSyncRef.current = runSync;
  }, [runSync]);

  const syncNow = useCallback(() => void runSync(), [runSync]);

  // Sync when the user (session) changes — sign-in pulls the cloud collection.
  // Deferred so the initial setStatus doesn't run synchronously inside the effect.
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
  }, [enabled, cards, tombstones, runSync]);

  // Sync on focus + reconnect; reflect offline immediately.
  useEffect(() => {
    if (!enabled) return;
    const onFocus = () => void runSync();
    const onOnline = () => void runSync();
    const onOffline = () => setStatus("offline");
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [enabled, runSync]);

  const value = useMemo<SyncContextValue>(
    () => ({ enabled, status, lastSyncedAt, error, syncNow }),
    [enabled, status, lastSyncedAt, error, syncNow],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used within a SyncProvider");
  return ctx;
}
