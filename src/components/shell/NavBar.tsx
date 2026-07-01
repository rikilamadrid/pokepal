import { Pokeball } from "./Pokeball";
import type { Tab } from "./tabs";

interface NavBarProps {
  activeTab: Tab;
  /** Active screen scrolled past ~4px — reveal the hairline bottom border. */
  scrolled: boolean;
  /** Inline title for non-home tabs. */
  title: string;
}

/**
 * Top navigation bar (frosted glass). Home shows the PokéPal wordmark + Pokéball;
 * other tabs show a centered inline title (iOS large-title→inline convention).
 * Gains a hairline bottom border once the active screen is scrolled.
 */
export function NavBar({ activeTab, scrolled, title }: NavBarProps) {
  return (
    <header
      className={`glass pt-safe sticky top-0 z-20 shrink-0 border-b transition-colors duration-200 ${
        scrolled ? "border-border" : "border-transparent"
      }`}
    >
      <div className="flex h-12 items-center justify-center gap-2 px-4">
        {activeTab === "home" ? (
          <>
            <Pokeball className="h-6 w-6 drop-shadow-sm" />
            <span className="font-display text-xl tracking-wide">
              <span className="text-ink">Poké</span>
              <span className="text-red">Pal</span>
            </span>
          </>
        ) : (
          <span className="text-[17px] font-semibold text-ink">{title}</span>
        )}
      </div>
    </header>
  );
}
