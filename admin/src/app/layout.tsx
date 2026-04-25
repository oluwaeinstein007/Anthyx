import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anthyx Admin",
  description: "Anthyx platform administration",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
