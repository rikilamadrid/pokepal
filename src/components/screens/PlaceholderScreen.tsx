interface PlaceholderScreenProps {
  /** Big display title shown at the top of the scroll area. */
  title: string;
  /** One-line note about which phase fills this screen in. */
  note: string;
  /** Number of filler rows — enough to make the screen scroll for testing. */
  rows?: number;
}

/**
 * Labeled, scrollable placeholder body for Collection / Favorites / Settings.
 * Proves navigation, title modes, and the scroll-aware navbar border until the
 * real screens land (phases 6 & 9).
 */
export function PlaceholderScreen({ title, note, rows = 12 }: PlaceholderScreenProps) {
  return (
    <div className="flex flex-col gap-4 px-5 pb-8 pt-5">
      <h1 className="font-display text-3xl tracking-wide text-ink">{title}</h1>
      <p className="eyebrow">{note}</p>
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="h-16 rounded-2xl border border-border bg-surface-raised"
          />
        ))}
      </div>
    </div>
  );
}
