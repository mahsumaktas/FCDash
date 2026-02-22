"use client";

import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { AppSidebar } from "./app-sidebar";
import { AppHeader } from "./app-header";
import { Providers } from "../providers";
import { CommandPalette } from "./command-palette";

// Lazy load — keyboard shortcuts modal ender açılıyor (?+K ile)
const KeyboardShortcutsModal = dynamic(
  () => import("../chat/keyboard-shortcuts-modal").then((m) => ({ default: m.KeyboardShortcutsModal })),
);

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  // Login page: render without Providers, sidebar, command palette
  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <Providers>
      <div className="flex h-screen overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <AppHeader />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
      <CommandPalette />
      <KeyboardShortcutsModal />
    </Providers>
  );
}
