import { Github, PlusCircle } from "lucide-react";
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
import { buildInstallUrl } from "@/src/github/install-url";
import { buildHostedWorkflowYaml } from "@/src/github/hosted-workflow-template";

const CLONE_AND_BUILD = `git clone https://github.com/RamiSmat/primetime.git
cd primetime
npm install
npm run build
gh auth login
codex login`;

function pushSecretCommand(repositoryFullName: string): string {
  return `GH_REPO=${repositoryFullName} node apps/cli/dist/src/bin.js setup codex`;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/");
  }

  const store = getInstallationStore();
  const repositories = await store.listRepositoriesForAccount(user.login);

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${protocol}://${host}` : "";

  let installUrl: string | undefined;
  try {
    installUrl = buildInstallUrl();
  } catch {
    installUrl = undefined;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your repositories</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{user.login}</span>
          </p>
        </div>
        {installUrl ? (
          <a
            href={installUrl}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <PlusCircle className="h-4 w-4" />
            Connect a repository
          </a>
        ) : null}
      </div>

      {repositories.length === 0 ? (
        <Card className="mt-8">
          <CardHeader className="items-center text-center">
            <Github className="mx-auto h-6 w-6 text-muted-foreground" />
            <CardTitle className="mt-2">No repositories connected yet</CardTitle>
            <CardDescription>
              Install the PrimeTime GitHub App on a repository to get started. It only needs
              access to that repository&apos;s secrets — nothing else.
            </CardDescription>
            {installUrl ? (
              <a href={installUrl} className={cn(buttonVariants(), "mt-4")}>
                <PlusCircle className="h-4 w-4" />
                Connect a repository
              </a>
            ) : null}
          </CardHeader>
        </Card>
      ) : (
        <div className="mt-8 flex flex-col gap-6">
          {repositories.map((repositoryFullName) => (
            <Card key={repositoryFullName}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="font-mono text-sm">{repositoryFullName}</CardTitle>
                <Badge variant="success">Connected</Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <CardDescription>
                  Finish setup for this repository with three copy-paste steps, run once from
                  your own machine.
                </CardDescription>
                <Separator />

                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">
                    1. Clone PrimeTime and sign in to Codex locally
                  </p>
                  <p className="text-sm text-muted-foreground">
                    PrimeTime isn&apos;t published as a package yet, so this builds it from
                    source. Only needed once per machine.
                  </p>
                  <CodeBlock code={CLONE_AND_BUILD} />
                </div>

                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">
                    2. Send your Codex session to this repository&apos;s secrets
                  </p>
                  <p className="text-sm text-muted-foreground">
                    This pipes your local <code>auth.json</code> straight to GitHub, encrypted by{" "}
                    <code>gh</code> before it leaves your machine. PrimeTime never sees it.
                  </p>
                  <CodeBlock code={pushSecretCommand(repositoryFullName)} />
                </div>

                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">
                    3. Add the scheduled workflow to this repository
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Save this as{" "}
                    <code>.github/workflows/primetime-codex-primer.yml</code> in{" "}
                    <span className="font-mono">{repositoryFullName}</span>, commit, and push.
                    It primes Codex on a schedule and writes the refreshed session back through
                    this GitHub App — no PAT required.
                  </p>
                  <CodeBlock
                    code={buildHostedWorkflowYaml(origin || "https://your-deployment.example")}
                    className="max-h-96 overflow-y-auto"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
