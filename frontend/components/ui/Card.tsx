import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type CardProps = {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
  featured?: boolean;
  urgent?: boolean;
};

export function Card({ children, className, hoverable = false, featured = false, urgent = false }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border transition-all duration-200",
        featured
          ? "border-[#3e6b63]/40 bg-gradient-to-br from-[#f9f7f1] via-[#edf4ef] to-[#f4f7f2] shadow-[0_10px_36px_rgba(62,107,99,0.12)]"
          : urgent
          ? "border-[#e8c4c4] bg-gradient-to-br from-[#fff7f7] to-[#fdf2f2] shadow-[0_8px_28px_rgba(201,79,79,0.1)]"
          : "border-[#d7e2db] bg-[#f9f7f1] shadow-[0_6px_24px_rgba(44,66,58,0.06)]",
        hoverable && "hover:-translate-y-1 hover:shadow-[0_14px_36px_rgba(44,66,58,0.12)] hover:border-[#b8ccbf]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: CardProps) {
  return <div className={cn("border-b border-[#d7e2db]/70 px-6 py-5", className)}>{children}</div>;
}

export function CardTitle({ children, className }: CardProps) {
  return <h3 className={cn("text-xl font-bold tracking-tight text-[#21322a]", className)}>{children}</h3>;
}

export function CardDescription({ children, className }: CardProps) {
  return <p className={cn("mt-1 text-sm leading-relaxed text-[#587066]", className)}>{children}</p>;
}

export function CardBody({ children, className }: CardProps) {
  return <div className={cn("px-6 py-5", className)}>{children}</div>;
}

export function CardFooter({ children, className }: CardProps) {
  return <div className={cn("border-t border-[#d7e2db]/70 px-6 py-4", className)}>{children}</div>;
}
