import { toast as sonnerToast, type ExternalToast } from "sonner";

export type Toast = ExternalToast;

export const useToast = () => ({
  toast: null,
  toasts: [] as Toast[],
  dismiss: sonnerToast.dismiss
});

export const toast = sonnerToast;
