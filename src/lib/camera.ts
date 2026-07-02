import { Capacitor } from "@capacitor/core";

/**
 * Camera adapter — the single seam between the Scan flow and the platform camera.
 * The web build uses a live `getUserMedia` stream + a shutter; native builds
 * (Capacitor) hand off to the OS camera UI via the Camera plugin and get a photo
 * back directly. The Scan flow branches on {@link isNativeCamera}; both paths end
 * by handing a JPEG data URI to the same `onCapture` callback.
 */
export interface CameraAdapter {
  /** Start a rear-facing video stream. Rejects if unavailable or denied. */
  start(): Promise<MediaStream>;
}

/** True inside the Capacitor native shell (iOS/Android), false on the web/PWA. */
export function isNativeCamera(): boolean {
  return Capacitor.isNativePlatform();
}

export type NativePhotoSource = "camera" | "library";

/**
 * Native capture via the Capacitor Camera plugin. Opens the OS camera (or photo
 * library) and resolves to a JPEG data URI the phase-2 `compressImage` util can
 * consume. Rejects if the user cancels or denies permission — the Scan flow then
 * keeps the upload / generated-art fallback. Dynamically imported so the plugin
 * never enters the web bundle.
 */
export async function takeNativePhoto(
  source: NativePhotoSource = "camera",
): Promise<string> {
  const { Camera, CameraResultType, CameraSource } = await import(
    "@capacitor/camera"
  );
  const photo = await Camera.getPhoto({
    quality: 92,
    resultType: CameraResultType.DataUrl,
    source: source === "library" ? CameraSource.Photos : CameraSource.Camera,
    correctOrientation: true,
    promptLabelHeader: "Add a card",
    promptLabelPhoto: "Choose from library",
    promptLabelPicture: "Take a photo",
  });
  if (!photo.dataUrl) throw new Error("No photo returned");
  return photo.dataUrl;
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
