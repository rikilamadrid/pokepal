import type { CardType } from "@/types/card";

/**
 * Single source of truth for the type gradients. Mirrors the `--grad-*` CSS
 * tokens defined in globals.css (phase 1). Consumed by generated art and by UI
 * for card art, frames, tiles, and the type picker.
 */
export interface GradientStops {
  /** light stop */
  from: string;
  /** dark stop */
  to: string;
}

export const TYPE_GRADIENTS: Record<CardType, GradientStops> = {
  fire: { from: "#ffb27a", to: "#ff6a3d" },
  water: { from: "#8fd2ff", to: "#2f8fe0" },
  grass: { from: "#b6e89a", to: "#4fae4f" },
  electric: { from: "#fff0a0", to: "#ffce2e" },
  psychic: { from: "#e3bdff", to: "#a85bf0" },
  rock: { from: "#e3cf9e", to: "#a9824a" },
};

/** CSS `linear-gradient(...)` string for a type, matching the phase-1 angle. */
export function typeGradientCss(type: CardType): string {
  const { from, to } = TYPE_GRADIENTS[type];
  return `linear-gradient(160deg, ${from}, ${to})`;
}
