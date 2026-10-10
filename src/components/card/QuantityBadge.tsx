import { cn } from "@/lib/utils";

/** Gold "×N" chip: copies owned of one exact printing. */
export function QuantityBadge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cn(
        "rounded-md border border-black/20 bg-gold px-1.5 py-0.5 font-mono text-[0.62rem] font-bold text-black shadow",
        className,
      )}
    >
      ×{count}
    </span>
  );
}
