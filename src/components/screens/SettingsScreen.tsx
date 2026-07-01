"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useCollection } from "@/hooks/useCollection";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useSync } from "@/hooks/useSync";
import { relativeTime } from "@/lib/date";
import { Switch } from "@/components/ui/switch";
import {
  SettingsGroup,
  SettingsRow,
  SettingsStat,
} from "@/components/settings/SettingsList";
import { ReleaseAllDialog } from "@/components/settings/ReleaseAllDialog";
import { SignInSheet } from "@/components/settings/SignInSheet";

/**
 * Settings screen: account stub, dark-mode toggle, live collection stats, and the
 * destructive release-entire-collection action (confirmed via dialog). Grouped,
 * inset iOS list styling.
 */
export function SettingsScreen() {
  const { cards, ready, releaseAll } = useCollection();
  const { theme, toggle } = useTheme();
  const { configured, ready: authReady, user, signOut } = useAuth();
  const sync = useSync();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

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

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out. Your cards stay on this device.");
    } catch {
      toast.error("Couldn’t sign out. Try again.");
    }
  };

  const renderSyncRow = () => {
    if (!sync.enabled) return null;
    if (sync.status === "syncing") {
      return <SettingsRow title="Backing up" subtitle="Syncing…" />;
    }
    if (sync.status === "offline") {
      return (
        <SettingsRow
          title="Offline"
          subtitle="Your cards will back up when you reconnect."
        />
      );
    }
    if (sync.status === "error") {
      return (
        <SettingsRow
          title="Backup paused"
          subtitle="Tap to retry."
          onClick={sync.syncNow}
        />
      );
    }
    return (
      <SettingsRow
        title="Backed up"
        subtitle={
          sync.lastSyncedAt
            ? `Last synced ${relativeTime(sync.lastSyncedAt)}`
            : "Your cards are safe in the cloud."
        }
        onClick={sync.syncNow}
      />
    );
  };

  const renderAccountRow = () => {
    if (!configured) {
      return (
        <SettingsRow
          title="Cloud backup unavailable"
          subtitle="Sign-in isn’t set up yet — your cards are saved on this device."
        />
      );
    }
    if (!authReady) {
      return <SettingsRow title="Account" subtitle="Checking…" />;
    }
    if (user) {
      return (
        <SettingsRow
          title="Sign out"
          subtitle={user.email ?? "Signed in"}
          onClick={handleSignOut}
        />
      );
    }
    return (
      <SettingsRow
        title="Sign in to back up your cards"
        subtitle="Keep your collection safe across devices."
        onClick={() => setSignInOpen(true)}
      />
    );
  };

  return (
    <div className="flex flex-col gap-6 px-5 pb-8 pt-5">
      <h1 className="font-display text-3xl tracking-wide text-ink">Settings</h1>

      <SettingsGroup label="Account">
        {renderAccountRow()}
        {renderSyncRow()}
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

      <SignInSheet open={signInOpen} onOpenChange={setSignInOpen} />
    </div>
  );
}
