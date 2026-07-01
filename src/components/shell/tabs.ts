import { House, LayoutGrid, Star, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Tab = "home" | "collection" | "favorites" | "settings";

export interface TabConfig {
  id: Tab;
  /** Tab bar label. */
  label: string;
  /** Navbar inline title (Home uses the wordmark instead). */
  title: string;
  icon: LucideIcon;
}

/** The four navigable tabs, in tab-bar order (Scan sits between 2 and 3). */
export const TABS: TabConfig[] = [
  { id: "home", label: "Home", title: "PokéPal", icon: House },
  { id: "collection", label: "Cards", title: "Collection", icon: LayoutGrid },
  { id: "favorites", label: "Faves", title: "Favorites", icon: Star },
  { id: "settings", label: "Settings", title: "Settings", icon: Settings },
];
