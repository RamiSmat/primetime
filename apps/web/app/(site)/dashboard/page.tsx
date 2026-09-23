import { AlertTriangle, Sparkles } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ProviderPicker } from "@/components/provider-picker";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/src/auth/current-user";
import { getInstallationStore } from "@/src/db/store";
import { getWarmupSettingsStore } from "@/src/db/warmup-settings-store";
import { WARMUP_REPO_NAME } from "@/src/github/provision-repo";
import { DEFAULT_SCHEDULE_CONFIG } from "@/src/settings/warmup-settings-handler";

const CREATE_REPO_HREF = "/api/auth/login?intent=provision-repo";
const INSTALL_APP_HREF = "/api/auth/login?intent=install-app";

const WORKFLOW_TEMPLATE_SOURCE_URL =
  "https://github.com/RamiSmat/primetime/blob/main/templates/github-actions";

const ERROR_COPY: Record<string, { title: string; body: string }> = {
  not_installed: {
    title: "PrimeTime isn't installed on your account yet",
    body: "Install it on GitHub first — that's a one-time step per account — then come back and create your warmup repository.",
  },
  needs_all_repos: {
    title: "PrimeTime needs access to all repositories",
    body: "Your installation is set to \"Only select repositories,\" but there's nothing to select yet since PrimeTime creates a brand-new one. Open the installation's settings on GitHub, switch access to \"All repositories,\" then try again.",
  },
  provision_failed: {
    title: "Couldn't connect your warmup repository",
    body: "Something went wrong on PrimeTime's end recording the repository. Try again in a moment.",
  },
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/");
  }

  const params = await searchParams;
  const errorKey = typeof params["error"] === "string" ? params["error"] : undefined;
  const installationId = typeof params["installationId"] === "string" ? params["installationId"] : undefined;
  const error = errorKey ? ERROR_COPY[errorKey] : undefined;

  const store = getInstallationStore();
  const repositories = await store.listRepositoriesForAccount(user.login);
  const warmupSettings = await getWarmupSettingsStore().getSettings(user.login);
  const scheduleConfig = warmupSettings?.scheduleConfig ?? DEFAULT_SCHEDULE_CONFIG;
  // With "All repositories" access, the installation (and so this list)
  // covers every repo the account has — not just the one PrimeTime
  // created — so pick out the dedicated warmup repo by name rather than
  // grabbing an arbitrary entry.
  const warmupRepoSuffix = `/${WARMUP_REPO_NAME}`.toLowerCase();
  const warmupRepo = repositories.find((repo) => repo.toLowerCase().endsWith(warmupRepoSuffix));

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${protocol}://${host}` : "https://your-deployment.example";

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Setup</h1>
        <a href="/dashboard/settings" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Warmup schedule
        </a>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Signed in as <span className="font-medium text-foreground">{user.login}</span>
      </p>

      {error ? (
        <Card variant="warning" className="mt-6">
          <CardHeader className="flex-row items-start gap-3 space-y-0">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div>
              <CardTitle>{error.title}</CardTitle>
              <CardDescription className="mt-1">{error.body}</CardDescription>
              {errorKey === "needs_all_repos" && installationId ? (
                <a
                  href={`https://github.com/settings/installations/${installationId}`}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3")}
                >
                  Open installation settings
                </a>
              ) : null}
              {errorKey === "not_installed" ? (
                <a href={INSTALL_APP_HREF} className={cn(buttonVariants({ size: "sm" }), "mt-3")}>
                  Install PrimeTime on GitHub
                </a>
              ) : null}
            </div>
          </CardHeader>
        </Card>
      ) : null}

      {!warmupRepo ? (
        <Card className="mt-6">
          <CardHeader className="items-center text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ember/10 text-ember">
              <Sparkles className="h-6 w-6" />
            </span>
            <CardTitle className="mt-2">Create your AI warmup repository</CardTitle>
            <CardDescription className="max-w-sm">
              One click connects PrimeTime to a small private repository dedicated to warming
              up your AI coding CLI (the setup script creates it locally). First time on this
              account? You&apos;ll be asked to install PrimeTime first — after that, this button
              just works.
            </CardDescription>
            <a href={CREATE_REPO_HREF} className={cn(buttonVariants(), "mt-4")}>
              <Sparkles className="h-4 w-4" />
              Create my warmup repository
            </a>
            <p className="mt-3 max-w-sm text-xs text-muted-foreground">
              If prompted to install, choose &ldquo;All repositories&rdquo; access — that&apos;s
              what lets the repository the setup script creates be covered by PrimeTime
              automatically.
            </p>
          </CardHeader>
        </Card>
      ) : (
        <Card className="mt-6">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="font-mono text-sm">{warmupRepo}</CardTitle>
            <Badge variant="success">Ready</Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <CardDescription>
              Run this once on your own machine, for your platform below. It&apos;s a plain,
              reviewable script — it announces every step it takes, and it&apos;s safe to run
              again later.
            </CardDescription>
            <ProviderPicker
              repositoryFullName={warmupRepo}
              primeTimeWebUrl={origin}
              scheduleConfig={scheduleConfig}
            />

            <Separator />

            <a
              href={WORKFLOW_TEMPLATE_SOURCE_URL}
              target="_blank"
              rel="noreferrer"
              className="w-fit text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              See the workflow templates it adds
            </a>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
