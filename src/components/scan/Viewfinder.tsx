"use client";

import { useRef } from "react";
import { Camera, ImageUp, Images } from "lucide-react";
import { useCamera } from "@/hooks/useCamera";
import { captureFrame, isNativeCamera, takeNativePhoto } from "@/lib/camera";

interface ViewfinderProps {
  /** Called with a JPEG data URI once a frame is captured or a file is picked. */
  onCapture: (dataUri: string) => void;
  /** Skip the photo — the card gets generated SVG art instead. */
  onSkip: () => void;
}

/**
 * Step 1 — capture a card photo. On native (Capacitor) the OS camera / library
 * handles capture via {@link NativeViewfinder}; on the web it's a live rear feed
 * inside a golden target frame with a shutter, falling back to file upload when
 * the camera is unavailable or denied.
 */
export function Viewfinder({ onCapture, onSkip }: ViewfinderProps) {
  if (isNativeCamera()) {
    return <NativeViewfinder onCapture={onCapture} onSkip={onSkip} />;
  }
  return <WebViewfinder onCapture={onCapture} onSkip={onSkip} />;
}

/**
 * Native capture — hands off to the OS camera / photo library through the
 * Capacitor Camera plugin. No live preview element; the plugin returns the photo.
 */
function NativeViewfinder({ onCapture, onSkip }: ViewfinderProps) {
  const capture = async (source: "camera" | "library") => {
    try {
      onCapture(await takeNativePhoto(source));
    } catch {
      // User cancelled or denied — stay on the step so they can retry or skip.
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="grid aspect-[3/4] w-full max-w-[300px] place-items-center rounded-3xl border-2 border-gold/40 bg-black">
        <Camera className="size-12 text-gold/70" />
      </div>
      <p className="mt-3 text-center text-sm text-ink-muted">
        Snap your card or pick one from your library.
      </p>
      <div className="mt-4 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => capture("camera")}
          className="press flex items-center gap-2 rounded-full bg-red px-6 py-3 font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-red"
        >
          <Camera className="size-5" /> Take a photo
        </button>
        <button
          type="button"
          onClick={() => capture("library")}
          className="press flex items-center gap-2 text-sm font-medium text-ink-muted outline-none hover:underline focus-visible:underline"
        >
          <Images className="size-4" /> Choose from library
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="press text-sm font-medium text-ink-muted underline-offset-4 outline-none hover:underline focus-visible:underline"
        >
          Skip photo &amp; add manually
        </button>
      </div>
    </div>
  );
}

/**
 * Web capture — live rear camera feed inside a golden target frame with a
 * shutter. Falls back to a file upload when the camera is unavailable or denied.
 */
function WebViewfinder({ onCapture, onSkip }: ViewfinderProps) {
  const { videoRef, status } = useCamera();
  const fileRef = useRef<HTMLInputElement>(null);

  const onShutter = () => {
    if (!videoRef.current) return;
    onCapture(captureFrame(videoRef.current));
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onCapture(String(reader.result));
    reader.readAsDataURL(file);
  };

  const failed = status === "error";

  return (
    <div className="flex flex-col items-center">
      {/* Framed preview */}
      <div className="relative aspect-[3/4] w-full max-w-[300px] overflow-hidden rounded-3xl bg-black">
        {!failed && (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="absolute inset-0 size-full object-cover"
          />
        )}

        {/* Golden target frame */}
        <div className="pointer-events-none absolute inset-5 rounded-2xl border-2 border-gold/90 shadow-[0_0_0_100vmax_rgba(0,0,0,0.25)]" />

        {failed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <ImageUp className="size-8 text-ink-muted" />
            <p className="text-sm text-ink-muted">
              Camera unavailable. Upload a photo of your card instead.
            </p>
          </div>
        ) : (
          status === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-ink-muted">Starting camera…</p>
            </div>
          )
        )}
      </div>

      {/* Hint */}
      <p className="mt-3 text-center text-sm text-ink-muted">
        {failed
          ? "No camera? No problem."
          : "Line the card up inside the frame."}
      </p>

      {/* Controls */}
      <div className="mt-4 flex flex-col items-center gap-3">
        {failed ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="press rounded-full bg-red px-6 py-3 font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-red"
          >
            Upload a photo instead
          </button>
        ) : (
          <button
            type="button"
            onClick={onShutter}
            disabled={status !== "live"}
            aria-label="Capture photo"
            className="press grid size-[68px] place-items-center rounded-full bg-white/10 outline-none focus-visible:ring-2 focus-visible:ring-red disabled:opacity-40"
          >
            <span className="block size-14 rounded-full border-4 border-white bg-white" />
          </button>
        )}

        <button
          type="button"
          onClick={onSkip}
          className="press text-sm font-medium text-ink-muted underline-offset-4 outline-none hover:underline focus-visible:underline"
        >
          Skip photo &amp; add manually
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFile}
        className="hidden"
      />
    </div>
  );
}
