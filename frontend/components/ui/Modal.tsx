"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Button } from "./Button";

type ModalProps = {
  open?: boolean;
  isOpen?: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
};

export function Modal({ open, isOpen, title, children, onClose, className }: ModalProps) {
  const shouldShow = open ?? isOpen ?? false;

  useEffect(() => {
    if (!shouldShow) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shouldShow, onClose]);

  if (!shouldShow) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1b2b23]/50 backdrop-blur-sm p-4 transition-opacity duration-200"
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full max-w-lg transform rounded-3xl border border-[#d7e2db] bg-[#f9f7f1] p-6 shadow-[0_24px_70px_rgba(33,50,42,0.25)] transition-all duration-200 animate-in fade-in zoom-in-95",
          className
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#d7e2db]/70 pb-4">
          <h2 className="text-xl font-bold tracking-tight text-[#21322a]">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close modal" className="rounded-full text-xs font-bold text-[#587066] hover:text-[#21322a]">
            ✕
          </Button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
