import { Pokeball } from "./Pokeball";

/**
 * Top navigation bar (frosted glass). Phase 1: static, Home mode only —
 * wordmark + Pokéball. Title modes + scroll-aware border land in phase 4.
 */
export function NavBar() {
  return (
    <header className="glass pt-safe sticky top-0 z-20 shrink-0 border-b border-transparent">
      <div className="flex h-12 items-center justify-center gap-2 px-4">
        <Pokeball className="h-6 w-6 drop-shadow-sm" />
        <span className="font-display text-xl tracking-wide">
          <span className="text-ink">Poké</span>
          <span className="text-red">Pal</span>
        </span>
      </div>
    </header>
  );
}
