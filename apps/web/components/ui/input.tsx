import { cva, type VariantProps } from "class-variance-authority";
import { type InputHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

export const inputVariants = cva(
  "flex h-10 rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      uiSize: {
        default: "h-10",
        sm: "h-8 text-xs",
      },
    },
    defaultVariants: { uiSize: "default" },
  },
);

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, uiSize, ...props }, ref) => {
    return <input ref={ref} className={cn(inputVariants({ uiSize }), className)} {...props} />;
  },
);
Input.displayName = "Input";
