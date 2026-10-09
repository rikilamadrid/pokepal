import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LONG_EDGE,
  RecognitionError,
  createEdgeTransport,
  createFixtureTransport,
  recognize,
  targetSize,
  type RecognitionTransport,
} from "@/lib/recognition";
import { scanBatchSchema } from "@/types/scan.schema";
import type { ExtractedCardFields, ScanBatch } from "@/types/scan";
import { createMemoryCatalog, recordedPrinting } from "../helpers/memory-catalog";

const recorded = JSON.parse(
  readFileSync(new URL("../fixtures/recognition/batch-photo.json", import.meta.url), "utf8"),
) as { extractions: ExtractedCardFields[] };

const SENTINEL = "PHOTO-BYTES-SENTINEL-7f3a";
const photo = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), SENTINEL], { type: "image/jpeg" });

/** Stand-in for the browser resize: returns a new in-memory JPEG Blob. */
const fakePrepare = vi.fn(async (image: Blob) => new Blob([await image.arrayBuffer()], { type: "image/jpeg" }));

let ids = 0;
const newId = () => `id-${++ids}`;
const now = () => new Date("2026-10-09T12:00:00.000Z");

function fixture() {
  return createFixtureTransport({ extractions: recorded.extractions, catalog: createMemoryCatalog(), modelMs: 1200 });
}

afterEach(() => {
  vi.restoreAllMocks();
  fakePrepare.mockClear();
});

describe("recognize with the fixture transport", () => {
  it("returns a contract-valid ScanBatch with exact, ambiguous, and unmatched candidates", async () => {
    const batch = await recognize(photo(), { mode: "batch", transport: fixture(), prepare: fakePrepare, newId, now });

    expect(scanBatchSchema.safeParse(batch).success).toBe(true);
    expect(batch.mode).toBe("batch");
    expect(batch.createdAt).toBe("2026-10-09T12:00:00.000Z");
    expect(batch.candidates.map((c) => c.tier)).toEqual(["exact", "ambiguous", "unmatched"]);
    expect(batch.candidates[0].matches[0].printing.id).toBe("tcgdex:en:swsh3-20");
    expect(batch.candidates[2].matches).toEqual([]);
    expect(batch.timings.modelMs).toBe(1200);
    expect(batch.timings.totalMs).toBeGreaterThanOrEqual(0);
    for (const c of batch.candidates) {
      // No silent acceptance: nothing is chosen until an explicit confirm/correct.
      expect(c.chosenPrintingId).toBeNull();
      expect(c.status).toBe("pending");
      expect(c.ownedCopies).toBe(0);
    }
    expect(new Set([batch.id, ...batch.candidates.map((c) => c.id)]).size).toBe(4);
  });

  it("passes the mode and the prepared image to the transport", async () => {
    const seen: { mode: ScanBatch["mode"]; image: Blob }[] = [];
    const transport: RecognitionTransport = {
      async recognize(req) {
        seen.push(req);
        return fixture().recognize(req);
      },
    };
    const batch = await recognize(photo(), { mode: "trade-check", transport, prepare: fakePrepare });
    expect(batch.mode).toBe("trade-check");
    expect(fakePrepare).toHaveBeenCalledWith(expect.any(Blob), "trade-check");
    expect(seen).toHaveLength(1);
    expect(seen[0].mode).toBe("trade-check");
    expect(seen[0].image).toBe(await fakePrepare.mock.results[0].value);
  });

  it("puts no image bytes in the returned ScanBatch", async () => {
    const batch = await recognize(photo(), { mode: "batch", transport: fixture(), prepare: fakePrepare });
    const json = JSON.stringify(batch);
    expect(json).not.toContain(SENTINEL);
    expect(json).not.toContain(Buffer.from(SENTINEL).toString("base64"));
    expect(json).not.toMatch(/data:/i);
    expect(json).not.toMatch(/\/9j\//); // base64 JPEG magic
    const hasBlob = (v: unknown): boolean =>
      v instanceof Blob ||
      ArrayBuffer.isView(v) ||
      v instanceof ArrayBuffer ||
      (v !== null && typeof v === "object" && Object.values(v).some(hasBlob));
    expect(hasBlob(batch)).toBe(false);
  });
});

describe("recognize rejects untrusted transport responses", () => {
  const exact = recordedPrinting("en", "swsh3-20");
  const card = (imageUrl: string | null) => ({
    extracted: recorded.extractions[0],
    tier: "exact" as const,
    matches: [{ printing: { ...exact, imageUrl }, score: 1, reasons: ["number"] }],
  });
  const respond = (body: unknown): RecognitionTransport => ({ recognize: async () => body as never });

  it("refuses a response carrying an inline image", async () => {
    const transport = respond({ cards: [card("data:image/jpeg;base64,/9j/4AAQ")], timings: { uploadMs: 1, modelMs: 1, resolveMs: 1 } });
    await expect(recognize(photo(), { mode: "batch", transport, prepare: fakePrepare })).rejects.toBeInstanceOf(RecognitionError);
  });

  it("refuses a response with extra fields (e.g. an echoed photo)", async () => {
    const transport = respond({ cards: [], timings: { uploadMs: 1, modelMs: 1, resolveMs: 1 }, photo: "abc" });
    await expect(recognize(photo(), { mode: "batch", transport, prepare: fakePrepare })).rejects.toBeInstanceOf(RecognitionError);
  });

  it("refuses an unmatched card that still lists matches", async () => {
    const transport = respond({
      cards: [{ ...card(null), tier: "unmatched" }],
      timings: { uploadMs: 1, modelMs: 1, resolveMs: 1 },
    });
    await expect(recognize(photo(), { mode: "batch", transport, prepare: fakePrepare })).rejects.toBeInstanceOf(RecognitionError);
  });
});

describe("edge transport stub", () => {
  it("fails with RecognitionError and makes no network request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(
      recognize(photo(), { mode: "batch", transport: createEdgeTransport(), prepare: fakePrepare }),
    ).rejects.toBeInstanceOf(RecognitionError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("image prep sizing", () => {
  it("caps the long edge per mode", () => {
    expect(LONG_EDGE).toEqual({ batch: 1600, "trade-check": 1024 });
    expect(targetSize(4000, 3000, "batch")).toEqual({ width: 1600, height: 1200 });
    expect(targetSize(3000, 4000, "trade-check")).toEqual({ width: 768, height: 1024 });
  });

  it("never upscales and rejects an empty image", () => {
    expect(targetSize(800, 600, "batch")).toEqual({ width: 800, height: 600 });
    expect(() => targetSize(0, 600, "batch")).toThrow(RangeError);
  });
});
