import { getInstallationStore } from "@/src/db/store";
import { handleActionsTokenRequest } from "@/src/actions/token-handler";

function decodePrivateKey(): string {
  const encoded = process.env["GITHUB_APP_PRIVATE_KEY_BASE64"];
  if (!encoded) {
    throw new Error("GITHUB_APP_PRIVATE_KEY_BASE64 is not set.");
  }
  return Buffer.from(encoded, "base64").toString("utf8");
}

export async function POST(request: Request): Promise<Response> {
  return handleActionsTokenRequest(request, {
    audience: process.env["OIDC_AUDIENCE"] ?? "",
    appId: process.env["GITHUB_APP_ID"] ?? "",
    privateKey: decodePrivateKey(),
    store: getInstallationStore(),
  });
}
