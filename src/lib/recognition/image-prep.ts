import type { ScanBatch } from "@/types/scan";

/** Long-edge target per mode: batch reads 5–10 small cards, trade-check one. */
export const LONG_EDGE: Readonly<Record<ScanBatch["mode"], number>> = {
  batch: 1600,
  "trade-check": 1024,
};
export const RECOGNITION_JPEG_QUALITY = 0.85;

/** Output size for a source image: long edge capped at the mode's target, never upscaled. */
export function targetSize(
  width: number,
  height: number,
  mode: ScanBatch["mode"],
): { width: number; height: number } {
  if (!(width > 0 && height > 0)) throw new RangeError("Image has no size");
  const scale = Math.min(1, LONG_EDGE[mode] / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Resize a captured photo for recognition and re-encode it as JPEG, entirely
 * in memory: the result is a Blob that goes to the transport and nowhere else
 * (no data URI, no storage). Browser-only (createImageBitmap + canvas).
 */
export async function prepareImage(source: Blob, mode: ScanBatch["mode"]): Promise<Blob> {
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") {
    throw new Error("prepareImage must run in the browser");
  }
  const bitmap = await createImageBitmap(source);
  try {
    const { width, height } = targetSize(bitmap.width, bitmap.height, mode);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("JPEG encoding failed"))),
        "image/jpeg",
        RECOGNITION_JPEG_QUALITY,
      ),
    );
  } finally {
    bitmap.close();
  }
}
