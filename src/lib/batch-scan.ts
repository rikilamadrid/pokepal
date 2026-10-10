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
