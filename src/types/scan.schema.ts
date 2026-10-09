import { z } from "zod";
import {
  cardFinishSchema,
  cardPrintingSchema,
  catalogLanguageSchema,
} from "@/types/catalog.schema";
import type {
  CandidateStatus,
  ExtractedCardFields,
  MatchTier,
  PrintingMatch,
  ScanBatch,
  ScanCandidate,
} from "@/types/scan";

/** Zod schemas for the transient scan contract in `scan.ts`. */

const unit = z.number().min(0).max(1);

export const MATCH_TIERS = [
  "exact",
  "ambiguous",
  "unmatched",
] as const satisfies readonly MatchTier[];

export const CANDIDATE_STATUSES = [
  "pending",
  "confirmed",
  "corrected",
  "rejected",
] as const satisfies readonly CandidateStatus[];

export const matchTierSchema: z.ZodType<MatchTier> = z.enum(MATCH_TIERS);
export const candidateStatusSchema: z.ZodType<CandidateStatus> =
  z.enum(CANDIDATE_STATUSES);

export const extractedCardFieldsSchema: z.ZodType<ExtractedCardFields> =
  z.strictObject({
    name: z.string().nullable(),
    collectorNumber: z.string().nullable(),
    setOfficialCount: z.number().int().positive().nullable(),
    setCodeHint: z.string().nullable(),
    hp: z.number().int().positive().nullable(),
    language: catalogLanguageSchema.nullable(),
    regulationMark: z.string().nullable(),
    finishHint: cardFinishSchema.nullable(),
    bbox: z
      .strictObject({ x: unit, y: unit, w: unit, h: unit })
      .nullable(),
    modelConfidence: unit,
  });

export const printingMatchSchema: z.ZodType<PrintingMatch> = z.strictObject({
  printing: cardPrintingSchema,
  score: unit,
  reasons: z.array(z.string()),
});

export const scanCandidateSchema: z.ZodType<ScanCandidate> = z.strictObject({
  id: z.string().min(1),
  extracted: extractedCardFieldsSchema,
  tier: matchTierSchema,
  matches: z.array(printingMatchSchema),
  chosenPrintingId: z.string().nullable(),
  status: candidateStatusSchema,
  ownedCopies: z.number().int().nonnegative(),
});

const ms = z.number().nonnegative();

export const scanBatchSchema: z.ZodType<ScanBatch> = z.strictObject({
  id: z.string().min(1),
  mode: z.enum(["batch", "trade-check"]),
  createdAt: z.iso.datetime({ offset: true }),
  candidates: z.array(scanCandidateSchema),
  timings: z.strictObject({
    uploadMs: ms,
    modelMs: ms,
    resolveMs: ms,
    totalMs: ms,
  }),
});
