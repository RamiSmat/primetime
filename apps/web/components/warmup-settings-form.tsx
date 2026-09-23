"use client";

import { type FormEvent, useState } from "react";

import {
  parseScheduleConfig,
  WEEKDAYS,
  type DeadTimeWindow,
  type ScheduleConfig,
  type Weekday,
} from "@primetime/scheduler";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AVAILABLE_PROVIDERS } from "@/lib/providers";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS: Record<Weekday, string> = {
  sunday: "Sun",
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
};

type SaveStatus =
  | { readonly kind: "idle" | "saving" | "saved" }
  | { readonly kind: "error"; readonly message: string };

export function WarmupSettingsForm({
  initialScheduleConfig,
  initialSubscriptionCounts,
}: {
  readonly initialScheduleConfig: ScheduleConfig;
  readonly initialSubscriptionCounts: Readonly<Record<string, number>>;
}) {
  const [timeZone, setTimeZone] = useState(initialScheduleConfig.timeZone);
  const [workStartTime, setWorkStartTime] = useState(initialScheduleConfig.workStartTime);
  const [leadTimeMinutes, setLeadTimeMinutes] = useState(
    String(initialScheduleConfig.leadTimeMinutes),
  );
  const [activeWeekdays, setActiveWeekdays] = useState<readonly Weekday[]>(
    initialScheduleConfig.activeWeekdays,
  );
  const [deadTimeWindows, setDeadTimeWindows] = useState<readonly DeadTimeWindow[]>(
    initialScheduleConfig.deadTimeWindows,
  );
  const [subscriptionCounts, setSubscriptionCounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      AVAILABLE_PROVIDERS.map((provider) => [
        provider.id,
        String(initialSubscriptionCounts[provider.id] ?? 1),
      ]),
    ),
  );
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });

  function toggleWeekday(weekday: Weekday) {
    setActiveWeekdays((current) => {
      const isActive = current.includes(weekday);
      if (isActive) {
        // Refuse to deactivate the last remaining weekday — a schedule
        // needs at least one active day to mean anything.
        return current.length === 1 ? current : current.filter((day) => day !== weekday);
      }
      return [...current, weekday];
    });
  }

  function addDeadTimeWindow() {
    setDeadTimeWindows((current) => [...current, { startTime: "12:00", endTime: "13:00" }]);
  }

  function removeDeadTimeWindow(index: number) {
    setDeadTimeWindows((current) => current.filter((_, i) => i !== index));
  }

  function updateDeadTimeWindow(index: number, field: "startTime" | "endTime", value: string) {
    setDeadTimeWindows((current) =>
      current.map((window, i) => (i === index ? { ...window, [field]: value } : window)),
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    let scheduleConfig: ScheduleConfig;
    try {
      scheduleConfig = parseScheduleConfig({
        timeZone,
        workStartTime,
        leadTimeMinutes: Number(leadTimeMinutes),
        activeWeekdays,
        deadTimeWindows,
      });
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Invalid schedule." });
      return;
    }

    const parsedSubscriptionCounts: Record<string, number> = {};
    for (const [providerId, value] of Object.entries(subscriptionCounts)) {
      const count = Number(value);
      if (!Number.isInteger(count) || count < 0) {
        setStatus({
          kind: "error",
          message: `Subscription count for ${providerId} must be a non-negative integer.`,
        });
        return;
      }
      parsedSubscriptionCounts[providerId] = count;
    }

    setStatus({ kind: "saving" });
    try {
      const response = await fetch("/api/settings/warmup", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scheduleConfig, subscriptionCounts: parsedSubscriptionCounts }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setStatus({ kind: "error", message: body.error ?? "Could not save settings." });
        return;
      }
      setStatus({ kind: "saved" });
    } catch {
      setStatus({ kind: "error", message: "Could not reach PrimeTime to save settings." });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="timeZone">Time zone</Label>
          <Input
            id="timeZone"
            value={timeZone}
            onChange={(event) => setTimeZone(event.target.value)}
            placeholder="America/New_York"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="workStartTime">Work starts at</Label>
          <Input
            id="workStartTime"
            type="time"
            value={workStartTime}
            onChange={(event) => setWorkStartTime(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="leadTimeMinutes">Lead time (minutes)</Label>
          <Input
            id="leadTimeMinutes"
            type="number"
            min={0}
            value={leadTimeMinutes}
            onChange={(event) => setLeadTimeMinutes(event.target.value)}
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Active weekdays</p>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((weekday) => {
            const isActive = activeWeekdays.includes(weekday);
            return (
              <button
                key={weekday}
                type="button"
                aria-pressed={isActive}
                onClick={() => toggleWeekday(weekday)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                  isActive
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border bg-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {WEEKDAY_LABELS[weekday]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Dead-time windows</p>
          <Button type="button" variant="outline" size="sm" onClick={addDeadTimeWindow}>
            Add a window
          </Button>
        </div>
        {deadTimeWindows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            None yet — add one for lunch, meetings, or anything else that splits your day. PrimeTime
            re-warms your session right before each one ends.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {deadTimeWindows.map((window, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  type="time"
                  uiSize="sm"
                  value={window.startTime}
                  onChange={(event) => updateDeadTimeWindow(index, "startTime", event.target.value)}
                />
                <span className="text-sm text-muted-foreground">to</span>
                <Input
                  type="time"
                  uiSize="sm"
                  value={window.endTime}
                  onChange={(event) => updateDeadTimeWindow(index, "endTime", event.target.value)}
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => removeDeadTimeWindow(index)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Provider subscriptions</p>
        <p className="mb-2 text-sm text-muted-foreground">
          How many accounts/subscriptions do you have for each provider? This doesn&apos;t change
          anything yet — it&apos;s recorded for future multi-account support.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {AVAILABLE_PROVIDERS.map((provider) => (
            <div key={provider.id} className="flex flex-col gap-1.5">
              <Label htmlFor={`subscription-count-${provider.id}`}>{provider.label}</Label>
              <Input
                id={`subscription-count-${provider.id}`}
                type="number"
                min={0}
                value={subscriptionCounts[provider.id] ?? "0"}
                onChange={(event) =>
                  setSubscriptionCounts((current) => ({ ...current, [provider.id]: event.target.value }))
                }
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={status.kind === "saving"}>
          {status.kind === "saving" ? "Saving…" : "Save settings"}
        </Button>
        {status.kind === "saved" ? <p className="text-sm text-foreground">Saved.</p> : null}
        {status.kind === "error" ? <p className="text-sm text-warning">{status.message}</p> : null}
      </div>
    </form>
  );
}
