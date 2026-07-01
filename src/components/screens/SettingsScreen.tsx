"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useCollection } from "@/hooks/useCollection";
import { useTheme } from "@/hooks/useTheme";
import { Switch } from "@/components/ui/switch";
import {
  SettingsGroup,
  SettingsRow,
  SettingsStat,
} from "@/components/settings/SettingsList";
import { ReleaseAllDialog } from "@/components/settings/ReleaseAllDialog";

/**
 * Settings screen: account stub, dark-mode toggle, live collection stats, and the
 * destructive release-entire-collection action (confirmed via dialog). Grouped,
 * inset iOS list styling.
 */
export function SettingsScreen() {
  const { cards, ready, releaseAll } = useCollection();
  const { theme, toggle } = useTheme();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const uniqueSpecies = useMemo(
    () => new Set(cards.map((c) => c.dexNo)).size,
    [cards],
  );

  if (!ready) return null;

  const handleReleaseAll = () => {
    releaseAll();
    setConfirmOpen(false);
    toast.success("Collection released.");
  };

  return (
    <div className="flex flex-col gap-6 px-5 pb-8 pt-5">
      <h1 className="font-display text-3xl tracking-wide text-ink">Settings</h1>

      <SettingsGroup label="Account">
        <SettingsRow
          title="Sign in to back up your cards"
          subtitle="Coming soon — keep your collection safe across devices."
        />
      </SettingsGroup>

      <SettingsGroup label="Appearance">
        <SettingsRow
          title="Dark mode"
          trailing={
            <Switch
              checked={theme === "dark"}
              onCheckedChange={toggle}
              aria-label="Dark mode"
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup label="Collection">
        <SettingsRow
          title="Total caught"
          trailing={<SettingsStat value={cards.length} />}
        />
        <SettingsRow
          title="Unique species"
          trailing={<SettingsStat value={uniqueSpecies} />}
        />
        <SettingsRow
          title="Release entire collection"
          destructive
          disabled={cards.length === 0}
          onClick={() => setConfirmOpen(true)}
        />
      </SettingsGroup>

      <ReleaseAllDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleReleaseAll}
        count={cards.length}
      />
    </div>
  );
}
