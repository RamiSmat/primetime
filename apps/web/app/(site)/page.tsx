import { Github } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/src/auth/current-user";

export default async function HomePage() {
  const user = await getCurrentUser();
  const primaryCta = user
    ? { href: "/dashboard", label: "Go to setup" }
    : { href: "/api/auth/login", label: "Sign in with GitHub" };

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <section className="relative flex flex-col gap-4">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-ember/15 blur-3xl"
        />
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Keep your AI coding CLI warm before you sit down to code.
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
          PrimeTime schedules a lightweight &ldquo;primer&rdquo; request for Claude Code, Codex,
          and other AI coding CLIs, so your provider&apos;s usage window has already started by
          the time your normal coding session begins.
        </p>
        <div className="flex items-center gap-3 pt-2">
          <a href={primaryCta.href} className={cn(buttonVariants({ size: "lg" }))}>
            <Github className="h-4 w-4" />
            {primaryCta.label}
          </a>
          <a href="/docs" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            Read the docs
          </a>
        </div>
      </section>
    </main>
  );
}
