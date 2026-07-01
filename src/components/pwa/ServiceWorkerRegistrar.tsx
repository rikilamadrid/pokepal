"use client";

import { useEffect } from "react";

/**
 * Registers the hand-rolled service worker (public/sw.js) on mount so PokéPal
 * installs and works offline. When an updated worker takes control of an already
 * controlled page, it silently reloads once to pick up the new build; the very
 * first visit (no existing controller) never force-reloads.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Only wire up auto-refresh when a worker already controls this page — a
    // controllerchange then means a genuine update, not the first install.
    if (navigator.serviceWorker.controller) {
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    }

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // registration failing (e.g. non-HTTPS dev) just means no offline cache
      });
    };

    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
