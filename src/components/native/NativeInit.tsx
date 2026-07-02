"use client";

import { useEffect } from "react";
import { isNativeCamera } from "@/lib/camera";

/**
 * Native-shell startup — runs only inside the Capacitor app (no-op on web/PWA).
 * Keeps the status bar text legible by matching its style to the active theme
 * (and re-matching whenever the `dark` class on <html> flips), and hides the
 * splash screen once React has mounted so there's no white flash on launch.
 * Plugins are dynamically imported so they never enter the web bundle.
 */
export function NativeInit() {
  useEffect(() => {
    if (!isNativeCamera()) return;

    let observer: MutationObserver | undefined;

    (async () => {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        // Style.Dark = light text (for a dark bg); Style.Light = dark text.
        const sync = () => {
          const isDark = document.documentElement.classList.contains("dark");
          void StatusBar.setStyle({
            style: isDark ? Style.Dark : Style.Light,
          }).catch(() => {});
        };
        sync();
        // Re-sync when the theme toggle flips the `dark` class on <html>.
        observer = new MutationObserver(sync);
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["class"],
        });
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

    return () => observer?.disconnect();
  }, []);

  return null;
}
