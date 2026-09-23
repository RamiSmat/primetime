import { getCurrentUser } from "@/src/auth/current-user";
import { getWarmupSettingsStore } from "@/src/db/warmup-settings-store";
import { handleGetWarmupSettings, handleSaveWarmupSettings } from "@/src/settings/warmup-settings-handler";

export async function GET(): Promise<Response> {
  return handleGetWarmupSettings({
    user: await getCurrentUser(),
    store: getWarmupSettingsStore(),
  });
}

export async function PUT(request: Request): Promise<Response> {
  return handleSaveWarmupSettings(request, {
    user: await getCurrentUser(),
    store: getWarmupSettingsStore(),
  });
}
