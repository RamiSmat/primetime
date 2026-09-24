import type { ReactNode } from "react";

import { Nav } from "@/components/nav";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      {children}
    </div>
  );
}
