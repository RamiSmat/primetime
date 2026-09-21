import { AlertTriangle, Sparkles } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { CodeBlock } from "@/components/code-block";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/src/auth/current-user";
import { getInstallationStore } from "@/src/db/store";
import { buildHostedWorkflowYaml } from "@/src/github/hosted-workflow-template";

const CREATE_REPO_HREF = "/api/auth/login?intent=provision-repo";

const CLONE_AND_LOGIN = `git clone https://github.com/RamiSmat/primetime.git
cd primetime
npm install && npm run build
gh auth login
codex login`;

function pushSecretCommand(repositoryFullName: string): string {
  return `GH_REPO=${repositoryFullName} node apps/cli/dist/src/bin.js setup codex`;
}

const ERROR_COPY: Record<string, { title: string; body: string }> = {
  not_installed: {
    title: "Installation didn't complete",
    body: "GitHub didn't report an installation of PrimeTime for your account. Try again, and make sure to finish the install step.",
  },
  needs_all_repos: {
    title: "PrimeTime needs access to all repositories",
    body: "Your installation is set to \"Only select repositories,\" but there's nothing to select yet since PrimeTime creates a brand-new one. Open the installation's settings on GitHub, switch access to \"All repositories,\" then try again.",
  },
  provision_failed: {
    title: "Couldn't create your warmup repository",
    body: "Something went wrong talking to GitHub. Try again in a moment.",
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
  const warmupRepo = repositories[0];

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${protocol}://${host}` : "https://your-deployment.example";

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Signed in as <span className="font-medium text-foreground">{user.login}</span>
      </p>

      {error ? (
        <Card className="mt-6 border-amber-500/40">
          <CardHeader className="flex-row items-start gap-3 space-y-0">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
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
            </div>
          </CardHeader>
        </Card>
      ) : null}

      {!warmupRepo ? (
        <Card className="mt-6">
          <CardHeader className="items-center text-center">
            <Sparkles className="mx-auto h-6 w-6 text-muted-foreground" />
            <CardTitle className="mt-2">Create your AI warmup repository</CardTitle>
            <CardDescription className="max-w-sm">
              One click creates a small private repository dedicated to warming up your AI
              coding CLI — install PrimeTime and create it in one step.
            </CardDescription>
            <a href={CREATE_REPO_HREF} className={cn(buttonVariants(), "mt-4")}>
              <Sparkles className="h-4 w-4" />
              Create my warmup repository
            </a>
            <p className="mt-3 max-w-sm text-xs text-muted-foreground">
              If prompted during install, choose &ldquo;All repositories&rdquo; access — that&apos;s
              what lets PrimeTime create the new repo for you automatically.
            </p>
          </CardHeader>
        </Card>
      ) : (
        <Card className="mt-6">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="font-mono text-sm">{warmupRepo}</CardTitle>
            <Badge variant="success">Ready</Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <CardDescription>
              Finish setup locally, once — this hands your Codex session directly to this
              repository&apos;s GitHub secrets. PrimeTime never sees it.
            </CardDescription>
            <Separator />

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">1. Clone PrimeTime and sign in</p>
              <CodeBlock code={CLONE_AND_LOGIN} />
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">2. Send your Codex session to the repo</p>
              <CodeBlock code={pushSecretCommand(warmupRepo)} />
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">
                3. Save as <code>.github/workflows/primetime-codex-primer.yml</code> in{" "}
                {warmupRepo}, then commit and push
              </p>
              <CodeBlock
                code={buildHostedWorkflowYaml(origin)}
                className="max-h-72 overflow-y-auto"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
