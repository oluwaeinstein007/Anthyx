import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    default: "Anthyx — Autonomous AI Marketing",
    template: "%s | Anthyx",
  },
  description:
    "Multi-agent autonomous marketing platform. Ingest your brand, generate content, schedule and publish across every social platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
