/**
 * Camera adapter — the single seam between the Scan flow and the platform camera.
 * The web build uses `getUserMedia`; phase 13 swaps in the Capacitor Camera
 * plugin behind this same interface without touching the flow components.
 */
export interface CameraAdapter {
  /** Start a rear-facing video stream. Rejects if unavailable or denied. */
  start(): Promise<MediaStream>;
}

export const webCameraAdapter: CameraAdapter = {
  async start() {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      throw new Error("Camera API unavailable");
    }
    return navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
  },
};

/**
 * Draw the current video frame to a canvas and return a JPEG data URI. Captured
 * near-lossless (0.92) — the Scan flow downscales/re-encodes to 640px via the
 * phase-2 `compressImage` util once the user confirms the shot.
 */
export function captureFrame(video: HTMLVideoElement): string {
  const width = video.videoWidth;
  const height = video.videoHeight;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.92);
}
