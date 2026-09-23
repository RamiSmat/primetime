import { redirect } from "next/navigation";

import { WarmupSettingsForm } from "@/components/warmup-settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/src/auth/current-user";
import { getWarmupSettingsStore } from "@/src/db/warmup-settings-store";
import {
  DEFAULT_SCHEDULE_CONFIG,
  DEFAULT_SUBSCRIPTION_COUNTS,
} from "@/src/settings/warmup-settings-handler";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/");
  }

  const record = await getWarmupSettingsStore().getSettings(user.login);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Warmup schedule</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        PrimeTime uses this to decide when to run your primer — before work starts, and again
        before each dead-time window ends.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Your schedule</CardTitle>
          <CardDescription>
            Saved settings are picked up the next time you copy the setup command on the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WarmupSettingsForm
            initialScheduleConfig={record?.scheduleConfig ?? DEFAULT_SCHEDULE_CONFIG}
            initialSubscriptionCounts={record?.subscriptionCounts ?? DEFAULT_SUBSCRIPTION_COUNTS}
          />
        </CardContent>
      </Card>
    </main>
  );
}
