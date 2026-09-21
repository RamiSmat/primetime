import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/src/auth/current-user";

export async function Nav() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          PrimeTime
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <a
            href="https://github.com/RamiSmat/primetime"
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground"
          >
            Docs
          </a>
          {user ? (
            <>
              <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
                Dashboard
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
      </div>
    </header>
  );
}
