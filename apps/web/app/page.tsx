import { ArrowRight, Github, ShieldCheck, Timer } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/src/auth/current-user";

const STEPS = [
  {
    title: "Sign in and create your warmup repository",
    body: "Sign in with GitHub, then click one button. PrimeTime installs itself and creates a small, private repository dedicated to warming up your AI coding CLI — no picking through your existing projects.",
  },
  {
    title: "Hand off your provider session once, locally",
    body: "Run the PrimeTime CLI on your own machine after logging into Codex (or another supported provider). It reads your local session and stores it directly in that repository's GitHub Actions secrets — it never passes through PrimeTime's servers.",
  },
  {
    title: "Copy one workflow file in, on a schedule",
    body: "Copy the provided GitHub Actions workflow into .github/workflows/. It runs on your schedule, sends one lightweight primer request through the official provider CLI, and writes the refreshed session back to your own secrets.",
  },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  const primaryCta = user
    ? { href: "/dashboard", label: "Go to dashboard" }
    : { href: "/api/auth/login", label: "Sign in with GitHub" };

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <section className="relative flex flex-col gap-4">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-ember/15 blur-3xl"
        />
        <Badge variant="muted" className="w-fit">
          Early-stage, open source
        </Badge>
        <h1 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">
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
          <a
            href="https://github.com/RamiSmat/primetime#readme"
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            Read the docs
          </a>
        </div>
      </section>

      <section className="mt-16 flex flex-col gap-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          How it works
        </h2>
        <div className="relative flex flex-col gap-3">
          <div aria-hidden className="absolute left-[2.375rem] top-8 bottom-8 w-px bg-border" />
          {STEPS.map((step, index) => (
            <Card key={step.title} className="relative">
              <CardHeader className="flex-row items-start gap-4 space-y-0">
                <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ember text-sm font-medium text-ember-foreground">
                  {index + 1}
                </span>
                <div className="flex flex-col gap-1.5">
                  <CardTitle>{step.title}</CardTitle>
                  <CardDescription>{step.body}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ember/10 text-ember">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <CardTitle className="mt-2">Your credentials never touch PrimeTime</CardTitle>
            <CardDescription>
              Provider sessions live only in your own GitHub Actions secrets. PrimeTime&apos;s
              backend mints short-lived, repository-scoped GitHub tokens — it never receives,
              stores, or logs a Codex, Claude, or other provider credential.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ember/10 text-ember">
              <Timer className="h-5 w-5" />
            </span>
            <CardTitle className="mt-2">Runs on your schedule</CardTitle>
            <CardDescription>
              A timezone- and DST-aware scheduler figures out exactly when your primer should
              fire, based on your normal work hours and how much lead time your provider needs.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>

      <section className="mt-12 flex items-center justify-between rounded-2xl border border-border bg-muted px-6 py-4">
        <p className="text-sm text-muted-foreground">
          Prefer a fully self-hosted setup with no backend in your trust chain at all?
        </p>
        <Link
          href="https://github.com/RamiSmat/primetime#readme"
          target="_blank"
          className="flex items-center gap-1 text-sm font-medium hover:underline"
        >
          Self-host instructions
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>
    </main>
  );
}
