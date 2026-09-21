import { getInstallationStore } from "@/src/db/store";
import { handleGithubWebhook } from "@/src/github/webhook-handler";

export async function POST(request: Request): Promise<Response> {
  return handleGithubWebhook(request, {
    secret: process.env["GITHUB_APP_WEBHOOK_SECRET"] ?? "",
    store: getInstallationStore(),
  });
}
