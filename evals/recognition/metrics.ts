import type { ResolvedCard } from "@/lib/recognition/transport";

/**
 * Scoring for one evaluation run. Per photo, each returned card is classed:
 *   correct     — tier exact and its top printing is one of the expected ids
 *   wrong-match — tier exact but its top printing is not expected (confident and wrong)
 *   ambiguous   — a shortlist; `ambiguousWithTruth` when an expected id is in it
 *   unmatched   — no printing (including per-card failures)
 * An expected id is consumed by at most one correct card.
 */

export interface PhotoOutcome {
  photo: string;
  mode: "batch" | "trade-check";
  expected: string[];
  cards: ResolvedCard[];
  /** Model plus resolver time for this photo, ms. */
  latencyMs: number;
  costEur: number;
  /** Set when the whole request failed (no cards scored). */
  error?: string;
}

export interface PhotoScore {
  photo: string;
  expected: number;
  cards: number;
  correct: number;
  wrongMatch: number;
  ambiguous: number;
  ambiguousWithTruth: number;
  unmatched: number;
  failed: number;
  missed: string[];
}

export interface RunMetrics {
  photos: number;
  photosFailed: number;
  expectedCards: number;
  returnedCards: number;
  /** correct / expected cards. */
  exactAccuracy: number;
  /** ambiguous / returned cards. */
  ambiguityRate: number;
  /** ambiguous with the truth in the shortlist / returned cards. */
  ambiguousWithTruthRate: number;
  /** confident but incorrect / returned cards — reported apart from ambiguity. */
  wrongMatchRate: number;
  /** unmatched / returned cards. */
  unmatchedRate: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  totalCostEur: number;
  costPerPhotoEur: number;
}

export function scorePhoto(outcome: PhotoOutcome): PhotoScore {
  const remaining = [...outcome.expected];
  const score: PhotoScore = {
    photo: outcome.photo,
    expected: outcome.expected.length,
    cards: outcome.cards.length,
    correct: 0,
    wrongMatch: 0,
    ambiguous: 0,
    ambiguousWithTruth: 0,
    unmatched: 0,
    failed: 0,
    missed: [],
  };
  for (const card of outcome.cards) {
    if (card.failure) score.failed += 1;
    if (card.tier === "unmatched") {
      score.unmatched += 1;
    } else if (card.tier === "ambiguous") {
      score.ambiguous += 1;
      if (card.matches.some((m) => outcome.expected.includes(m.printing.id))) score.ambiguousWithTruth += 1;
    } else {
      const index = remaining.indexOf(card.matches[0].printing.id);
      if (index >= 0) {
        score.correct += 1;
        remaining.splice(index, 1);
      } else {
        score.wrongMatch += 1;
      }
    }
  }
  score.missed = remaining;
  return score;
}

/** Nearest-rank percentile; 0 for no samples. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

const ratio = (n: number, d: number) => (d === 0 ? 0 : n / d);

export function computeMetrics(outcomes: readonly PhotoOutcome[]): { metrics: RunMetrics; scores: PhotoScore[] } {
  const scores = outcomes.map(scorePhoto);
  const sum = (pick: (s: PhotoScore) => number) => scores.reduce((t, s) => t + pick(s), 0);
  const returned = sum((s) => s.cards);
  const expected = sum((s) => s.expected);
  const latencies = outcomes.filter((o) => !o.error).map((o) => o.latencyMs);
  const totalCostEur = outcomes.reduce((t, o) => t + o.costEur, 0);
  return {
    scores,
    metrics: {
      photos: outcomes.length,
      photosFailed: outcomes.filter((o) => o.error).length,
      expectedCards: expected,
      returnedCards: returned,
      exactAccuracy: ratio(sum((s) => s.correct), expected),
      ambiguityRate: ratio(sum((s) => s.ambiguous), returned),
      ambiguousWithTruthRate: ratio(sum((s) => s.ambiguousWithTruth), returned),
      wrongMatchRate: ratio(sum((s) => s.wrongMatch), returned),
      unmatchedRate: ratio(sum((s) => s.unmatched), returned),
      latencyP50Ms: percentile(latencies, 50),
      latencyP95Ms: percentile(latencies, 95),
      totalCostEur,
      costPerPhotoEur: ratio(totalCostEur, outcomes.length),
    },
  };
}
