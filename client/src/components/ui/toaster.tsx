import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Toast = {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "destructive";
};

let listeners: Array<(toasts: Toast[]) => void> = [];
let toasts: Toast[] = [];

export function toast(t: Omit<Toast, "id">) {
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts, { ...t, id }];
  listeners.forEach((l) => l([...toasts]));
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== id);
    listeners.forEach((l) => l([...toasts]));
  }, 4500);
}

export function Toaster() {
  const [list, setList] = useState<Toast[]>([]);

  useEffect(() => {
    listeners.push(setList);
    return () => {
      listeners = listeners.filter((l) => l !== setList);
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80">
      {list.map((t) => (
        <div
          key={t.id}
          className={cn(
            "rounded-lg border p-4 shadow-lg bg-white flex items-start gap-3",
            t.variant === "destructive" && "border-red-200 bg-red-50"
          )}
        >
          <div className="flex-1">
            <p className={cn("text-sm font-semibold", t.variant === "destructive" ? "text-red-800" : "text-stone-900")}>
              {t.title}
            </p>
            {t.description && (
              <p className={cn("text-xs mt-1", t.variant === "destructive" ? "text-red-600" : "text-stone-500")}>
                {t.description}
              </p>
            )}
          </div>
          <button
            onClick={() => {
              toasts = toasts.filter((x) => x.id !== t.id);
              listeners.forEach((l) => l([...toasts]));
            }}
            className="text-stone-500 hover:text-stone-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
