"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DetailSheetProps {
  /** Heading shown in the sheet and used for the dialog's accessible name. */
  title: string;
  /** Called once the sheet has fully closed (after the exit animation). */
  onClosed: () => void;
  /** Sheet body; receives `requestClose` to dismiss with the exit animation. */
  children: (requestClose: () => void) => React.ReactNode;
}

const DRAG_DISMISS_PX = 110;

/**
 * Bottom-sheet chrome shared by the card detail sheets: backdrop, drag handle,
 * header with ✕, slide in/out. Dismiss via drag-down, backdrop, ✕, or Escape.
 * `onClosed` fires after the slide-down so content stays visible mid-exit.
 */
export function DetailSheet({ title, onClosed, children }: DetailSheetProps) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [closing, setClosing] = useState(false);
  const dragStart = useRef<number | null>(null);

  // Play the slide-down, then report closed. Under reduced motion there's no
  // exit animation (animationend never fires), so close immediately.
  const requestClose = useCallback(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      onClosed();
      return;
    }
    setClosing(true);
  }, [onClosed]);

  const onExitAnimationEnd = (e: React.AnimationEvent) => {
    // Ignore the entry animation's end and any animation bubbling from content.
    if (!closing || e.target !== e.currentTarget) return;
    onClosed();
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
  const onPointerUp = useCallback(() => {
    if (dragStart.current === null) return;
    dragStart.current = null;
    setDragging(false);
    setDragY((y) => {
      if (y > DRAG_DISMISS_PX) requestClose();
      return 0;
    });
  }, [requestClose]);

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
        aria-label={`${title} details`}
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
          <h2 className="truncate font-display text-2xl text-ink">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={requestClose}
            className="press grid size-8 shrink-0 place-items-center rounded-full bg-surface-raised text-ink-muted outline-none focus-visible:ring-2 focus-visible:ring-red"
          >
            <X className="size-4" />
          </button>
        </div>

        {children(requestClose)}
      </div>
    </div>
  );
}
