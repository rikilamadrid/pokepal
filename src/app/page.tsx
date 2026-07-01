import { AppShell } from "@/components/shell/AppShell";

/**
 * App entry. `AppShell` is the client-side navigator that owns the tab state and
 * renders all screens; individual screen content lands in phases 5, 6, 9.
 */
export default function Home() {
  return <AppShell />;
}
