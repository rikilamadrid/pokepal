"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useOwnedCollection } from "@/hooks/useOwnedCollection";
import { RecognitionError, recognize } from "@/lib/recognition";
import { getScanTransport } from "@/lib/scan-transport";
import {
  addSearchedCard,
  choosePrinting,
  correctWithPrinting,
  rejectCandidate,
  startReview,
  toNewOwnedCards,
  type ReviewItem,
} from "@/lib/scan-review";
import type { CardPrinting } from "@/types/catalog";

export type BatchScanPhase = "capture" | "scanning" | "review" | "error";

/** Where a search result goes: a scanned card being corrected, or a new card. */
export type SearchTarget = { kind: "correct"; candidateId: string } | { kind: "add" };

/**
 * Batch Scan state: capture → scanning → review (or error) → save.
 *
 * The photo lives only in a ref while recognition runs (and for a retry after
 * an error). It is dropped as soon as a batch comes back, when the child starts
 * over, and when the sheet unmounts — it never enters React state, storage, or
 * the review items.
 */
export function useBatchScan() {
  const { addOwnedCards, ownershipFor } = useOwnedCollection();
  const [phase, setPhase] = useState<BatchScanPhase>("capture");
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const photoRef = useRef<Blob | null>(null);
  const runRef = useRef(0);

  const copiesOf = useCallback((id: string) => ownershipFor(id).copies, [ownershipFor]);

  useEffect(
    () => () => {
      photoRef.current = null;
      runRef.current++;
    },
    [],
  );

  const run = useCallback(async () => {
    const photo = photoRef.current;
    if (!photo) return;
    const runId = ++runRef.current;
    setPhase("scanning");
    setError(null);
    try {
      const transport = await getScanTransport();
      const batch = await recognize(photo, { mode: "batch", transport });
      if (runId !== runRef.current) return;
      photoRef.current = null;
      setItems((prev) => [...prev, ...startReview(batch, copiesOf)]);
      setPhase("review");
    } catch (err) {
      if (runId !== runRef.current) return;
      setError(friendlyError(err));
      setPhase("error");
    }
  }, [copiesOf]);

  const scan = useCallback(
    (photo: Blob) => {
      photoRef.current = photo;
      void run();
    },
    [run],
  );

  /** Drop the photo and any results, back to the camera. */
  const restart = useCallback(() => {
    photoRef.current = null;
    runRef.current++;
    setItems([]);
    setError(null);
    setPhase("capture");
  }, []);

  /** Leave the camera (or a failed scan) for the review list, to add cards by search. */
  const reviewWithoutPhoto = useCallback(() => {
    photoRef.current = null;
    runRef.current++;
    setError(null);
    setPhase("review");
  }, []);

  const choose = useCallback(
    (candidateId: string, printingId: string) =>
      setItems((prev) => choosePrinting(prev, candidateId, printingId, copiesOf)),
    [copiesOf],
  );

  const remove = useCallback(
    (candidateId: string) => setItems((prev) => rejectCandidate(prev, candidateId)),
    [],
  );

  const applySearch = useCallback(
    (target: SearchTarget, printing: CardPrinting) =>
      setItems((prev) =>
        target.kind === "correct"
          ? correctWithPrinting(prev, target.candidateId, printing, copiesOf)
          : addSearchedCard(prev, printing, copiesOf),
      ),
    [copiesOf],
  );

  /** Save every confirmed card in one batch; returns how many were added. */
  const save = useCallback((): number => {
    const added = addOwnedCards(toNewOwnedCards(items));
    setItems([]);
    return added.length;
  }, [addOwnedCards, items]);

  return {
    phase,
    items,
    error,
    scan,
    retry: run,
    restart,
    reviewWithoutPhoto,
    choose,
    remove,
    applySearch,
    save,
  };
}

function friendlyError(err: unknown): string {
  if (err instanceof RecognitionError && /not available/i.test(err.message)) {
    return "Card scanning isn't ready yet. You can find your cards by name instead.";
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "Scanning needs the internet. Connect and try again.";
  }
  return "We couldn't read that photo. Try again, or take a new one.";
}
