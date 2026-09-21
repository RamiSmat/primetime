"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

export function CodeBlock({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied by the browser; the code is still selectable.
    }
  }

  return (
    <div className={cn("group relative rounded-md border border-border bg-muted", className)}>
      <pre className="overflow-x-auto p-4 pr-12 font-mono text-sm leading-relaxed">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy to clipboard"
        className="absolute right-2 top-2 rounded-md border border-border bg-card p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
