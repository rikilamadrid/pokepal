import { Star } from "lucide-react";
import type { CardType } from "@/types/card";
import { typeGradientCss } from "@/lib/type-gradients";
import { cn } from "@/lib/utils";

interface TypeBadgeProps {
  type: CardType;
  /** Show the gold favorite star overlapping the badge's leading edge. */
  favorite?: boolean;
  className?: string;
}

/** Gradient-tinted pill with the type label in mono caps (FIRE / WATER / …). */
export function TypeBadge({ type, favorite = false, className }: TypeBadgeProps) {
  return (
    <div className={cn("relative inline-flex", className)}>
      {favorite && (
        <Star
          aria-hidden
          className="absolute -left-2 -top-2 z-10 size-4 fill-gold text-gold drop-shadow"
        />
      )}
      <span
        className="rounded-full border border-black/15 px-2.5 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-wider text-black/80 shadow-sm"
        style={{ backgroundImage: typeGradientCss(type) }}
      >
        {type}
      </span>
    </div>
  );
}
