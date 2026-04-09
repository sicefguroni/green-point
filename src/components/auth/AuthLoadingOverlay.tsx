"use client";

import "@/components/auth/auth.css";

export default function AuthLoadingOverlay({
  open,
  message = "Loading…",
}: {
  open: boolean;
  message?: string;
}) {
  if (!open) return null;

  return (
    <div
      className="auth-overlay-fade fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-white/85 backdrop-blur-md"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="h-10 w-10 rounded-full border-2 border-primary-green/30 border-t-primary-green animate-spin" />
      <p className="mt-4 text-sm font-medium text-neutral-black/80 font-poppins">
        {message}
      </p>
    </div>
  );
}
