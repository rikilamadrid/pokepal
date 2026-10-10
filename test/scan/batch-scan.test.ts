import { describe, expect, it } from "vitest";
import { DEV_SCAN_EXTRACTIONS } from "@/data/dev-scan-fixture";
import { createFixtureTransport, recognize } from "@/lib/recognition";
import { INITIAL_BATCH_SCAN, batchScanReducer, type BatchScanState } from "@/lib/batch-scan";
import { choosePrinting, rejectCandidate, startReview, type ReviewItem } from "@/lib/scan-review";
import { createMemoryCatalog } from "../helpers/memory-catalog";

/** The Batch Scan state machine behind useBatchScan: review work survives a new photo. */

const photo = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" });
const prepare = async (image: Blob) => new Blob([await image.arrayBuffer()], { type: "image/jpeg" });
const none = () => 0;

async function scanItems(): Promise<ReviewItem[]> {
  const transport = createFixtureTransport({ extractions: DEV_SCAN_EXTRACTIONS, catalog: createMemoryCatalog() });
  return startReview(await recognize(photo(), { mode: "batch", transport, prepare }), none);
}

function reviewed(items: ReviewItem[]): BatchScanState {
  let state = batchScanReducer(INITIAL_BATCH_SCAN, { type: "scanStarted" });
  state = batchScanReducer(state, { type: "scanned", items });
  return state;
}

describe("batch scan state", () => {
  it("keeps every reviewed card when the child takes a new photo, and appends the next batch", async () => {
    const first = await scanItems();
    const ambiguous = first.find((i) => i.candidate.tier === "ambiguous")!;
    const unmatched = first.find((i) => i.candidate.tier === "unmatched")!;
    let state = reviewed(first);
    state = batchScanReducer(state, {
      type: "edit",
      update: (items) =>
        rejectCandidate(
          choosePrinting(items, ambiguous.candidate.id, ambiguous.candidate.matches[1].printing.id, none),
          unmatched.candidate.id,
        ),
    });
    const afterEdits = state.items;

    state = batchScanReducer(state, { type: "newPhoto" });
    expect(state.phase).toBe("capture");
    expect(state.items).toBe(afterEdits);

    state = batchScanReducer(state, { type: "scanStarted" });
    expect(state.items).toBe(afterEdits);

    const second = await scanItems();
    state = batchScanReducer(state, { type: "scanned", items: second });
    expect(state.phase).toBe("review");
    expect(state.items).toEqual([...afterEdits, ...second]);
    const chosen = state.items.find((i) => i.candidate.id === ambiguous.candidate.id)!;
    expect(chosen.candidate.chosenPrintingId).toBe(ambiguous.candidate.matches[1].printing.id);
    expect(state.items.find((i) => i.candidate.id === unmatched.candidate.id)!.candidate.status).toBe("rejected");
  });

  it("keeps reviewed cards through a failed scan and its new photo", async () => {
    const first = await scanItems();
    let state = batchScanReducer(reviewed(first), { type: "newPhoto" });
    state = batchScanReducer(state, { type: "scanStarted" });
    state = batchScanReducer(state, { type: "scanFailed", message: "nope" });
    expect(state).toMatchObject({ phase: "error", error: "nope", items: first });
    state = batchScanReducer(state, { type: "newPhoto" });
    expect(state).toMatchObject({ phase: "capture", error: null, items: first });
    state = batchScanReducer(state, { type: "reviewWithoutPhoto" });
    expect(state).toMatchObject({ phase: "review", items: first });
  });

  it("clears the list only after a save", async () => {
    const state = batchScanReducer(reviewed(await scanItems()), { type: "saved" });
    expect(state.items).toEqual([]);
  });
});
