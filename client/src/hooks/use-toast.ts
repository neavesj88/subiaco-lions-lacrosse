import { useState, useCallback } from "react";

export type Toast = {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "destructive";
};

let toastListeners: Array<(toasts: Toast[]) => void> = [];
let toasts: Toast[] = [];

function notify() {
  toastListeners.forEach((l) => l([...toasts]));
}

export function toast(t: Omit<Toast, "id">) {
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts, { ...t, id }];
  notify();
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== id);
    notify();
  }, 4000);
}

export function useToast() {
  const [list, setList] = useState<Toast[]>(toasts);

  const subscribe = useCallback((fn: (t: Toast[]) => void) => {
    toastListeners.push(fn);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== fn);
    };
  }, []);

  useState(() => {
    const unsub = subscribe(setList);
    return unsub;
  });

  return { toasts: list, toast };
}
