import { Search, X } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * iOS-style frosted search field: leading magnifier, and a clear (✕) button once
 * there is text. Controlled — the Collection screen owns the query and debounces
 * the filter separately.
 */
export function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
  return (
    <div className="glass flex items-center gap-2 rounded-xl border border-border px-3 py-2">
      <Search aria-hidden className="size-4 shrink-0 text-ink-muted" />
      <input
        type="text"
        inputMode="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Search"}
        className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="press grid size-5 shrink-0 place-items-center rounded-full bg-surface-raised text-ink-muted outline-none focus-visible:ring-2 focus-visible:ring-red"
        >
          <X aria-hidden className="size-3" />
        </button>
      )}
    </div>
  );
}
