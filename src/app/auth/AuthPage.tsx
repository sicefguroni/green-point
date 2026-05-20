"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import AuthCard from "@/components/auth/AuthCard";
import OAuthButtons from "@/components/auth/OAuthButtons";
import Divider from "@/components/auth/Divider";
import AuthLoadingOverlay from "@/components/auth/AuthLoadingOverlay";
import "@/components/auth/auth.css";
import { startOAuthRedirect } from "@/lib/auth/oauth-start";

export default function AuthPage() {
  const searchParams = useSearchParams();
  const next = useMemo(
    () => searchParams?.get("next") ?? "/home_dashboard",
    [searchParams],
  );
  const [oauthBusy, setOauthBusy] = useState(false);

  return (
    <main className="auth-page relative">
      <AuthLoadingOverlay
        open={oauthBusy}
        message="Welcome back! Signing you in…"
      />
      <AuthCard>
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-neutral-black">GreenPoint</h1>
          <p className="text-neutral-black/70">Sign in to your account</p>
        </div>

        <OAuthButtons
          onGoogleClick={() => {
            setOauthBusy(true);
            toast.message("Welcome back! Signing you in…", {
              description: "Redirecting to Google.",
            });
            startOAuthRedirect("google", next);
          }}
        />

        <Divider text="or continue with" />

        <nav
          className="flex w-full flex-col items-stretch gap-2 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-0"
          aria-label="Other sign-in options"
        >
          <Link
            href={`/login${next !== "/home_dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 py-2.5 text-center font-semibold text-primary-darkgreen underline decoration-primary-darkgreen/40 underline-offset-4 transition hover:bg-neutral-50 sm:w-auto sm:min-w-[10rem]"
          >
            Email &amp; password
          </Link>
          <span
            className="hidden shrink-0 select-none px-2 text-center text-neutral-black/35 sm:block"
            aria-hidden
          >
            |
          </span>
          <Link
            href="/signup"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 py-2.5 text-center font-semibold text-primary-darkgreen underline decoration-primary-darkgreen/40 underline-offset-4 transition hover:bg-neutral-50 sm:w-auto sm:min-w-[10rem]"
          >
            Create account
          </Link>
        </nav>
      </AuthCard>
    </main>
  );
}
