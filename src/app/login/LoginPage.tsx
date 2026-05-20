"use client";

import Link from "next/link";
import { FaGoogle } from "react-icons/fa";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { startOAuthRedirect } from "@/lib/auth/oauth-start";
import { friendlySignInError } from "@/lib/auth/supabase-auth-messages";
import AuthLoadingOverlay from "@/components/auth/AuthLoadingOverlay";
import "@/components/auth/auth.css";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(
    () => searchParams?.get("next") ?? "/home_dashboard",
    [searchParams],
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const queryHandled = useRef(false);

  const overlayOpen = loading || oauthBusy;
  const overlayMessage = oauthBusy
    ? "Welcome back! Signing you in…"
    : "Signing in…";

  useEffect(() => {
    if (queryHandled.current) return;
    const oauthCheck = searchParams?.get("oauth_check");
    const err = searchParams?.get("error");
    if (oauthCheck === "no_account") {
      queryHandled.current = true;
      toast.error("No account found. Please register first.", {
        description:
          "Use email sign-up to create your profile, then you can use social sign-in.",
      });
      const nextOnly = searchParams?.get("next");
      router.replace(
        nextOnly ? `/login?next=${encodeURIComponent(nextOnly)}` : "/login",
        { scroll: false },
      );
      return;
    }
    if (err && err !== "missing_code" && err !== "missing_token") {
      queryHandled.current = true;
      const decoded = decodeURIComponent(err);
      if (decoded === "profile_db_error") {
        toast.message("Database note", {
          description:
            "OAuth should work again without a working DB. If you still see this, restart the dev server after fixing DATABASE_URL.",
        });
      } else if (decoded === "oauth_no_user") {
        toast.error("Sign-in did not complete. Please try again.");
      } else {
        toast.error(friendlySignInError(decoded));
      }
      const nextOnly = searchParams?.get("next");
      router.replace(
        nextOnly ? `/login?next=${encodeURIComponent(nextOnly)}` : "/login",
        { scroll: false },
      );
    }
  }, [searchParams, router]);

  function signInWithGoogle() {
    setError(null);
    setOauthBusy(true);
    startOAuthRedirect("google", next);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        const msg = friendlySignInError(signInError.message);
        setError(msg);
        toast.error(msg);
        return;
      }

      const statusRes = await fetch("/api/auth/registrant-status", {
        credentials: "same-origin",
      });
      const statusJson = (await statusRes.json()) as {
        registered?: boolean;
        error?: string;
      };

      if (!statusRes.ok) {
        await supabase.auth.signOut();
        toast.error(statusJson.error ?? "Could not verify your account.");
        return;
      }

      if (!statusJson.registered) {
        await supabase.auth.signOut();
        toast.error("No account found. Please register first.");
        return;
      }

      router.push(next);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-neutral-100 font-roboto px-4 py-8">
      <AuthLoadingOverlay open={overlayOpen} message={overlayMessage} />

      {/* Background elements to match explore feel */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary-green/5 rounded-full blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-primary-green/5 rounded-full blur-[120px]" />
      </div>

      <div className="auth-card-anim relative w-full max-w-lg bg-white/80 backdrop-blur-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-[2.5rem] border border-white/50 p-8 sm:p-12">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-primary-green/10 rounded-2xl flex items-center justify-center text-primary-green mb-6 shadow-inner">
            <FaGoogle size={32} />
          </div>
          <h1 className="text-3xl font-black text-neutral-900 mb-2 font-poppins text-center tracking-tight">
            Welcome Back
          </h1>
          <p className="text-center text-neutral-500 font-medium">
            Access your GreenPoint workspace
          </p>
        </div>

        <div className="mb-8">
          <button
            type="button"
            onClick={() => signInWithGoogle()}
            disabled={overlayOpen}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-3xl border border-neutral-100 bg-white p-4 shadow-sm transition-all hover:border-primary-green/30 hover:bg-neutral-50 group"
          >
            <FaGoogle
              size={22}
              className="text-red-500 transition-transform group-hover:scale-110"
            />
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
              Continue with Google
            </span>
          </button>
        </div>

        <div className="flex items-center mb-8">
          <div className="flex-grow h-px bg-neutral-100" />
          <span className="mx-4 text-neutral-300 text-[10px] font-black uppercase tracking-widest leading-none">
            or email
          </span>
          <div className="flex-grow h-px bg-neutral-100" />
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-rose-100 bg-rose-50/50 px-4 py-3 text-sm text-rose-600 font-medium animate-in fade-in slide-in-from-top-1">
            {error}
          </div>
        )}

        <form className="space-y-6" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">
              Email Address
            </label>
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-14 px-5 rounded-2xl bg-neutral-50/50 border border-neutral-100 focus:border-primary-green focus:bg-white outline-none transition-all font-medium text-neutral-900 placeholder:text-neutral-300 shadow-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">
              Password
            </label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-14 px-5 rounded-2xl bg-neutral-50/50 border border-neutral-100 focus:border-primary-green focus:bg-white outline-none transition-all font-medium text-neutral-900 placeholder:text-neutral-300 shadow-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="relative w-full h-14 bg-neutral-900 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-neutral-800 transition-all active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none shadow-xl shadow-neutral-200 mt-4 overflow-hidden group"
          >
            <span className="relative z-10">
              {loading ? "Processing…" : "Sign In"}
            </span>
            <div className="absolute inset-0 bg-primary-green translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          </button>
        </form>

        <div className="mt-10 flex flex-col items-center justify-center gap-1 text-center text-sm font-medium">
          <span className="text-neutral-400">Don&apos;t have an account?</span>
          <Link
            href="/signup"
            className="text-primary-green font-bold hover:underline underline-offset-4"
          >
            Create your free profile
          </Link>
        </div>
      </div>
    </main>
  );
}
