import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-maroon-700 text-white",
        gold: "border-transparent bg-gold-500 text-white",
        outline: "border-maroon-300 text-maroon-700",
        secondary: "border-transparent bg-stone-100 text-stone-700",
        game: "border-transparent bg-blue-100 text-blue-800",
        training: "border-transparent bg-green-100 text-green-800",
        social: "border-transparent bg-purple-100 text-purple-800",
        meeting: "border-transparent bg-orange-100 text-orange-800",
        other: "border-transparent bg-stone-100 text-stone-700",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
