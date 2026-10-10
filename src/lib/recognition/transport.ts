import { z } from "zod";
import {
  extractedCardFieldsSchema,
  matchTierSchema,
  printingMatchSchema,
} from "@/types/scan.schema";
import type { CatalogProvider } from "@/lib/catalog/provider";
import { resolve } from "@/lib/recognition/resolve";
import type { ExtractedCardFields, MatchTier, PrintingMatch, ScanBatch } from "@/types/scan";

/** A recognition request failed or returned something outside the contract. */
export class RecognitionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RecognitionError";
  }
}

export interface RecognitionRequest {
  /** Prepared JPEG, held in memory for the request only. */
  image: Blob;
  mode: ScanBatch["mode"];
}

/** One resolved card as the server (or a fixture) returns it. */
export interface ResolvedCard {
  extracted: ExtractedCardFields;
  tier: MatchTier;
  matches: PrintingMatch[];
}

/** What a transport returns: resolved cards and server-side timings, no image data. */
export interface RecognitionResponse {
  cards: ResolvedCard[];
  timings: { uploadMs: number; modelMs: number; resolveMs: number };
}

/** The seam between the client and wherever recognition runs. */
export interface RecognitionTransport {
  recognize(request: RecognitionRequest): Promise<RecognitionResponse>;
}

const ms = z.number().nonnegative();

/** Longest free-text field a transport may return (set code hint, a match reason). */
export const MAX_TEXT_LENGTH = 200;

const isHttpsUrl = (value: string) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

/** Every transport response is untrusted until it passes this schema. */
export const recognitionResponseSchema = z.strictObject({
  cards: z.array(
    z
      .strictObject({
        extracted: extractedCardFieldsSchema.refine(
          (e) => e.setCodeHint === null || e.setCodeHint.length <= MAX_TEXT_LENGTH,
          { message: `setCodeHint longer than ${MAX_TEXT_LENGTH} characters` },
        ),
        tier: matchTierSchema,
        matches: z.array(
          printingMatchSchema
            .refine((m) => m.reasons.every((r) => r.length <= MAX_TEXT_LENGTH), {
              message: `match reason longer than ${MAX_TEXT_LENGTH} characters`,
            })
            .refine((m) => m.printing.imageUrl === null || isHttpsUrl(m.printing.imageUrl), {
              message: "printing imageUrl must be an https URL",
            }),
        ),
      })
      .refine((c) => (c.tier === "unmatched") === (c.matches.length === 0), {
        message: "unmatched ⇔ no matches",
      }),
  ),
  timings: z.strictObject({ uploadMs: ms, modelMs: ms, resolveMs: ms }),
});

export interface FixtureTransportOptions {
  /** Recorded model output (one entry per card in the photo). */
  extractions: readonly ExtractedCardFields[];
  /** Catalog the resolver runs against — the real adapter over recorded responses. */
  catalog: CatalogProvider;
  /** Recorded model latency to report; defaults to 0. */
  modelMs?: number;
}

/**
 * Tests/dev only. Replays recorded model extractions and resolves them locally
 * with the same resolver the Edge Function uses — steps 2–4 of the pipeline
 * without a model call. The image is ignored and never read.
 */
export function createFixtureTransport(options: FixtureTransportOptions): RecognitionTransport {
  return {
    async recognize() {
      const started = performance.now();
      const cards: ResolvedCard[] = [];
      for (const extracted of options.extractions) {
        const { tier, matches } = await resolve(extracted, options.catalog);
        cards.push({ extracted, tier, matches });
      }
      return {
        cards,
        timings: { uploadMs: 0, modelMs: options.modelMs ?? 0, resolveMs: performance.now() - started },
      };
    },
  };
}

/** Placeholder for the `recognize-cards` Edge Function (ticket 19.2). Makes no request. */
export function createEdgeTransport(): RecognitionTransport {
  return {
    async recognize() {
      throw new RecognitionError("Card recognition is not available yet.");
    },
  };
}
