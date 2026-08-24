import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[#3e6b63] text-white hover:bg-[#345b54] shadow-[0_4px_14px_rgba(62,107,99,0.25)] hover:shadow-[0_6px_20px_rgba(62,107,99,0.35)] hover:-translate-y-0.5 active:translate-y-0",
  secondary:
    "bg-[#dce8e1] text-[#21322a] hover:bg-[#cbd8d1] hover:-translate-y-0.5 active:translate-y-0",
  ghost:
    "bg-transparent text-[#3e5149] hover:bg-[#eef4f0] hover:text-[#21322a]",
  danger:
    "bg-[#c94f4f] text-white hover:bg-[#b34343] shadow-[0_4px_14px_rgba(201,79,79,0.25)] hover:-translate-y-0.5 active:translate-y-0",
  accent:
    "bg-gradient-to-r from-[#0f766e] to-[#3e6b63] text-white shadow-[0_6px_20px_rgba(15,118,110,0.3)] hover:shadow-[0_8px_24px_rgba(15,118,110,0.4)] hover:-translate-y-0.5 active:translate-y-0",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-xs font-semibold tracking-wide",
  md: "px-5 py-2.5 text-sm font-semibold tracking-wide",
  lg: "px-7 py-3.5 text-base font-bold tracking-wide",
};

export function Button({
  children,
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-[#3e6b63]/40 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:transform-none disabled:shadow-none",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      type={props.type ?? "button"}
      {...props}
    >
      {children}
    </button>
  );
}
