"use client";

import { useState } from "react";

interface ConfirmStepProps {
  /** The captured/uploaded frame (uncompressed data URI). */
  photo: string;
  onRetake: () => void;
  /** Fires after the frame is compressed (max 640px, JPEG 0.78). */
  onConfirm: () => void | Promise<void>;
}

/**
 * Step 2 — preview the captured frame. "Retake" restarts the camera; "Use this
 * photo" runs compression (handled by the parent) and advances to the tag form.
 */
export function ConfirmStep({ photo, onRetake, onConfirm }: ConfirmStepProps) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative aspect-[3/4] w-full max-w-[300px] overflow-hidden rounded-3xl bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo}
          alt="Captured card"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="pointer-events-none absolute inset-5 rounded-2xl border-2 border-gold/90" />
      </div>

      <div className="mt-5 flex w-full max-w-[300px] gap-3">
        <button
          type="button"
          onClick={onRetake}
          disabled={busy}
          className="press flex-1 rounded-full bg-surface-raised py-3 font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-red disabled:opacity-50"
        >
          Retake
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          className="press flex-1 rounded-full bg-red py-3 font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-red disabled:opacity-50"
        >
          {busy ? "Saving…" : "Use this photo"}
        </button>
      </div>
    </div>
  );
}
