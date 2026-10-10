"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { useOwnedCollection } from "@/hooks/useOwnedCollection";
import { RecognitionError, recognize } from "@/lib/recognition";
import { getScanTransport } from "@/lib/scan-transport";
import { INITIAL_BATCH_SCAN, batchScanReducer } from "@/lib/batch-scan";
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

export type { BatchScanPhase } from "@/lib/batch-scan";

/** Where a search result goes: a scanned card being corrected, or a new card. */
export type SearchTarget = { kind: "correct"; candidateId: string } | { kind: "add" };

/**
 * Batch Scan state: capture → scanning → review (or error) → save.
 *
 * The photo lives only in a ref while recognition runs (and for a retry after
 * an error). It is dropped as soon as a batch comes back, when the child takes
 * a new photo or leaves the camera, and when the sheet unmounts — it never
 * enters React state, storage, or the review items. Each run has its own
 * AbortController, aborted on all of those exits so an in-flight scan never
 * reaches the transport after the child has moved on.
 *
 * Reviewed cards survive a new photo: the next batch appends to them.
 */
export function useBatchScan() {
  const { addOwnedCards, ownershipFor } = useOwnedCollection();
  const [state, dispatch] = useReducer(batchScanReducer, INITIAL_BATCH_SCAN);
  const photoRef = useRef<Blob | null>(null);
  const runRef = useRef<AbortController | null>(null);

  const copiesOf = useCallback((id: string) => ownershipFor(id).copies, [ownershipFor]);

  /** Cancel any in-flight scan and drop the photo. */
  const dropPhoto = useCallback(() => {
    runRef.current?.abort();
    runRef.current = null;
    photoRef.current = null;
  }, []);

  useEffect(() => dropPhoto, [dropPhoto]);

  const run = useCallback(async () => {
    const photo = photoRef.current;
    if (!photo) return;
    runRef.current?.abort();
    const controller = new AbortController();
    runRef.current = controller;
    dispatch({ type: "scanStarted" });
    try {
      const transport = await getScanTransport();
      const batch = await recognize(photo, { mode: "batch", transport, signal: controller.signal });
      if (controller.signal.aborted) return;
      runRef.current = null;
      photoRef.current = null;
      dispatch({ type: "scanned", items: startReview(batch, copiesOf) });
    } catch (err) {
      if (controller.signal.aborted) return;
      runRef.current = null;
      dispatch({ type: "scanFailed", message: friendlyError(err) });
    }
  }, [copiesOf]);

  const scan = useCallback(
    (photo: Blob) => {
      photoRef.current = photo;
      void run();
    },
    [run],
  );

  /** Drop the photo and go back to the camera, keeping every reviewed card. */
  const newPhoto = useCallback(() => {
    dropPhoto();
    dispatch({ type: "newPhoto" });
  }, [dropPhoto]);

  /** Leave the camera (or a failed scan) for the review list, to add cards by search. */
  const reviewWithoutPhoto = useCallback(() => {
    dropPhoto();
    dispatch({ type: "reviewWithoutPhoto" });
  }, [dropPhoto]);

  const edit = useCallback(
    (update: (items: ReviewItem[]) => ReviewItem[]) => dispatch({ type: "edit", update }),
    [],
  );

  const choose = useCallback(
    (candidateId: string, printingId: string) =>
      edit((prev) => choosePrinting(prev, candidateId, printingId, copiesOf)),
    [copiesOf, edit],
  );

  const remove = useCallback(
    (candidateId: string) => edit((prev) => rejectCandidate(prev, candidateId)),
    [edit],
  );

  const applySearch = useCallback(
    (target: SearchTarget, printing: CardPrinting) =>
      edit((prev) =>
        target.kind === "correct"
          ? correctWithPrinting(prev, target.candidateId, printing, copiesOf)
          : addSearchedCard(prev, printing, copiesOf),
      ),
    [copiesOf, edit],
  );

  /** Save every confirmed card in one batch; returns how many were added. */
  const save = useCallback((): number => {
    const added = addOwnedCards(toNewOwnedCards(state.items));
    dispatch({ type: "saved" });
    return added.length;
  }, [addOwnedCards, state.items]);

  return {
    phase: state.phase,
    items: state.items,
    error: state.error,
    scan,
    retry: run,
    newPhoto,
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
