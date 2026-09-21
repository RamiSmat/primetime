import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/src/auth/current-user";

export async function Nav() {
  const user = await getCurrentUser();

  return (
    <div className="sticky top-4 z-50 px-4 sm:px-6">
      <header className="mx-auto flex h-14 max-w-3xl items-center justify-between rounded-2xl border border-border/70 bg-card/85 px-4 shadow-lg shadow-foreground/[0.04] backdrop-blur-md supports-[backdrop-filter]:bg-card/70">
        <Link href="/" className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-2 w-2 rounded-full bg-ember shadow-[0_0_12px_2px_rgba(255,90,31,0.55)]"
          />
          <span className="text-base font-semibold tracking-tight">PrimeTime</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/docs" className="text-muted-foreground hover:text-foreground">
            Docs
          </Link>
          {user ? (
            <>
              <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
                Setup
              </Link>
              <form action="/api/auth/logout" method="post">
                <Button type="submit" variant="outline" size="sm">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <a href="/api/auth/login" className={cn(buttonVariants({ size: "sm" }))}>
              Sign in with GitHub
            </a>
          )}
        </nav>
      </header>
    </div>
  );
}
