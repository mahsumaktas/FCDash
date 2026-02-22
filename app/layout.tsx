import type { Metadata } from "next";
import { LayoutShell } from "@/components/layout/layout-shell";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "FCDash",
  description: "Full Control Dashboard for OpenClaw",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="antialiased">
        <LayoutShell>{children}</LayoutShell>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
