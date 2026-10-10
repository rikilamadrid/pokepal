"use client";

import { useCallback, useMemo, useRef } from "react";
import { Star } from "lucide-react";
import { useOwnedCollection } from "@/hooks/useOwnedCollection";
import {
  copyToRelease,
  dexLabels,
  favoriteToggleIds,
  finishBreakdown,
  formatCollectorNumber,
  groupByPrinting,
} from "@/lib/collection-utils";
import { DetailSheet } from "@/components/card/DetailSheet";
import { PrintingArt } from "@/components/card/PrintingArt";
import { QuantityBadge } from "@/components/card/QuantityBadge";
import { cn } from "@/lib/utils";

interface PrintingDetailSheetProps {
  /** Printing to show; the sheet renders nothing once no copy is left. */
  printingId: string;
  onClose: () => void;
}

/**
 * Bottom-sheet detail for one exact catalog printing: large artwork, verified
 * metadata (set + number, rarity, energy, Pokédex number + region), copies by
 * finish, a printing-level favorite, and "release one" copy.
 */
export function PrintingDetailSheet({ printingId, onClose }: PrintingDetailSheetProps) {
  const { owned, printings, toggleFavorite, releaseCopy } = useOwnedCollection();
  // Releasing the last copy is deferred until the slide-down finishes.
  const pendingRelease = useRef<string | null>(null);

  const group = useMemo(
    () =>
      groupByPrinting(
        owned.filter((card) => card.printingId === printingId),
        printings,
      )[0] ?? null,
    [owned, printings, printingId],
  );

  const onClosed = useCallback(() => {
    if (pendingRelease.current) releaseCopy(pendingRelease.current);
    onClose();
  }, [onClose, releaseCopy]);

  if (!group) return null;
  const { printing, count, favorite } = group;
  const dex = dexLabels(printing);

  return (
    <DetailSheet title={printing.name} onClosed={onClosed}>
      {(requestClose) => (
        <>
          <div className="relative mx-auto w-[66%] min-w-[180px] max-w-[300px] shadow-lg">
            <PrintingArt printing={printing} quality="high" />
            {count > 1 && <QuantityBadge count={count} className="absolute left-2 top-2" />}
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-2.5">
            <Stat label="Set" value={printing.set.name} />
            <Stat label="Number" value={formatCollectorNumber(printing)} mono />
            <Stat label="Rarity" value={printing.rarity ?? "—"} />
            <Stat
              label="Energy"
              value={printing.energyTypes.length ? printing.energyTypes.join(", ") : "—"}
              capitalize
            />
            <Stat label="Pokédex" value={dex.length ? dex.join(", ") : "—"} mono />
            <Stat
              label="Copies"
              value={`×${count}`}
              detail={finishBreakdown(group).join(" · ")}
              mono
            />
          </dl>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => favoriteToggleIds(group).forEach(toggleFavorite)}
              aria-pressed={favorite}
              className={cn(
                "press flex flex-1 items-center justify-center gap-2 rounded-full py-3 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-gold",
                favorite ? "bg-gold text-black" : "bg-surface-raised text-ink",
              )}
            >
              <Star className={cn("size-4", favorite && "fill-black")} />
              {favorite ? "Favorited" : "Favorite"}
            </button>
            <button
              type="button"
              onClick={() => {
                const copy = copyToRelease(group);
                if (count > 1) {
                  releaseCopy(copy.id);
                  return;
                }
                pendingRelease.current = copy.id;
                requestClose();
              }}
              className="press flex-1 rounded-full bg-red/15 py-3 font-semibold text-red outline-none focus-visible:ring-2 focus-visible:ring-red"
            >
              {count > 1 ? "Release one" : "Release"}
            </button>
          </div>
        </>
      )}
    </DetailSheet>
  );
}

interface StatProps {
  label: string;
  value: string;
  /** Secondary line under the value. */
  detail?: string;
  mono?: boolean;
  capitalize?: boolean;
}

function Stat({ label, value, detail, mono = false, capitalize = false }: StatProps) {
  return (
    <div className="rounded-2xl bg-surface-raised px-3.5 py-2.5">
      <dt className="eyebrow">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-sm font-bold text-ink",
          mono && "font-mono",
          capitalize && "capitalize",
        )}
      >
        {value}
      </dd>
      {detail && <dd className="mt-0.5 text-xs text-ink-muted">{detail}</dd>}
    </div>
  );
}
