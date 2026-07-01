"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Star, X } from "lucide-react";
import { useCollection } from "@/hooks/useCollection";
import { findDuplicates } from "@/lib/collection-utils";
import { formatCaughtDate } from "@/lib/date";
import { PokeCard } from "@/components/card/PokeCard";
import { cn } from "@/lib/utils";

interface CardDetailSheetProps {
  /** Id of the card to show; `null` keeps the sheet closed. */
  cardId: string | null;
  onClose: () => void;
}

const DRAG_DISMISS_PX = 110;

/**
 * Bottom-sheet card detail modal — the shared "open a card" surface. Shows the
 * full PokeCard, a 2×2 stat grid, and the favorite / release actions. Reads the
 * card live from the store so favorite toggles reflect instantly. Dismiss via
 * drag-down, backdrop, the ✕ button, or Escape.
 */
export function CardDetailSheet({ cardId, onClose }: CardDetailSheetProps) {
  const { cards, toggleFavorite, releaseCard } = useCollection();
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [closing, setClosing] = useState(false);
  const dragStart = useRef<number | null>(null);
  // Deferred until the slide-down finishes so the card stays visible mid-exit.
  const pendingRelease = useRef<string | null>(null);

  const card = useMemo(
    () => cards.find((c) => c.id === cardId) ?? null,
    [cards, cardId],
  );
  const dupCount = useMemo(
    () => (card ? findDuplicates(cards).get(card.dexNo) : undefined),
    [cards, card],
  );

  // Play the slide-down, then tell the parent to unmount. Under reduced motion
  // there's no exit animation (animationend never fires), so close immediately.
  const requestClose = useCallback(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      if (pendingRelease.current) releaseCard(pendingRelease.current);
      onClose();
      return;
    }
    setClosing(true);
  }, [onClose, releaseCard]);

  const onExitAnimationEnd = () => {
    if (!closing) return; // ignore the entry animation's end
    if (pendingRelease.current) releaseCard(pendingRelease.current);
    onClose();
  };

  useEffect(() => {
    if (!cardId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cardId, requestClose]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragStart.current = e.clientY;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragStart.current === null) return;
    setDragY(Math.max(0, e.clientY - dragStart.current));
  };
  const onPointerUp = useCallback(() => {
    if (dragStart.current === null) return;
    dragStart.current = null;
    setDragging(false);
    setDragY((y) => {
      if (y > DRAG_DISMISS_PX) requestClose();
      return 0;
    });
  }, [requestClose]);

  if (!card) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close card details"
        onClick={requestClose}
        className={cn(
          "absolute inset-0 bg-black/60",
          closing ? "sheet-backdrop-out" : "sheet-backdrop-in",
        )}
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${card.name} details`}
        onAnimationEnd={onExitAnimationEnd}
        className={cn(
          "glass relative z-10 max-h-[92%] w-full max-w-[480px] overflow-y-auto rounded-t-3xl border-t border-border px-5 pt-2",
          closing ? "sheet-panel-out" : "sheet-panel-in",
        )}
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 2.5rem)",
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragging ? "none" : "transform 0.24s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        {/* Drag handle — the grab region (pointer capture here would swallow
            button clicks, so it's scoped to just this strip). */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="-mx-5 flex cursor-grab touch-none justify-center py-2 active:cursor-grabbing"
        >
          <div className="h-1.5 w-10 rounded-full bg-ink-muted/40" />
        </div>

        {/* Header */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="truncate font-display text-2xl text-ink">
            {card.name}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={requestClose}
            className="press grid size-8 shrink-0 place-items-center rounded-full bg-surface-raised text-ink-muted outline-none focus-visible:ring-2 focus-visible:ring-red"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Full card */}
        <div className="mx-auto w-[62%] min-w-[180px]">
          <PokeCard card={card} duplicateCount={dupCount} />
        </div>

        {/* 2×2 stat grid */}
        <dl className="mt-5 grid grid-cols-2 gap-2.5">
          <Stat label="Dex No." value={`#${card.dexNo}`} />
          <Stat label="Type" value={card.type} />
          <Stat label="Rarity" value={card.rarity} />
          <Stat label="Caught" value={formatCaughtDate(card.caughtAt)} />
        </dl>

        {/* Actions */}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={() => toggleFavorite(card.id)}
            aria-pressed={card.favorite}
            className={cn(
              "press flex flex-1 items-center justify-center gap-2 rounded-full py-3 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-gold",
              card.favorite
                ? "bg-gold text-black"
                : "bg-surface-raised text-ink",
            )}
          >
            <Star className={cn("size-4", card.favorite && "fill-black")} />
            {card.favorite ? "Favorited" : "Favorite"}
          </button>
          <button
            type="button"
            onClick={() => {
              pendingRelease.current = card.id;
              requestClose();
            }}
            className="press flex-1 rounded-full bg-red/15 py-3 font-semibold text-red outline-none focus-visible:ring-2 focus-visible:ring-red"
          >
            Release
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-raised px-3.5 py-2.5">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm font-bold uppercase text-ink">
        {value}
      </dd>
    </div>
  );
}
