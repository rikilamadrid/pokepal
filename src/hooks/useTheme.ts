"use client";

import { useCallback, useEffect, useState } from "react";
import {
  applyTheme,
  resolveInitialTheme,
  writeTheme,
  type Theme,
} from "@/lib/theme";

/**
 * Reads the resolved theme on mount (stored choice → prefers-color-scheme → dark),
 * keeps the <html> `dark` class in sync, and persists every change. The no-flash
 * inline script in the root layout applies the theme before this hook runs.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const initial = resolveInitialTheme();
    applyTheme(initial);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot init; mirrors the pre-paint script
    setThemeState(initial);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    writeTheme(next);
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      writeTheme(next);
      return next;
    });
  }, []);

  return { theme, setTheme, toggle };
}
