const MAX_WIDTH = 640;
const JPEG_QUALITY = 0.78;

/** Load a data URI or File into an HTMLImageElement. */
function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for compression"));
    img.src = source;
  });
}

/**
 * Draw a source image (data URI or File) onto a canvas at max 640px wide and
 * re-encode as JPEG quality 0.78, returning a data URI. Browser-only (uses
 * canvas); consumed by the Scan flow in phase 8.
 */
export async function compressImage(source: string | File): Promise<string> {
  if (typeof document === "undefined") {
    throw new Error("compressImage must run in the browser");
  }

  const src =
    typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    const img = await loadImage(src);
    const scale = Math.min(1, MAX_WIDTH / img.width);
    const width = Math.round(img.width * scale);
    const height = Math.round(img.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(img, 0, 0, width, height);

    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } finally {
    if (typeof source !== "string") URL.revokeObjectURL(src);
  }
}
