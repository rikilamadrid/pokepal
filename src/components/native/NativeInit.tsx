"use client";

import { useEffect } from "react";
import { isNativeCamera } from "@/lib/camera";

/**
 * Native-shell startup — runs only inside the Capacitor app (no-op on web/PWA).
 * Styles the status bar to match the dark app canvas and hides the splash screen
 * once React has mounted, so there's no white flash between launch and first
 * paint. Plugins are dynamically imported so they never enter the web bundle.
 */
export function NativeInit() {
  useEffect(() => {
    if (!isNativeCamera()) return;

    (async () => {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: Style.Dark });
        // Android only — draw content behind a transparent status bar so the
        // app's own safe-area insets handle the notch (matches iOS overlay).
        await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
      } catch {
        // Status bar plugin unavailable — non-fatal.
      }

      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide();
      } catch {
        // Splash plugin unavailable — non-fatal.
      }
    })();
  }, []);

  return null;
}
