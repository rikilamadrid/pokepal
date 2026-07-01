"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { NavBar } from "./NavBar";
import { TabBar } from "./TabBar";
import { TABS, type Tab } from "./tabs";
import { HomeScreen } from "@/components/screens/HomeScreen";
import { CollectionScreen } from "@/components/screens/CollectionScreen";
import { PlaceholderScreen } from "@/components/screens/PlaceholderScreen";
import type { Card } from "@/types/card";

// Lazy-loaded: the detail sheet isn't needed on first paint.
const CardDetailSheet = dynamic(
  () => import("@/components/card/CardDetailSheet").then((m) => m.CardDetailSheet),
  { ssr: false },
);

// Lazy-loaded: the camera stack must stay out of the initial bundle.
const ScanSheet = dynamic(
  () => import("@/components/scan/ScanSheet").then((m) => m.ScanSheet),
  { ssr: false },
);

/**
 * Fixed, phone-shaped app frame and client-side navigator. Owns the active tab,
 * the Scan modal, and the scroll-aware navbar border. All four screens stay
 * mounted and cross-fade; only the active one is visible + interactive.
 */
export function AppShell() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [scanOpen, setScanOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const screenRefs = useRef<Partial<Record<Tab, HTMLDivElement | null>>>({});

  const openCard = useCallback((card: Card) => setSelectedCardId(card.id), []);
  const closeCard = useCallback(() => setSelectedCardId(null), []);

  const selectTab = useCallback(
    (tab: Tab) => {
      setActiveTab((current) => {
        if (tab === current) {
          // tapping the active tab scrolls it back to top
          screenRefs.current[tab]?.scrollTo({ top: 0, behavior: "smooth" });
          return current;
        }
        // sync the border to the newly active screen's scroll position
        setScrolled((screenRefs.current[tab]?.scrollTop ?? 0) > 4);
        return tab;
      });
    },
    [],
  );

  const handleScroll = (tab: Tab) => (e: React.UIEvent<HTMLDivElement>) => {
    if (tab === activeTab) setScrolled(e.currentTarget.scrollTop > 4);
  };

  const activeTitle = TABS.find((t) => t.id === activeTab)?.title ?? "";

  const screens: Record<Tab, React.ReactNode> = {
    home: (
      <HomeScreen
        onSelectCard={openCard}
        onSeeAllFavorites={() => selectTab("favorites")}
      />
    ),
    collection: <CollectionScreen onSelectCard={openCard} />,
    favorites: (
      <PlaceholderScreen title="Favorites" note="Starred cards — phase 9" />
    ),
    settings: (
      <PlaceholderScreen title="Settings" note="Account, theme, stats — phase 9" />
    ),
  };

  return (
    <div className="fixed inset-0 flex justify-center bg-black">
      <div className="relative flex h-full w-full max-w-[480px] flex-col overflow-hidden bg-background">
        <NavBar activeTab={activeTab} scrolled={scrolled} title={activeTitle} />

        <main className="relative flex-1 overflow-hidden">
          {TABS.map((t) => {
            const isActive = t.id === activeTab;
            return (
              <div
                key={t.id}
                ref={(el) => {
                  screenRefs.current[t.id] = el;
                }}
                className="screen"
                data-active={isActive}
                aria-hidden={!isActive}
                onScroll={handleScroll(t.id)}
              >
                {screens[t.id]}
              </div>
            );
          })}
        </main>

        <TabBar
          activeTab={activeTab}
          onSelect={selectTab}
          onScan={() => setScanOpen(true)}
        />
      </div>

      {scanOpen && <ScanSheet onClose={() => setScanOpen(false)} />}
      {selectedCardId && (
        <CardDetailSheet cardId={selectedCardId} onClose={closeCard} />
      )}
    </div>
  );
}
