import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type BadgeVariant = "neutral" | "success" | "warning" | "danger" | "info" | "calm" | "urgent";

type BadgeProps = {
  children: ReactNode;
  className?: string;
  variant?: BadgeVariant;
};

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "bg-[#dce8e1] text-[#21322a] border border-[#c4d8cc]",
  success: "bg-[#dff0e5] text-[#23663d] border border-[#bce2cb]",
  warning: "bg-[#f7edd0] text-[#7d5d17] border border-[#eee0b4]",
  danger: "bg-[#f6dbdb] text-[#943131] border border-[#eababa]",
  info: "bg-[#d9ece8] text-[#255f61] border border-[#b8dfd8]",
  calm: "bg-[#edf4ef] text-[#2e5e54] border border-[#cbe0d3]",
  urgent: "bg-[#fdf2f2] text-[#c94f4f] border border-[#f3caca]",
};

export function Badge({ children, className, variant = "neutral" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-colors duration-150",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
