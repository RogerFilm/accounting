"use client";

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

const variantStyles = {
  success: "border-green-200 bg-green-50 text-green-800",
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-border bg-card text-card-foreground",
} as const;

const variantIcons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
} as const;

export function Toaster() {
  const { toasts, dismiss } = useToast();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80">
      {toasts.map((t) => {
        const Icon = variantIcons[t.variant];
        return (
          <div
            key={t.id}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-4 shadow-lg animate-toast-in",
              variantStyles[t.variant],
            )}
          >
            <Icon className="h-5 w-5 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              {t.title && <p className="text-sm font-semibold">{t.title}</p>}
              {t.description && (
                <p className="text-sm opacity-80">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded-md p-1 opacity-60 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
