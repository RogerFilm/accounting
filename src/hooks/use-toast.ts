"use client";

import { useState, useCallback, useRef } from "react";

export type ToastVariant = "success" | "error" | "info";

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant: ToastVariant;
}

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: ToastVariant;
}

let globalToastFn: ((options: ToastOptions) => void) | null = null;

export function toast(options: ToastOptions) {
  globalToastFn?.(options);
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (options: ToastOptions) => {
      const id = crypto.randomUUID();
      const newToast: Toast = {
        id,
        title: options.title,
        description: options.description,
        variant: options.variant ?? "info",
      };
      setToasts((prev) => [newToast, ...prev]);

      const timer = setTimeout(() => {
        dismiss(id);
      }, 3000);
      timersRef.current.set(id, timer);
    },
    [dismiss],
  );

  globalToastFn = addToast;

  return { toasts, toast: addToast, dismiss };
}
