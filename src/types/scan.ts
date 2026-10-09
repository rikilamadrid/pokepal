/**
 * PokéPal 2.0 transient scan contract — verbatim from
 * context/pokepal-2/02-target-architecture.md §Domain boundaries.
 * Change the contract there, not here.
 */

import type { CardFinish, CardPrinting, CatalogLanguage } from "@/types/catalog";

export interface ExtractedCardFields {   // what the vision model read; unverified
  name: string | null;
  collectorNumber: string | null;        // "20" from "020/189"
  setOfficialCount: number | null;       // 189 from "020/189"
  setCodeHint: string | null;            // printed set code / symbol description
  hp: number | null;
  language: CatalogLanguage | null;
  regulationMark: string | null;
  finishHint: CardFinish | null;
  /** Normalized [0..1] box in the source photo, for review overlays. */
  bbox: { x: number; y: number; w: number; h: number } | null;
  modelConfidence: number;               // 0..1, self-reported; never trusted alone
}

export type MatchTier = "exact" | "ambiguous" | "unmatched";

export interface PrintingMatch {
  printing: CardPrinting;
  score: number;                          // 0..1 from the resolver, not the model
  reasons: string[];                      // e.g. ["number+total", "name≈"]
}

export type CandidateStatus = "pending" | "confirmed" | "corrected" | "rejected";

export interface ScanCandidate {
  id: string;
  extracted: ExtractedCardFields;
  tier: MatchTier;
  matches: PrintingMatch[];               // ranked; [] when unmatched
  chosenPrintingId: string | null;        // set only by an explicit confirm/correct
  status: CandidateStatus;
  ownedCopies: number;                    // computed at review time
}

export interface ScanBatch {
  id: string;
  mode: "batch" | "trade-check";
  createdAt: string;
  candidates: ScanCandidate[];
  timings: { uploadMs: number; modelMs: number; resolveMs: number; totalMs: number };
}
