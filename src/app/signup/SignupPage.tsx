"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FaGoogle } from "react-icons/fa";
import { Leaf, Sprout } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { startOAuthRedirect } from "@/lib/auth/oauth-start";
import { friendlySignUpError } from "@/lib/auth/supabase-auth-messages";
import AuthLoadingOverlay from "@/components/auth/AuthLoadingOverlay";
import "@/components/auth/auth.css";
import {
  PASSWORD_HINT_SHORT,
  PASSWORD_POLICY_SR_NOTE,
  passwordMeetsPolicy,
} from "@/lib/auth/password-policy";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [view, setView] = useState<"form" | "success">("form");
  const [cardExit, setCardExit] = useState(false);
  const [signedUpEmail, setSignedUpEmail] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    setError(null);
    setMessage(null);
  };

  const validatePasswords = (): boolean => {
    if (!passwordMeetsPolicy(form.password)) {
      setError(
        "That password is not strong enough yet. Check the hint and try again.",
      );
      return false;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return false;
    }
    return true;
  };

  function signInWithGoogle() {
    setError(null);
    setMessage(null);
    setOauthBusy(true);
    startOAuthRedirect("google", "/auth/onboarding");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!validatePasswords()) return;

    const email = form.email.trim();
    if (!email) return;

    setLoading(true);
    try {
      const checkRes = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const checkJson = (await checkRes.json()) as {
        registered?: boolean;
        error?: string;
      };

      if (!checkRes.ok) {
        toast.error(checkJson.error ?? "Could not verify email.");
        return;
      }

      if (checkJson.registered) {
        toast.error("Email already registered. Please sign in instead.");
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent("/auth/onboarding")}`,
        },
      });

      if (signUpError) {
        const friendly = friendlySignUpError(signUpError.message);
        setError(friendly);
        toast.error(
          friendly.includes("already") ? "Email already in use." : friendly,
        );
        return;
      }

      if (data.session) {
        const boot = await fetch("/api/auth/bootstrap-profile", {
          method: "POST",
          credentials: "same-origin",
        });
        if (!boot.ok) {
          toast.warning(
            "You’re signed up, but the app database couldn’t be reached. You can continue; fix DATABASE_URL when you can.",
          );
        }
        setCardExit(true);
        window.setTimeout(() => {
          router.push("/auth/onboarding");
          router.refresh();
        }, 420);
        return;
      }

      setSignedUpEmail(email);
      setView("success");
      setMessage(
        "Open the verification link we sent you. You will land on onboarding with your session ready.",
      );
      toast.success("Check your email to finish signing up.");
    } finally {
      setLoading(false);
    }
  };

  const passwordPolicyOk = passwordMeetsPolicy(form.password);
  const overlayOpen = loading || oauthBusy;
  const overlayMessage = oauthBusy
    ? "Welcome back! Signing you in…"
    : loading
      ? "Processing…"
      : "Creating your account…";

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-neutral-100 font-roboto px-4 py-8">
      <AuthLoadingOverlay open={overlayOpen} message={overlayMessage} />

      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary-green/5 rounded-full blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-primary-green/5 rounded-full blur-[120px]" />
      </div>

      <div
        className={`relative w-full max-w-lg bg-white/80 backdrop-blur-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-[2.5rem] border border-white/50 p-8 sm:p-12 ${
          view === "form" && !cardExit ? "auth-card-anim" : ""
        } ${cardExit ? "auth-card-anim-exit" : ""}`}
      >
        {view === "success" ? (
          <div className="auth-success-panel mx-auto flex w-full max-w-md flex-col items-center space-y-8 text-center py-6">
            <div className="w-20 h-20 bg-primary-green/10 rounded-3xl flex items-center justify-center text-primary-green mb-2 shadow-inner">
              <Leaf size={40} />
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-bold text-neutral-900 font-poppins tracking-tight">
                Almost there
              </h1>
              <p className="text-balance text-sm font-medium leading-relaxed text-neutral-500">
                {message}
              </p>
            </div>
            <div className="flex w-full flex-col items-stretch gap-4 pt-4">
              <Link
                href={
                  signedUpEmail
                    ? `/auth/verify?email=${encodeURIComponent(signedUpEmail)}`
                    : "/auth/verify"
                }
                className="inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-neutral-900 px-4 py-3 text-center text-sm font-bold uppercase tracking-[0.2em] text-white transition hover:bg-neutral-800 shadow-xl shadow-neutral-100"
              >
                What happens next
              </Link>
              <Link
                href="/login"
                className="text-sm font-bold text-primary-green hover:underline underline-offset-4"
              >
                Back to sign in
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center mb-10">
              <div className="w-16 h-16 bg-primary-green/10 rounded-2xl flex items-center justify-center text-primary-green mb-6 shadow-inner">
                <Sprout size={32} />
              </div>
              <h1 className="text-3xl font-bold text-neutral-900 mb-2 font-poppins text-center tracking-tight">
                Create Account
              </h1>
              <p className="text-center text-neutral-500 font-medium">
                Start your journey with GreenPoint
              </p>
            </div>

            <div className="mb-8">
              <button
                type="button"
                onClick={() => signInWithGoogle()}
                disabled={loading || oauthBusy}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-3xl border border-neutral-100 bg-white p-4 shadow-sm transition-all hover:border-primary-green/30 hover:bg-neutral-50 group"
              >
                <FaGoogle
                  size={22}
                  className="text-red-500 transition-transform group-hover:scale-110"
                />
                <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">
                  Continue with Google
                </span>
              </button>
            </div>

            <div className="flex items-center mb-8">
              <div className="flex-grow h-px bg-neutral-100" />
              <span className="mx-4 text-neutral-300 text-[10px] font-bold uppercase tracking-wide leading-none">
                or email
              </span>
              <div className="flex-grow h-px bg-neutral-100" />
            </div>

            {error && (
              <div className="mb-6 rounded-2xl border border-rose-100 bg-rose-50/50 px-4 py-3 text-sm text-rose-600 font-medium animate-in fade-in slide-in-from-top-1">
                {error}
              </div>
            )}

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide ml-1">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  placeholder="name@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full h-14 px-5 rounded-2xl bg-neutral-50/50 border border-neutral-100 focus:border-primary-green focus:bg-white outline-none transition-all font-medium text-neutral-900 placeholder:text-neutral-300 shadow-sm"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="signup-password"
                  className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide ml-1"
                >
                  Password
                </label>
                <span id="signup-password-sr" className="sr-only">
                  {PASSWORD_POLICY_SR_NOTE}
                </span>
                <input
                  id="signup-password"
                  type="password"
                  name="password"
                  placeholder="Create a strong password"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  aria-describedby="signup-password-sr signup-password-hint"
                  className="w-full h-14 px-5 rounded-2xl bg-neutral-50/50 border border-neutral-100 focus:border-primary-green focus:bg-white outline-none transition-all font-medium text-neutral-900 placeholder:text-neutral-300 shadow-sm"
                />
                <p
                  id="signup-password-hint"
                  className={`ml-1 text-[11px] font-medium leading-snug transition-colors ${
                    form.password ? "text-neutral-500" : "sr-only"
                  }`}
                >
                  {PASSWORD_HINT_SHORT}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide ml-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="Confirm your password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                  className="w-full h-14 px-5 rounded-2xl bg-neutral-50/50 border border-neutral-100 focus:border-primary-green focus:bg-white outline-none transition-all font-medium text-neutral-900 placeholder:text-neutral-300 shadow-sm"
                />
              </div>

              <button
                type="submit"
                disabled={
                  loading ||
                  oauthBusy ||
                  !form.email ||
                  !form.password ||
                  !form.confirmPassword ||
                  !passwordPolicyOk
                }
                className="relative w-full h-14 bg-neutral-900 text-white rounded-2xl font-bold text-sm uppercase tracking-[0.2em] hover:bg-neutral-800 transition-all active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none shadow-xl shadow-neutral-200 mt-4 overflow-hidden group"
              >
                <span className="relative z-10">
                  {loading ? "Processing…" : "Sign Up"}
                </span>
                <div className="absolute inset-0 bg-primary-green translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </button>
            </form>

            <div className="mt-10 flex flex-col items-center justify-center gap-1 text-center text-sm font-medium">
              <span className="text-neutral-400">Already have an account?</span>
              <Link
                href="/login"
                className="text-primary-green font-bold hover:underline underline-offset-4"
              >
                Sign in instead
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
