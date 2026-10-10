import type { ReviewItem } from "@/lib/scan-review";

/**
 * Pure state machine behind `useBatchScan`: capture → scanning → review (or
 * error) → save. Holds no photo — the hook keeps that in a ref.
 *
 * Review work accumulates across photos: a new photo returns to the camera
 * with every reviewed card kept, and the next batch appends to them. Only a
 * save (or closing the sheet) clears the list.
 */

export type BatchScanPhase = "capture" | "scanning" | "review" | "error";

export interface BatchScanState {
  phase: BatchScanPhase;
  items: ReviewItem[];
  error: string | null;
}

export type BatchScanAction =
  | { type: "scanStarted" }
  | { type: "scanned"; items: ReviewItem[] }
  | { type: "scanFailed"; message: string }
  | { type: "newPhoto" }
  | { type: "reviewWithoutPhoto" }
  | { type: "edit"; update: (items: ReviewItem[]) => ReviewItem[] }
  | { type: "saved" };

export const INITIAL_BATCH_SCAN: BatchScanState = { phase: "capture", items: [], error: null };

export function batchScanReducer(state: BatchScanState, action: BatchScanAction): BatchScanState {
  switch (action.type) {
    case "scanStarted":
      return { ...state, phase: "scanning", error: null };
    case "scanned":
      return { phase: "review", items: [...state.items, ...action.items], error: null };
    case "scanFailed":
      return { ...state, phase: "error", error: action.message };
    case "newPhoto":
      return { ...state, phase: "capture", error: null };
    case "reviewWithoutPhoto":
      return { ...state, phase: "review", error: null };
    case "edit":
      return { ...state, items: action.update(state.items) };
    case "saved":
      return { ...state, items: [] };
  }
}

/** What the scan sheet body shows when no search panel is open. */
export type ScanBody = "needsInternet" | "capture" | "scanning" | "error" | "review";

export interface ScanView {
  body: ScanBody;
  /** Reviewed cards waiting off-screen: > 0 shows "Back to my N cards". */
  backToCards: number;
}

/** Reviewed cards the child has not removed. */
export function keptCount(items: readonly ReviewItem[]): number {
  return items.filter((i) => i.candidate.status !== "rejected").length;
}

/**
 * Pick the sheet body. Offline, nothing is captured: every phase but review
 * shows "needs internet". Whenever the review list is off-screen and still
 * holds kept cards, the body offers a way back to them — saving is local, so
 * this works offline too.
 */
export function scanView(state: Pick<BatchScanState, "phase" | "items">, online: boolean): ScanView {
  const body: ScanBody = !online && state.phase !== "review" ? "needsInternet" : state.phase;
  return { body, backToCards: body === "review" || body === "scanning" ? 0 : keptCount(state.items) };
}
