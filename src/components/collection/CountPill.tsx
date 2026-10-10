/** Small count pill shown next to a section's eyebrow label. */
export function CountPill({ count }: { count: number }) {
  return (
    <span className="grid min-w-5 place-items-center rounded-full bg-surface-raised px-1.5 font-mono text-[0.62rem] text-ink-muted">
      {count}
    </span>
  );
}
