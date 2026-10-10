"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, WifiOff, X } from "lucide-react";
import { toast } from "sonner";
import { useBatchScan, type SearchTarget } from "@/hooks/useBatchScan";
import { useOnline } from "@/hooks/useOnline";
import { useOwnedCollection } from "@/hooks/useOwnedCollection";
import type { CardPrinting, CatalogLanguage } from "@/types/catalog";
import { Viewfinder } from "./Viewfinder";
import { BatchReview, ScanningSkeleton } from "./BatchReview";
import { CardSearch } from "./CardSearch";
import { cn } from "@/lib/utils";

interface ScanSheetProps {
  onClose: () => void;
}

const DRAG_DISMISS_PX = 110;

const PHASE_TITLES = {
  capture: "Scan your cards",
  scanning: "Scanning…",
  review: "Check your cards",
  error: "Uh-oh!",
} as const;

/**
 * Batch Scan bottom sheet: photograph several cards → review what PokéPal
 * found → add them in one tap. Lazy-loaded by the shell so the camera stack
 * stays out of the initial bundle. The photo is held only by `useBatchScan`
 * and released when the sheet closes. Dismiss via drag-down, backdrop, ✕, or
 * Escape.
 */
export function ScanSheet({ onClose }: ScanSheetProps) {
  const online = useOnline();
  const { ownershipFor } = useOwnedCollection();
  const scan = useBatchScan();
  const [search, setSearch] = useState<SearchTarget | null>(null);

  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [closing, setClosing] = useState(false);
  const dragStart = useRef<number | null>(null);

  const requestClose = useCallback(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      onClose();
      return;
    }
    setClosing(true);
  }, [onClose]);

  const onExitAnimationEnd = () => {
    if (closing) onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestClose]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragStart.current = e.clientY;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragStart.current === null) return;
    setDragY(Math.max(0, e.clientY - dragStart.current));
  };
  const onPointerUp = () => {
    if (dragStart.current === null) return;
    dragStart.current = null;
    setDragging(false);
    setDragY((y) => {
      if (y > DRAG_DISMISS_PX) requestClose();
      return 0;
    });
  };

  const copiesOf = (printingId: string) => ownershipFor(printingId).copies;

  const searchLanguage = (): CatalogLanguage => {
    if (search?.kind !== "correct") return "en";
    const item = scan.items.find((i) => i.candidate.id === search.candidateId);
    return item?.candidate.extracted.language ?? "en";
  };

  const handlePick = (printing: CardPrinting) => {
    if (search) scan.applySearch(search, printing);
    setSearch(null);
  };

  const findByName = () => {
    scan.reviewWithoutPhoto();
    setSearch({ kind: "add" });
  };

  const handleSave = () => {
    try {
      const added = scan.save();
      toast.success(added === 1 ? "1 card added to your collection!" : `${added} cards added to your collection!`);
      requestClose();
    } catch {
      toast.error("Some cards still need your help before saving.");
    }
  };

  const title = search ? "Find a card" : PHASE_TITLES[scan.phase];

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close scan"
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
        aria-label="Scan your cards"
        onAnimationEnd={onExitAnimationEnd}
        className={cn(
          "glass relative z-10 max-h-[92%] w-full max-w-[480px] overflow-y-auto rounded-t-3xl border-t border-border px-5 pt-2",
          closing ? "sheet-panel-out" : "sheet-panel-in",
        )}
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)",
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragging
            ? "none"
            : "transform 0.24s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        {/* Drag handle */}
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
          {!search ? (
            <span className="size-8" aria-hidden />
          ) : (
            <button
              type="button"
              aria-label="Back"
              onClick={() => setSearch(null)}
              className="press grid size-8 shrink-0 place-items-center rounded-full bg-surface-raised text-ink-muted outline-none focus-visible:ring-2 focus-visible:ring-red"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
          <h2 className="font-display text-2xl text-ink">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={requestClose}
            className="press grid size-8 shrink-0 place-items-center rounded-full bg-surface-raised text-ink-muted outline-none focus-visible:ring-2 focus-visible:ring-red"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        {search ? (
          <CardSearch
            initialLanguage={searchLanguage()}
            onPick={handlePick}
            onCancel={() => setSearch(null)}
          />
        ) : !online && scan.phase !== "review" ? (
          <NeedsInternet />
        ) : scan.phase === "capture" ? (
          <Viewfinder onCapture={scan.scan} onSkip={findByName} />
        ) : scan.phase === "scanning" ? (
          <ScanningSkeleton />
        ) : scan.phase === "error" ? (
          <ScanError
            message={scan.error}
            onRetry={() => void scan.retry()}
            onNewPhoto={scan.newPhoto}
            onFindByName={findByName}
          />
        ) : (
          <BatchReview
            items={scan.items}
            copiesOf={copiesOf}
            onChoose={scan.choose}
            onSearch={(candidateId) => setSearch({ kind: "correct", candidateId })}
            onRemove={scan.remove}
            onAddBySearch={() => setSearch({ kind: "add" })}
            onNewPhoto={scan.newPhoto}
            onSave={handleSave}
          />
        )}
      </div>
    </div>
  );
}

/** Offline: scanning needs the Edge Function, so no capture is attempted. */
function NeedsInternet() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface p-8 text-center" role="status">
      <WifiOff className="size-10 text-ink-muted" />
      <p className="font-display text-xl text-ink">Scanning needs the internet</p>
      <p className="text-sm text-ink-muted">
        Connect to Wi-Fi, then come back to scan your cards.
      </p>
    </div>
  );
}

interface ScanErrorProps {
  message: string | null;
  onRetry: () => void;
  onNewPhoto: () => void;
  onFindByName: () => void;
}

function ScanError({ message, onRetry, onNewPhoto, onFindByName }: ScanErrorProps) {
  const buttonClass =
    "press min-h-11 rounded-full px-6 py-3 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-red";
  return (
    <div className="flex flex-col items-center gap-3 text-center" role="alert">
      <p className="text-ink">{message ?? "Something went wrong."}</p>
      <button type="button" onClick={onRetry} className={cn(buttonClass, "bg-red text-white")}>
        Try again
      </button>
      <button type="button" onClick={onNewPhoto} className={cn(buttonClass, "bg-surface-raised text-ink")}>
        Take a new photo
      </button>
      <button type="button" onClick={onFindByName} className={cn(buttonClass, "bg-surface-raised text-ink")}>
        Find cards by name
      </button>
    </div>
  );
}
