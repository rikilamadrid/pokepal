interface CardRowProps<T> {
  label: string;
  items: readonly T[];
  itemKey: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  /** Optional secondary line under the label (e.g. what "Old cards" means). */
  description?: string;
  /** Optional "See all" affordance (e.g. Favorites → its tab). */
  onSeeAll?: () => void;
  /** Shown in place of the row when there are no items. */
  emptyHint: string;
}

/**
 * Home's horizontal-scroll card strip: eyebrow label + count pill, an optional
 * "See all" link, and a momentum row of tiles (hidden scrollbar, edge
 * padding). Falls back to a friendly hint when empty.
 */
export function CardRow<T>({
  label,
  items,
  itemKey,
  renderItem,
  description,
  onSeeAll,
  emptyHint,
}: CardRowProps<T>) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-5">
        <div className="flex items-center gap-2">
          <span className="eyebrow">{label}</span>
          <span className="grid min-w-5 place-items-center rounded-full bg-surface-raised px-1.5 font-mono text-[0.62rem] text-ink-muted">
            {items.length}
          </span>
        </div>
        {onSeeAll && items.length > 0 && (
          <button
            type="button"
            onClick={onSeeAll}
            className="press rounded-full px-1 font-mono text-[0.66rem] uppercase tracking-wider text-red outline-none focus-visible:ring-2 focus-visible:ring-red"
          >
            See all
          </button>
        )}
      </div>
      {description && <p className="-mt-2 px-5 text-xs text-ink-muted">{description}</p>}

      {items.length === 0 ? (
        <p className="px-5 text-sm text-ink-muted">{emptyHint}</p>
      ) : (
        <div className="hide-scrollbar flex gap-3 overflow-x-auto px-5 pb-1">
          {items.map((item) => (
            <div key={itemKey(item)} className="w-28 shrink-0">
              {renderItem(item)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
