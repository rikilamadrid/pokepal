"use client";

import { Camera, Plus } from "lucide-react";
import { reviewSummary, type ReviewItem } from "@/lib/scan-review";
import { ReviewRow } from "./ReviewRow";

interface BatchReviewProps {
  items: ReviewItem[];
  copiesOf: (printingId: string) => number;
  onChoose: (candidateId: string, printingId: string) => void;
  onSearch: (candidateId: string) => void;
  onRemove: (candidateId: string) => void;
  onAddBySearch: () => void;
  onRestart: () => void;
  onSave: () => void;
}

/**
 * The review list: every kept card with its state, then one "Add N cards"
 * button that stays disabled while any card still needs a choice.
 */
export function BatchReview({
  items,
  copiesOf,
  onChoose,
  onSearch,
  onRemove,
  onAddBySearch,
  onRestart,
  onSave,
}: BatchReviewProps) {
  const kept = items.filter((i) => i.candidate.status !== "rejected");
  const { toAdd, needsChoice } = reviewSummary(items);
  const ready = needsChoice === 0 && toAdd > 0;

  return (
    <div className="flex flex-col gap-3">
      {kept.length === 0 ? (
        <p className="rounded-2xl bg-surface p-5 text-center text-sm text-ink-muted">
          No cards yet. Find one by name, or take a photo.
        </p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Cards found">
          {kept.map(({ candidate }) => (
            <ReviewRow
              key={candidate.id}
              candidate={candidate}
              copiesOf={copiesOf}
              onChoose={(printingId) => onChoose(candidate.id, printingId)}
              onSearch={() => onSearch(candidate.id)}
              onRemove={() => onRemove(candidate.id)}
            />
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onAddBySearch}
          className="press flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-surface-raised text-sm font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-red"
        >
          <Plus className="size-4" /> Find a card
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="press flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-surface-raised text-sm font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-red"
        >
          <Camera className="size-4" /> New photo
        </button>
      </div>

      {needsChoice > 0 && (
        <p className="text-center text-sm text-gold" role="status">
          {needsChoice === 1 ? "1 card needs" : `${needsChoice} cards need`} your help first.
        </p>
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={!ready}
        className="press min-h-12 rounded-full bg-red py-3 font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-red disabled:opacity-40"
      >
        {toAdd === 1 ? "Add 1 card" : `Add ${toAdd} cards`}
      </button>
    </div>
  );
}

/** Placeholder rows while recognition runs (the card count is not known yet). */
export function ScanningSkeleton() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <p className="text-center text-sm text-ink-muted">Looking at your cards…</p>
      <ul className="flex flex-col gap-3" aria-hidden>
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex gap-3 rounded-2xl border border-border bg-surface p-3">
            <div className="aspect-[63/88] w-16 animate-pulse rounded-md bg-surface-raised motion-reduce:animate-none" />
            <div className="flex flex-1 flex-col gap-2 py-1">
              <div className="h-3 w-16 animate-pulse rounded-full bg-surface-raised motion-reduce:animate-none" />
              <div className="h-5 w-3/4 animate-pulse rounded-full bg-surface-raised motion-reduce:animate-none" />
              <div className="h-3 w-1/2 animate-pulse rounded-full bg-surface-raised motion-reduce:animate-none" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
