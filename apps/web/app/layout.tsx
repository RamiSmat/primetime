import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Nav } from "@/components/nav";
import { fontDisplay } from "@/lib/fonts";

import "./globals.css";

export const metadata: Metadata = {
  title: "PrimeTime",
  description: "Schedule lightweight primer requests for AI coding tool CLIs.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontDisplay.variable}>
      <body className="min-h-screen font-sans antialiased">
        <Nav />
        {children}
      </body>
    </html>
  );
}
