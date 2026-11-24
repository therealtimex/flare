import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flare: AI GTM engine",
  description: "Plain-language intake to cited leads, HITL outreach and pipeline.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
