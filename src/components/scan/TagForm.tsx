"use client";

import { useMemo, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { PokeCard } from "@/components/card/PokeCard";
import { generateCreatureArt } from "@/lib/art-gen";
import { typeGradientCss } from "@/lib/type-gradients";
import {
  CARD_TYPES,
  RARITIES,
  scanFormSchema,
  type ScanFormValues,
} from "@/lib/scan-schema";
import type { Card, CardType, Rarity } from "@/types/card";
import { cn } from "@/lib/utils";

interface TagFormProps {
  /** Compressed capture, or `null` when the photo was skipped (→ generated art). */
  photo: string | null;
  onSubmit: (values: ScanFormValues) => void;
}

/**
 * Step 3 — name / type / dex / rarity / favorite, validated with Zod. Shows a
 * live PokeCard preview of the entered values. On submit the parent builds the
 * Card via `addCard` (which fills the id, dates, and auto dex).
 */
export function TagForm({ photo, onSubmit }: TagFormProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<CardType>("water");
  const [dexNo, setDexNo] = useState("");
  const [rarity, setRarity] = useState<Rarity>("common");
  const [favorite, setFavorite] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewCard = useMemo<Card>(() => {
    const displayName = name.trim() || "New Card";
    const displayDex = dexNo.trim() || "000";
    const now = new Date().toISOString();
    return {
      id: "preview",
      ownerId: "",
      name: displayName,
      dexNo: displayDex.padStart(3, "0"),
      type,
      rarity,
      favorite,
      img: photo ?? generateCreatureArt(displayName, displayDex, type),
      caughtAt: now,
      updatedAt: now,
    };
  }, [name, dexNo, type, rarity, favorite, photo]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = scanFormSchema.safeParse({
      name,
      type,
      dexNo,
      rarity,
      favorite,
    });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Check the form");
      return;
    }
    setError(null);
    onSubmit(result.data);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Live preview */}
      <div className="mx-auto w-[46%] min-w-[150px]">
        <PokeCard card={previewCard} />
      </div>

      {/* Name */}
      <label className="flex flex-col gap-1.5">
        <span className="eyebrow">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Tidaltail"
          autoFocus
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink outline-none placeholder:text-ink-muted/60 focus-visible:ring-2 focus-visible:ring-red"
        />
      </label>

      {/* Type picker */}
      <div className="flex flex-col gap-1.5">
        <span className="eyebrow">Type</span>
        <div className="grid grid-cols-3 gap-2">
          {CARD_TYPES.map((t) => {
            const selected = t === type;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                aria-pressed={selected}
                className={cn(
                  "press rounded-full py-2 font-mono text-xs font-bold uppercase tracking-wider text-black/80 outline-none transition-[box-shadow] focus-visible:ring-2 focus-visible:ring-red",
                  selected
                    ? "ring-2 ring-ink ring-offset-2 ring-offset-surface"
                    : "opacity-70",
                )}
                style={{ backgroundImage: typeGradientCss(t) }}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dex + rarity */}
      <div className="flex gap-3">
        <label className="flex w-28 flex-col gap-1.5">
          <span className="eyebrow">Dex No.</span>
          <input
            value={dexNo}
            onChange={(e) => setDexNo(e.target.value)}
            inputMode="numeric"
            placeholder="Auto"
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 font-mono text-ink outline-none placeholder:text-ink-muted/60 focus-visible:ring-2 focus-visible:ring-red"
          />
        </label>
        <div className="flex flex-1 flex-col gap-1.5">
          <span className="eyebrow">Rarity</span>
          <div className="grid grid-cols-2 gap-2">
            {RARITIES.map((r) => {
              const selected = r === rarity;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRarity(r)}
                  aria-pressed={selected}
                  className={cn(
                    "press rounded-xl py-2.5 font-mono text-xs font-bold uppercase tracking-wider outline-none focus-visible:ring-2 focus-visible:ring-red",
                    selected
                      ? "bg-gold text-black"
                      : "bg-surface-raised text-ink-muted",
                  )}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Favorite */}
      <label className="flex items-center justify-between rounded-xl bg-surface-raised px-4 py-3">
        <span className="font-medium text-ink">Add to favorites</span>
        <Switch checked={favorite} onCheckedChange={setFavorite} />
      </label>

      {error && <p className="text-sm font-medium text-red">{error}</p>}

      <button
        type="submit"
        className="press rounded-full bg-red py-3.5 font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-red"
      >
        Add to collection
      </button>
    </form>
  );
}
