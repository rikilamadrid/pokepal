import { AppShell } from "@/components/shell/AppShell";

/** A static placeholder tile for the display-only phase-1 shell. */
function PlaceholderTile({ className = "" }: { className?: string }) {
  return (
    <div
      className={`aspect-[3/4] shrink-0 rounded-2xl border border-border bg-surface-raised ${className}`}
    />
  );
}

/**
 * Phase 1 Home screen — display only. Validates navbar/tab-bar spacing, scroll,
 * and safe areas with placeholder content. Real content lands in phase 5.
 */
export default function Home() {
  return (
    <AppShell>
      <div className="flex flex-col gap-8 px-5 pb-8 pt-5">
        {/* Latest catch (hero placeholder) */}
        <section className="flex flex-col gap-3">
          <p className="eyebrow">Latest Catch</p>
          <PlaceholderTile className="mx-auto w-52" />
        </section>

        {/* Favorites row (placeholder) */}
        <section className="flex flex-col gap-3">
          <p className="eyebrow">Favorites</p>
          <div className="flex gap-3 overflow-x-auto">
            <PlaceholderTile className="w-28" />
            <PlaceholderTile className="w-28" />
            <PlaceholderTile className="w-28" />
          </div>
        </section>

        {/* Duplicates row (placeholder) */}
        <section className="flex flex-col gap-3">
          <p className="eyebrow">Duplicates</p>
          <div className="flex gap-3 overflow-x-auto">
            <PlaceholderTile className="w-28" />
            <PlaceholderTile className="w-28" />
            <PlaceholderTile className="w-28" />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
