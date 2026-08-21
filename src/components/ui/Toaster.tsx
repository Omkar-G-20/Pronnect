"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "error";
}

const toastListeners: ((toast: ToastItem) => void)[] = [];

export function toast(item: Omit<ToastItem, "id">) {
  const t: ToastItem = { ...item, id: Math.random().toString(36).slice(2) };
  toastListeners.forEach((fn) => fn(t));
}

export function Toaster() {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  React.useEffect(() => {
    const handler = (t: ToastItem) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 4000);
    };
    toastListeners.push(handler);
    return () => {
      const i = toastListeners.indexOf(handler);
      if (i > -1) toastListeners.splice(i, 1);
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "glass-card px-4 py-3 shadow-xl animate-slide-up flex items-start gap-3",
            t.variant === "error" && "border-red-500/50",
            t.variant === "success" && "border-green-500/50"
          )}
        >
          <div
            className={cn(
              "w-2 h-2 rounded-full mt-1.5 shrink-0",
              t.variant === "error" && "bg-red-500",
              t.variant === "success" && "bg-green-500",
              (!t.variant || t.variant === "default") && "bg-indigo-500"
            )}
          />
          <div>
            <p className="text-sm font-medium text-gray-100">{t.title}</p>
            {t.description && (
              <p className="text-xs text-gray-400 mt-0.5">{t.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
