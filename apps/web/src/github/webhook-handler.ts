import { verifyWebhookSignature } from "@primetime/github-app";

import type { InstallationStore } from "../db/store";

export interface HandleGithubWebhookOptions {
  readonly secret: string;
  readonly store: InstallationStore;
}

interface RepositoryPayload {
  readonly full_name: string;
}

interface InstallationPayload {
  readonly id: number;
  readonly account: { readonly login: string };
}

interface InstallationEventBody {
  readonly action: string;
  readonly installation: InstallationPayload;
  readonly repositories?: readonly RepositoryPayload[];
}

interface InstallationRepositoriesEventBody {
  readonly action: string;
  readonly installation: InstallationPayload;
  readonly repositories_added?: readonly RepositoryPayload[];
  readonly repositories_removed?: readonly RepositoryPayload[];
}

const INSTALLATION_UPSERT_ACTIONS = new Set(["created", "unsuspend", "new_permissions_accepted"]);

/**
 * Handles `installation` and `installation_repositories` webhook
 * deliveries, keeping the `InstallationStore` in sync. The raw body is
 * verified against the webhook secret before it is parsed as JSON — never
 * the other way around, since re-serializing JSON can change the signed
 * bytes.
 */
export async function handleGithubWebhook(
  request: Request,
  options: HandleGithubWebhookOptions,
): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyWebhookSignature(rawBody, signature, options.secret)) {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }

  const event = request.headers.get("x-github-event");
  if (event === "installation") {
    await handleInstallationEvent(body as InstallationEventBody, options.store);
  } else if (event === "installation_repositories") {
    await handleInstallationRepositoriesEvent(
      body as InstallationRepositoriesEventBody,
      options.store,
    );
  }

  return Response.json({ ok: true });
}

async function handleInstallationEvent(
  body: InstallationEventBody,
  store: InstallationStore,
): Promise<void> {
  if (body.action === "deleted") {
    await store.removeInstallation(body.installation.id);
    return;
  }

  if (INSTALLATION_UPSERT_ACTIONS.has(body.action)) {
    await store.upsertInstallation({
      installationId: body.installation.id,
      accountLogin: body.installation.account.login,
    });
    if (body.repositories) {
      await store.setRepositories(
        body.installation.id,
        body.repositories.map((repository) => repository.full_name),
      );
    }
  }
}

async function handleInstallationRepositoriesEvent(
  body: InstallationRepositoriesEventBody,
  store: InstallationStore,
): Promise<void> {
  await store.upsertInstallation({
    installationId: body.installation.id,
    accountLogin: body.installation.account.login,
  });

  if (body.repositories_added && body.repositories_added.length > 0) {
    await store.addRepositories(
      body.installation.id,
      body.repositories_added.map((repository) => repository.full_name),
    );
  }

  if (body.repositories_removed && body.repositories_removed.length > 0) {
    await store.removeRepositories(
      body.installation.id,
      body.repositories_removed.map((repository) => repository.full_name),
    );
  }
}
