import type { ReactNode } from "react";

import { Nav } from "@/components/nav";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Nav />
      {children}
    </>
  );
}
