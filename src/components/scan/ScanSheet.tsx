"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, X } from "lucide-react";
import { toast } from "sonner";
import { useCollection } from "@/hooks/useCollection";
import { compressImage } from "@/lib/image-compress";
import type { ScanFormValues } from "@/lib/scan-schema";
import { Viewfinder } from "./Viewfinder";
import { ConfirmStep } from "./ConfirmStep";
import { TagForm } from "./TagForm";
import { cn } from "@/lib/utils";

interface ScanSheetProps {
  onClose: () => void;
}

type Step = "viewfinder" | "confirm" | "tag";

const DRAG_DISMISS_PX = 110;

const STEP_TITLES: Record<Step, string> = {
  viewfinder: "Scan a Card",
  confirm: "Looking good?",
  tag: "Tag your card",
};

/**
 * Three-step Scan bottom sheet: viewfinder → confirm → tag. Owns the step state
 * machine and the captured photo; lazy-loaded by the shell so the camera stack
 * stays out of the initial bundle. Dismiss via drag-down, backdrop, ✕, or Escape.
 */
export function ScanSheet({ onClose }: ScanSheetProps) {
  const { addCard } = useCollection();
  const [step, setStep] = useState<Step>("viewfinder");
  const [rawPhoto, setRawPhoto] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

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

  // Step transitions
  const handleCapture = (dataUri: string) => {
    setRawPhoto(dataUri);
    setStep("confirm");
  };
  const handleSkip = () => {
    setRawPhoto(null);
    setPhoto(null);
    setStep("tag");
  };
  const handleRetake = () => {
    setRawPhoto(null);
    setStep("viewfinder");
  };
  const handleConfirm = async () => {
    if (!rawPhoto) return;
    setPhoto(await compressImage(rawPhoto));
    setStep("tag");
  };
  const handleBack = () => {
    setStep(rawPhoto ? "confirm" : "viewfinder");
  };
  const handleSubmit = (values: ScanFormValues) => {
    const card = addCard({
      name: values.name,
      type: values.type,
      rarity: values.rarity,
      favorite: values.favorite,
      dexNo: values.dexNo || undefined,
      img: photo ?? undefined,
    });
    toast.success(`${card.name} added to your collection!`);
    requestClose();
  };

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
        aria-label="Scan a card"
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
          {step === "viewfinder" ? (
            <span className="size-8" aria-hidden />
          ) : (
            <button
              type="button"
              aria-label="Back"
              onClick={handleBack}
              className="press grid size-8 shrink-0 place-items-center rounded-full bg-surface-raised text-ink-muted outline-none focus-visible:ring-2 focus-visible:ring-red"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
          <h2 className="font-display text-2xl text-ink">{STEP_TITLES[step]}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={requestClose}
            className="press grid size-8 shrink-0 place-items-center rounded-full bg-surface-raised text-ink-muted outline-none focus-visible:ring-2 focus-visible:ring-red"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Step body */}
        {step === "viewfinder" && (
          <Viewfinder onCapture={handleCapture} onSkip={handleSkip} />
        )}
        {step === "confirm" && rawPhoto && (
          <ConfirmStep
            photo={rawPhoto}
            onRetake={handleRetake}
            onConfirm={handleConfirm}
          />
        )}
        {step === "tag" && <TagForm photo={photo} onSubmit={handleSubmit} />}
      </div>
    </div>
  );
}
