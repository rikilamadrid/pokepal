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

/** Base64 openings of JPEG, PNG, GIF and WebP files. */
const IMAGE_BASE64_MAGIC = /\/9j\/|iVBORw0KGgo|R0lGOD|UklGR/;
/** An unbroken base64 run this long is encoded bytes, not card text. */
const BASE64_RUN = /[A-Za-z0-9+/=_-]{120,}/;

/** True if a string looks like image bytes: a data URI, image base64, or a long base64 run. */
function looksLikeImageData(value: string): boolean {
  return /^\s*data:/i.test(value) || IMAGE_BASE64_MAGIC.test(value) || BASE64_RUN.test(value);
}

/** True if any string inside `value` looks like inline image data. */
function containsInlineData(value: unknown): boolean {
  if (typeof value === "string") return looksLikeImageData(value);
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
  let response: unknown;
  try {
    response = await transport.recognize({ image: prepared, mode });
  } catch (error) {
    if (error instanceof RecognitionError) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    throw new RecognitionError(`Recognition request failed: ${reason}`, { cause: error });
  }
  const parsed = recognitionResponseSchema.safeParse(response);
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
