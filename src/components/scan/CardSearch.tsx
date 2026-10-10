"use client";

import { useState } from "react";
import { ChevronLeft, Search, WifiOff } from "lucide-react";
import { z } from "zod";
import { useOnline } from "@/hooks/useOnline";
import { createTcgdexProvider } from "@/lib/catalog/tcgdex";
import { CATALOG_LANGUAGES } from "@/types/catalog.schema";
import type { CardPrinting, CatalogLanguage } from "@/types/catalog";
import { cn } from "@/lib/utils";
import { PrintingArt } from "./PrintingArt";

interface CardSearchProps {
  /** Language to search first (what the scan read, or English). */
  initialLanguage: CatalogLanguage;
  onPick: (printing: CardPrinting) => void;
  onCancel: () => void;
}

const LANGUAGE_LABELS: Record<CatalogLanguage, string> = { en: "English", es: "Español", ja: "日本語" };

/** "Charizard" (name) or "20/189" / "020 / 189" (collector number / set size). */
const searchQuerySchema = z
  .string()
  .trim()
  .min(1, "Type a name or a number")
  .max(60, "That's a bit long — try just the name");
const NUMBER_QUERY = /^([A-Za-z]*\d+[A-Za-z]*)\s*\/\s*(\d+)$/;

const catalog = createTcgdexProvider();

async function searchCatalog(query: string, lang: CatalogLanguage): Promise<CardPrinting[]> {
  const number = NUMBER_QUERY.exec(query);
  if (number) return catalog.findByNumber(number[1], Number(number[2]), lang);
  return catalog.searchByName(query, lang);
}

/**
 * Manual search fallback: find a printing by name or collector number in the
 * catalog, then tap it. Needs the internet; shows a clear offline state.
 */
export function CardSearch({ initialLanguage, onPick, onCancel }: CardSearchProps) {
  const online = useOnline();
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState<CatalogLanguage>(initialLanguage);
  const [results, setResults] = useState<CardPrinting[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = searchQuerySchema.safeParse(query);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Type a name or a number");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const found = await searchCatalog(parsed.data, lang);
      setResults(found);
      if (found.length === 0) setMessage("No cards found. Check the spelling or try the number, like 20/189.");
    } catch {
      setResults(null);
      setMessage("The card list didn't answer. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onCancel}
        className="press flex items-center gap-1 self-start text-sm font-medium text-ink-muted outline-none focus-visible:underline"
      >
        <ChevronLeft className="size-4" /> Back to my cards
      </button>

      {!online ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface p-6 text-center">
          <WifiOff className="size-8 text-ink-muted" />
          <p className="font-semibold text-ink">Searching needs the internet</p>
          <p className="text-sm text-ink-muted">Connect to Wi-Fi and try again.</p>
        </div>
      ) : (
        <>
          <form onSubmit={submit} className="flex gap-2">
            <label className="sr-only" htmlFor="card-search">
              Card name or number
            </label>
            <input
              id="card-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name or number, like 20/189"
              autoComplete="off"
              enterKeyHint="search"
              className="min-h-11 min-w-0 flex-1 rounded-full border border-border bg-surface px-4 text-base text-ink outline-none placeholder:text-ink-muted focus-visible:ring-2 focus-visible:ring-red"
            />
            <button
              type="submit"
              disabled={busy}
              aria-label="Search"
              className="press grid min-h-11 w-12 place-items-center rounded-full bg-red text-white outline-none focus-visible:ring-2 focus-visible:ring-red disabled:opacity-50"
            >
              <Search className="size-5" />
            </button>
          </form>

          <div role="radiogroup" aria-label="Card language" className="flex gap-2">
            {CATALOG_LANGUAGES.map((code) => (
              <button
                key={code}
                type="button"
                role="radio"
                aria-checked={lang === code}
                onClick={() => setLang(code)}
                className={cn(
                  "press rounded-full px-3 py-1.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-red",
                  lang === code ? "bg-ink text-surface" : "bg-surface-raised text-ink-muted",
                )}
              >
                {LANGUAGE_LABELS[code]}
              </button>
            ))}
          </div>

          {message && <p className="text-sm text-ink-muted" role="status">{message}</p>}

          {busy ? (
            <ResultSkeletons />
          ) : (
            results &&
            results.length > 0 && (
              <ul className="grid grid-cols-3 gap-2" aria-label="Search results">
                {results.map((printing) => (
                  <li key={printing.id}>
                    <button
                      type="button"
                      onClick={() => onPick(printing)}
                      className="press block w-full rounded-lg p-0.5 text-left outline-none ring-1 ring-border focus-visible:ring-2 focus-visible:ring-red"
                    >
                      <PrintingArt printing={printing} className="w-full" />
                      <span className="mt-1 block truncate text-xs font-semibold text-ink">{printing.name}</span>
                      <span className="block truncate font-mono text-[0.6rem] text-ink-muted">
                        {printing.set.name} · {printing.collectorNumber}/{printing.set.officialCount}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}
        </>
      )}
    </div>
  );
}

function ResultSkeletons() {
  return (
    <ul className="grid grid-cols-3 gap-2" aria-label="Searching…">
      {[0, 1, 2].map((i) => (
        <li key={i} className="aspect-[63/88] animate-pulse rounded-lg bg-surface-raised motion-reduce:animate-none" />
      ))}
    </ul>
  );
}
