import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { toast } from "sonner"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Network-aware Supabase error handler.
 * Shows contextual toasts and returns a user-friendly message.
 */
export function handleSupabaseError(error: any, context?: string): string {
  const prefix = context ? `${context}: ` : '';

  // Offline
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    toast.error("You're offline", {
      description: 'Check your internet connection and try again.',
    });
    return `${prefix}No internet connection`;
  }

  // Auth expiry
  const status = error?.status ?? error?.code;
  if (status === 401 || status === 'PGRST301' || error?.message?.includes('JWT expired')) {
    toast.error('Session expired', {
      description: 'Please sign in again.',
    });
    return `${prefix}Session expired`;
  }

  // Generic
  const message = error?.message || 'An unexpected error occurred';
  toast.error(prefix ? `${context} failed` : 'Something went wrong', {
    description: message,
  });
  return `${prefix}${message}`;
}
