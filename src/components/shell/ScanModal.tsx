"use client";

import { useEffect } from "react";

interface ScanModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Placeholder Scan bottom sheet opened by the center tab-bar puck. The real
 * three-step camera → confirm → tag flow lands in phase 8; this just proves the
 * puck opens a dismissible modal.
 */
export function ScanModal({ open, onClose }: ScanModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close scan"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Scan a card"
        className="glass pb-safe relative z-10 w-full max-w-[480px] rounded-t-3xl border-t border-border px-5 pt-3"
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-ink-muted/40" />
        <div className="flex flex-col items-center gap-2 pb-8 text-center">
          <p className="font-display text-2xl text-ink">Scan a Card</p>
          <p className="text-sm text-ink-muted">
            Camera → confirm → tag flow arrives in phase 8.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="press mt-4 rounded-full bg-red px-6 py-2 font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-red"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
