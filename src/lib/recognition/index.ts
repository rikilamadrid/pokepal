import { prepareImage } from "@/lib/recognition/image-prep";
import {
  RecognitionError,
  recognitionResponseSchema,
  type RecognitionTransport,
} from "@/lib/recognition/transport";
import type { ScanBatch, ScanCandidate } from "@/types/scan";

/**
 * Card recognition client — the single entry point for Batch Scan and Trade
 * Check. Photo in, `ScanBatch` out; the photo stays in memory and no image
 * bytes, crops or data URIs reach the returned batch.
 */

export { resolve, rankPrintings } from "@/lib/recognition/resolve";
export type { ResolveResult } from "@/lib/recognition/resolve";
export { prepareImage, targetSize, LONG_EDGE } from "@/lib/recognition/image-prep";
export {
  RecognitionError,
  createEdgeTransport,
  createFixtureTransport,
  recognitionResponseSchema,
} from "@/lib/recognition/transport";
export type {
  FixtureTransportOptions,
  RecognitionRequest,
  RecognitionResponse,
  RecognitionTransport,
  ResolvedCard,
} from "@/lib/recognition/transport";

export interface RecognizeOptions {
  mode: ScanBatch["mode"];
  transport: RecognitionTransport;
  /** Image prep; defaults to the in-browser resize + JPEG encode. */
  prepare?: (image: Blob, mode: ScanBatch["mode"]) => Promise<Blob>;
  now?: () => Date;
  newId?: () => string;
}

/** True if any string inside `value` is an inline data URI. */
function containsInlineData(value: unknown): boolean {
  if (typeof value === "string") return /^\s*data:/i.test(value);
  if (Array.isArray(value)) return value.some(containsInlineData);
  if (value !== null && typeof value === "object") {
    return Object.values(value).some(containsInlineData);
  }
  return false;
}

export async function recognize(image: Blob, options: RecognizeOptions): Promise<ScanBatch> {
  const started = performance.now();
  const { mode, transport } = options;
  const newId = options.newId ?? (() => crypto.randomUUID());
  const prepare = options.prepare ?? prepareImage;

  const prepared = await prepare(image, mode);
  const parsed = recognitionResponseSchema.safeParse(await transport.recognize({ image: prepared, mode }));
  if (!parsed.success) {
    throw new RecognitionError(`Recognition returned an unexpected response: ${parsed.error.message}`);
  }
  if (containsInlineData(parsed.data)) {
    throw new RecognitionError("Recognition response carried inline image data");
  }

  const candidates: ScanCandidate[] = parsed.data.cards.map(({ extracted, tier, matches }) => ({
    id: newId(),
    extracted,
    tier,
    matches,
    chosenPrintingId: null,
    status: "pending",
    ownedCopies: 0,
  }));

  return {
    id: newId(),
    mode,
    createdAt: (options.now?.() ?? new Date()).toISOString(),
    candidates,
    timings: { ...parsed.data.timings, totalMs: performance.now() - started },
  };
}
