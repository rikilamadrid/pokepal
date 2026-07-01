import { House, LayoutGrid, Star, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Pokeball } from "./Pokeball";

interface TabItemProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
}

function TabItem({ icon: Icon, label, active }: TabItemProps) {
  return (
    <button
      type="button"
      className={`press flex flex-col items-center gap-1 py-1 ${
        active ? "text-red" : "text-ink-muted"
      }`}
    >
      <Icon className="h-6 w-6" strokeWidth={active ? 2.4 : 2} />
      <span className="text-[0.62rem] font-medium uppercase tracking-wide">
        {label}
      </span>
    </button>
  );
}

/** Raised center Pokéball puck that opens Scan. Static in phase 1. */
function ScanPuck() {
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        aria-label="Scan a card"
        className="press -mt-6 grid h-14 w-14 place-items-center rounded-full bg-surface shadow-lg ring-4 ring-background"
      >
        <Pokeball className="h-12 w-12" />
      </button>
      <span className="mt-1 text-[0.62rem] font-medium uppercase tracking-wide text-ink-muted">
        Scan
      </span>
    </div>
  );
}

/**
 * Bottom tab bar (frosted glass). Phase 1: static, Home marked active.
 * Real navigation + tap behavior land in phase 4.
 */
export function TabBar() {
  return (
    <nav className="glass pb-safe sticky bottom-0 z-20 shrink-0 border-t border-border/60">
      <div className="grid grid-cols-5 items-end px-2 pt-2">
        <TabItem icon={House} label="Home" active />
        <TabItem icon={LayoutGrid} label="Cards" />
        <ScanPuck />
        <TabItem icon={Star} label="Faves" />
        <TabItem icon={Settings} label="Settings" />
      </div>
    </nav>
  );
}
