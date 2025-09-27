"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      theme="system"
      closeButton
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group relative flex w-full items-center justify-between gap-4 overflow-hidden rounded-lg border bg-background p-4 text-foreground shadow-lg transition-all",
          description: "text-sm text-muted-foreground",
          actionButton: "shrink-0"
        }
      }}
    />
  );
}
