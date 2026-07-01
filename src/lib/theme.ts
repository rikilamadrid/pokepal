/**
 * Theme persistence + application. The app is dark-first; light is the swap.
 * The dark palette is applied via a `dark` class on <html> (see globals.css),
 * so switching themes is just toggling that class. This is the ONLY module that
 * touches the theme storage key.
 */
export type Theme = "light" | "dark";

export const THEME_KEY = "theme";

/** Read the persisted theme choice. Returns null when absent / unreadable / SSR. */
export function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(THEME_KEY);
    return raw === "light" || raw === "dark" ? raw : null;
  } catch {
    return null;
  }
}

/** Persist the theme choice. No-ops during SSR. */
export function writeTheme(theme: Theme): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // storage unavailable — the in-memory theme stays authoritative
  }
}

/**
 * Resolve the initial theme: the stored choice, else the OS `prefers-color-scheme`,
 * else dark (the default).
 */
export function resolveInitialTheme(): Theme {
  const stored = readStoredTheme();
  if (stored) return stored;
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: light)").matches
  ) {
    return "light";
  }
  return "dark";
}

/** Apply a theme by toggling the `dark` class on <html>. */
export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/**
 * A tiny script string run before paint (in <head>) so the stored/preferred theme
 * is applied without a flash of the default dark theme on light-mode devices.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";}document.documentElement.classList.toggle("dark",t==="dark");}catch(e){}})();`;
