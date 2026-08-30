import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aether Forge",
  description: "Audit trail and HITL dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <a href="/" className="brand">
            Aether Forge
          </a>
          <span className="muted">runs · audit · approval</span>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
