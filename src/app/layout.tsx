import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { AppShell } from "@/components/shell/app-shell";
import "../../design-system/tokens.css";
import "../../design-system/components/bundle.css";
import "./globals.css";

const display = Newsreader({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-newsreader", display: "swap" });
const sans = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Flare: AI GTM engine",
  description: "Plain-language intake to cited leads, HITL outreach and pipeline.",
  icons: { icon: "/brand/flare-mark-reverse.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
