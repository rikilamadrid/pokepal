import { containsInlineData } from "@/lib/recognition/image-guard";
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
  CARD_FAILURES,
  RecognitionError,
  createFixtureTransport,
  recognitionResponseSchema,
} from "@/lib/recognition/transport";
export { createEdgeTransport, recognizeCardsEndpoint } from "@/lib/recognition/edge-transport";
export type { EdgeTransportOptions } from "@/lib/recognition/edge-transport";
export type {
  CardFailure,
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
