import type { PrintingGroup } from "@/lib/collection-utils";
import { formatCollectorNumber } from "@/lib/collection-utils";
import { formatCaughtDate } from "@/lib/date";
import { PrintingArt } from "@/components/card/PrintingArt";
import { QuantityBadge } from "@/components/card/QuantityBadge";

interface HeroPrintingProps {
  group: PrintingGroup;
  onSelect?: (group: PrintingGroup) => void;
}

/**
 * Home's "latest catch" hero for a 2.0 printing: the catalog artwork large,
 * with the gentle float/tilt, then the name and set line.
 */
export function HeroPrinting({ group, onSelect }: HeroPrintingProps) {
  const { printing, count } = group;
  const number = formatCollectorNumber(printing);
  return (
    <section className="flex flex-col items-center gap-3 px-5 pt-2">
      <p className="eyebrow self-start">Latest Catch</p>
      <div className="hero-float w-56 max-w-full">
        <button
          type="button"
          disabled={!onSelect}
          onClick={onSelect ? () => onSelect(group) : undefined}
          aria-label={`${printing.name}, ${printing.set.name} ${number}, ${count} ${count === 1 ? "copy" : "copies"}`}
          className="press relative block w-full rounded-[18px] shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-red disabled:pointer-events-none"
        >
          <PrintingArt printing={printing} quality="high" />
          {count > 1 && <QuantityBadge count={count} className="absolute left-2 top-2" />}
        </button>
      </div>
      <div className="flex flex-col items-center gap-0.5 pt-1 text-center">
        <h2 className="font-display text-2xl leading-tight text-ink">{printing.name}</h2>
        <p className="font-mono text-xs text-ink-muted">
          {printing.set.name} · {number}
          {printing.rarity ? ` · ${printing.rarity}` : ""}
        </p>
        <p className="eyebrow">Caught {formatCaughtDate(group.latestAcquiredAt)}</p>
      </div>
    </section>
  );
}
