"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { webCameraAdapter } from "@/lib/camera";

export type CameraStatus = "starting" | "live" | "error";

/**
 * Manages a rear-camera stream for the Scan viewfinder. Attaches the stream to a
 * video element, tracks status, and tears the stream down on unmount — so the
 * camera is only ever live while the viewfinder step is mounted. On any failure
 * (permission denied, no camera, non-HTTPS) it lands in `"error"` so the flow can
 * show the upload fallback.
 */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("starting");

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    webCameraAdapter
      .start()
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
        setStatus("live");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      stop();
    };
  }, [stop]);

  return { videoRef, status };
}
