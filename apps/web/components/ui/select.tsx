import { type SelectHTMLAttributes, forwardRef } from "react";

import { inputVariants } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { type VariantProps } from "class-variance-authority";

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size">,
    VariantProps<typeof inputVariants> {}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, uiSize, ...props }, ref) => {
    return (
      <select ref={ref} className={cn(inputVariants({ uiSize }), "pr-8", className)} {...props} />
    );
  },
);
Select.displayName = "Select";
