"use client";

import { useEffect, useState } from "react";

import { CodeBlock } from "@/components/code-block";
import { cn } from "@/lib/utils";
import { detectOs, type OsId } from "@/lib/detect-os";

interface OsCommand {
  id: OsId;
  label: string;
  code: string;
  reviewHref: string;
}

export function OsCommandTabs({
  commands,
  defaultOs,
}: {
  commands: OsCommand[];
  defaultOs: OsId;
}) {
  const [os, setOs] = useState<OsId>(defaultOs);

  useEffect(() => {
    const detected = detectOs();
    if (detected && commands.some((command) => command.id === detected)) {
      setOs(detected);
    }
  }, [commands]);

  const active = commands.find((command) => command.id === os) ?? commands[0];
  if (!active) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="inline-flex w-fit gap-1 rounded-md border border-border bg-muted p-1">
        {commands.map((command) => (
          <button
            key={command.id}
            type="button"
            onClick={() => setOs(command.id)}
            className={cn(
              "rounded-sm px-3 py-1 text-xs font-medium transition-colors",
              command.id === active.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {command.label}
          </button>
        ))}
      </div>

      <CodeBlock key={active.id} code={active.code} />

      <a
        href={active.reviewHref}
        target="_blank"
        rel="noreferrer"
        className="w-fit text-sm underline-offset-4 hover:underline"
      >
        Review the script before running it
      </a>
    </div>
  );
}
