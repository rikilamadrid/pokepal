"use client";

import { Check, Search, Trash2 } from "lucide-react";
import { chosenPrinting } from "@/lib/scan-review";
import type { ScanCandidate } from "@/types/scan";
import { cn } from "@/lib/utils";
import { PrintingArt } from "./PrintingArt";

interface ReviewRowProps {
  candidate: ScanCandidate;
  /** Copies already owned of a printing ("you have N"). */
  copiesOf: (printingId: string) => number;
  onChoose: (printingId: string) => void;
  onSearch: () => void;
  onRemove: () => void;
}

/**
 * One detected card in the review list: artwork (or placeholder), name, set,
 * number, a sure / pick-one / couldn't-find badge, and "you have N". An
 * ambiguous card shows its ranked printings to tap; an unmatched one asks for
 * a search. Every row can be removed.
 */
export function ReviewRow({ candidate, copiesOf, onChoose, onSearch, onRemove }: ReviewRowProps) {
  const chosen = chosenPrinting(candidate);
  const needsChoice = chosen === null;
  const unmatched = candidate.matches.length === 0;
  const readName = candidate.extracted.name;

  return (
    <li
      className={cn(
        "rounded-2xl border bg-surface p-3",
        needsChoice ? "border-gold/70" : "border-border",
      )}
    >
      <div className="flex gap-3">
        <PrintingArt printing={chosen} className="w-16" />
        <div className="min-w-0 flex-1">
          <TierBadge candidate={candidate} />
          <p className="mt-1 truncate font-display text-lg leading-tight text-ink">
            {chosen?.name ?? (unmatched ? readName ?? "Mystery card" : "Which one is it?")}
          </p>
          {chosen ? (
            <p className="truncate font-mono text-xs text-ink-muted">
              {chosen.set.name} · {chosen.collectorNumber}/{chosen.set.officialCount}
            </p>
          ) : (
            <p className="text-sm text-ink-muted">
              {unmatched ? "We couldn't find this card." : "Tap the right card below."}
            </p>
          )}
          {chosen && <OwnedNote copies={copiesOf(chosen.id)} />}
        </div>
      </div>

      {candidate.tier === "ambiguous" && (
        <ul className="hide-scrollbar mt-3 flex gap-2 overflow-x-auto" aria-label="Pick the right card">
          {candidate.matches.map(({ printing }) => {
            const selected = printing.id === candidate.chosenPrintingId;
            return (
              <li key={printing.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => onChoose(printing.id)}
                  aria-pressed={selected}
                  aria-label={`${printing.name}, ${printing.set.name} ${printing.collectorNumber}/${printing.set.officialCount}`}
                  className={cn(
                    "press relative block w-20 rounded-lg p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-red",
                    selected ? "ring-2 ring-gold" : "ring-1 ring-border",
                  )}
                >
                  <PrintingArt printing={printing} className="w-full" />
                  {selected && (
                    <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-gold text-black">
                      <Check className="size-3.5" />
                    </span>
                  )}
                  <span className="mt-1 block truncate font-mono text-[0.6rem] text-ink-muted">
                    {printing.set.name}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onSearch}
          className={cn(
            "press flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-red",
            unmatched ? "bg-red text-white" : "bg-surface-raised text-ink",
          )}
        >
          <Search className="size-4" /> {unmatched ? "Search for it" : "Not this card?"}
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove this card"
          className="press grid min-h-11 w-12 place-items-center rounded-full bg-surface-raised text-ink-muted outline-none focus-visible:ring-2 focus-visible:ring-red"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );
}

function TierBadge({ candidate }: { candidate: ScanCandidate }) {
  const unmatched = candidate.matches.length === 0;
  const found = candidate.chosenPrintingId !== null;
  const [label, tone] = unmatched
    ? ["Couldn't find", "bg-red/15 text-red"]
    : found
      ? ["Got it!", "bg-emerald-500/15 text-emerald-500"]
      : ["Pick one", "bg-gold/20 text-gold"];
  return (
    <span className={cn("inline-block rounded-full px-2 py-0.5 font-mono text-[0.65rem] uppercase", tone)}>
      {label}
    </span>
  );
}

function OwnedNote({ copies }: { copies: number }) {
  if (copies === 0) {
    return <p className="mt-1 text-xs font-semibold text-gold">New for your collection!</p>;
  }
  return (
    <p className="mt-1 text-xs text-ink-muted">You have {copies} already</p>
  );
}
