import type { LucideIcon } from "lucide-react";
import { Pokeball } from "./Pokeball";
import { TABS, type Tab } from "./tabs";

interface TabItemProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}

function TabItem({ icon: Icon, label, active, onClick }: TabItemProps) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={`press flex flex-col items-center gap-1 rounded-lg py-1 outline-none focus-visible:ring-2 focus-visible:ring-red ${
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

/** Raised center Pokéball puck that opens the Scan modal (never marked active). */
function ScanPuck({ onScan }: { onScan: () => void }) {
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        aria-label="Scan a card"
        onClick={onScan}
        className="press -mt-6 grid h-14 w-14 place-items-center rounded-full bg-surface shadow-lg outline-none ring-4 ring-background focus-visible:ring-red"
      >
        <Pokeball className="h-12 w-12" />
      </button>
      <span className="mt-1 text-[0.62rem] font-medium uppercase tracking-wide text-ink-muted">
        Scan
      </span>
    </div>
  );
}

interface TabBarProps {
  activeTab: Tab;
  onSelect: (tab: Tab) => void;
  onScan: () => void;
}

/**
 * Bottom tab bar (frosted glass). Tabs switch the active screen (tapping the
 * active tab scrolls it to top); the center Scan puck opens the Scan modal.
 */
export function TabBar({ activeTab, onSelect, onScan }: TabBarProps) {
  const [home, collection, favorites, settings] = TABS;
  return (
    <nav className="glass pb-safe sticky bottom-0 z-20 shrink-0 border-t border-border/60">
      <div className="grid grid-cols-5 items-end px-2 pt-2">
        {[home, collection].map((t) => (
          <TabItem
            key={t.id}
            icon={t.icon}
            label={t.label}
            active={activeTab === t.id}
            onClick={() => onSelect(t.id)}
          />
        ))}
        <ScanPuck onScan={onScan} />
        {[favorites, settings].map((t) => (
          <TabItem
            key={t.id}
            icon={t.icon}
            label={t.label}
            active={activeTab === t.id}
            onClick={() => onSelect(t.id)}
          />
        ))}
      </div>
    </nav>
  );
}
