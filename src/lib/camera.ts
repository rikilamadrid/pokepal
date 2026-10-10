import { Capacitor } from "@capacitor/core";

/**
 * Camera adapter — the single seam between the Scan flow and the platform camera.
 * The web build uses a live `getUserMedia` stream + a shutter; native builds
 * (Capacitor) hand off to the OS camera UI via the Camera plugin and get a photo
 * back directly. The Scan flow branches on {@link isNativeCamera}; both paths end
 * by handing an in-memory JPEG Blob to the same `onCapture` callback.
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
 * library) and resolves to the JPEG as an in-memory Blob for recognition.
 * Rejects if the user cancels or denies permission — the Scan flow then keeps
 * its search fallback. Dynamically imported so the plugin never enters the web
 * bundle.
 */
export async function takeNativePhoto(
  source: NativePhotoSource = "camera",
): Promise<Blob> {
  const { Camera, CameraResultType, CameraSource } = await import(
    "@capacitor/camera"
  );
  const photo = await Camera.getPhoto({
    quality: 92,
    resultType: CameraResultType.DataUrl,
    source: source === "library" ? CameraSource.Photos : CameraSource.Camera,
    correctOrientation: true,
    promptLabelHeader: "Add cards",
    promptLabelPhoto: "Choose from library",
    promptLabelPicture: "Take a photo",
  });
  if (!photo.dataUrl) throw new Error("No photo returned");
  return dataUrlToBlob(photo.dataUrl);
}

/** Decode a base64 data URL into a Blob, in memory. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/.exec(dataUrl);
  if (!match || !match[2]) throw new Error("Expected a base64 data URL");
  const binary = atob(match[3]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: match[1] ?? "image/jpeg" });
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
 * Draw the current video frame to a canvas and return it as an in-memory JPEG
 * Blob at full camera resolution (0.92). Recognition downsizes it to ~1600px;
 * the frame is never stored.
 */
export function captureFrame(video: HTMLVideoElement): Promise<Blob> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas 2D context unavailable"));
  ctx.drawImage(video, 0, 0, width, height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("JPEG encoding failed"))),
      "image/jpeg",
      0.92,
    ),
  );
}
