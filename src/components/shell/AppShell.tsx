import { NavBar } from "./NavBar";
import { TabBar } from "./TabBar";

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Fixed, phone-shaped app frame: navbar / scrollable screen area / tab bar.
 * On desktop it centers in a max-width column with dark gutters.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="fixed inset-0 flex justify-center bg-black">
      <div className="relative flex h-full w-full max-w-[480px] flex-col overflow-hidden bg-background">
        <NavBar />
        <main className="relative flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
        <TabBar />
      </div>
    </div>
  );
}
