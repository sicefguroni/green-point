"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FaGoogle, FaFacebook, FaApple } from "react-icons/fa";
import { toast } from "sonner";
import OutlineButton from "../../components/ui/general/inputs/outlinebutton";
import OutlineInputField from "../../components/ui/general/inputs/outlineinputfield";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { startOAuthRedirect } from "@/lib/auth/oauth-start";
import { friendlySignUpError } from "@/lib/auth/supabase-auth-messages";
import AuthLoadingOverlay from "@/components/auth/AuthLoadingOverlay";
import "@/components/auth/auth.css";

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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setForm({ ...form, [name]: value });
        setError(null);
        setMessage(null);
    };

    const validatePasswords = (): boolean => {
        if (form.password !== form.confirmPassword) {
            setError("Passwords do not match");
            return false;
        }
        return true;
    };

    function signInWithOAuth(provider: "google" | "facebook" | "apple") {
        setError(null);
        setMessage(null);
        setOauthBusy(true);
        toast.message("Welcome back! Signing you in…", {
            description: "Redirecting to your provider.",
        });
        startOAuthRedirect(provider, "/auth/onboarding");
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
                    friendly.includes("already")
                        ? "Email already in use."
                        : friendly
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
                        "You’re signed up, but the app database couldn’t be reached. You can continue; fix DATABASE_URL when you can."
                    );
                }
                setCardExit(true);
                window.setTimeout(() => {
                    router.push("/auth/onboarding");
                    router.refresh();
                }, 420);
                return;
            }

            setView("success");
            setMessage(
                "Check your email to verify your account. After verification you will be redirected to onboarding."
            );
            toast.success("Check your email to finish signing up.");
        } finally {
            setLoading(false);
        }
    };

    const overlayOpen = loading || oauthBusy;
    const overlayMessage = oauthBusy
        ? "Welcome back! Signing you in…"
        : loading
          ? "Processing…"
          : "Creating your account…";

    return (
        <main className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-white to-green-100 font-poppins px-4 py-8">
            <AuthLoadingOverlay open={overlayOpen} message={overlayMessage} />
            <div
                className={`w-full max-w-lg bg-white shadow-lg rounded-lg p-6 sm:p-8 ${
                    view === "form" && !cardExit
                        ? "auth-card-anim"
                        : ""
                } ${cardExit ? "auth-card-anim-exit" : ""}`}
            >
                {view === "success" ? (
                    <div className="auth-success-panel mx-auto flex w-full max-w-md flex-col items-center space-y-5 text-center">
                        <h1 className="text-2xl font-bold text-neutral-black font-poppins">
                            Almost there
                        </h1>
                        <p className="text-balance text-sm leading-relaxed text-neutral-black/75">
                            {message}
                        </p>
                        <div className="flex w-full flex-col items-stretch gap-3 pt-1">
                            <Link
                                href="/auth/verify"
                                className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary-green px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-green-700"
                            >
                                Verification help
                            </Link>
                            <Link
                                href="/login"
                                className="inline-flex min-h-10 w-full items-center justify-center rounded-lg py-2.5 text-center text-sm font-semibold text-primary-darkgreen underline decoration-primary-darkgreen/40 underline-offset-4 transition hover:bg-neutral-50 hover:opacity-90"
                            >
                                Back to log in
                            </Link>
                        </div>
                    </div>
                ) : (
                    <>
                        <h1 className="text-3xl font-bold text-center mb-6 font-poppins">
                            Create an Account
                        </h1>
                        <p className="text-center text-neutral-black/70 mb-6 font-poppins">
                            Start your journey with GreenPoint.
                        </p>

                        <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
                            <OutlineButton
                                icon={<FaGoogle size={20} className="text-red-600" />}
                                text="Google"
                                onClick={() => signInWithOAuth("google")}
                                disabled={loading || oauthBusy}
                            />
                            <OutlineButton
                                icon={<FaFacebook size={20} className="text-blue-600" />}
                                text="Facebook"
                                onClick={() => signInWithOAuth("facebook")}
                                disabled={loading || oauthBusy}
                            />
                            <OutlineButton
                                icon={<FaApple size={20} className="text-black" />}
                                text="Apple"
                                onClick={() => signInWithOAuth("apple")}
                                disabled={loading || oauthBusy}
                            />
                        </div>

                        <div className="flex items-center mb-6">
                            <div className="flex-grow h-px bg-gray-300" />
                            <span className="mx-4 text-gray-400 font-medium">or</span>
                            <div className="flex-grow h-px bg-gray-300" />
                        </div>

                        {error && (
                            <p className="text-red-600 text-sm mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
                                {error}
                            </p>
                        )}

                        <form className="space-y-4 font-poppins" onSubmit={handleSubmit}>
                            <div>
                                <OutlineInputField
                                    placeholder_="useremail@domain.com"
                                    label="Email Address"
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                />
                            </div>
                            <div>
                                <OutlineInputField
                                    placeholder_="Enter your password"
                                    label="Password"
                                    type="password"
                                    value={form.password}
                                    onChange={handleChange}
                                    name="password"
                                />
                            </div>
                            <div>
                                <OutlineInputField
                                    placeholder_="Confirm your password"
                                    label="Confirm Password"
                                    type="password"
                                    value={form.confirmPassword}
                                    onChange={handleChange}
                                    name="confirmPassword"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={
                                    loading ||
                                    oauthBusy ||
                                    !form.email ||
                                    !form.password ||
                                    !form.confirmPassword
                                }
                                className="w-full text-center text-xl text-white bg-primary-green py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                {loading ? "Processing…" : "Sign Up"}
                            </button>
                        </form>

                        <div className="mt-8 flex flex-col items-center justify-center gap-1 text-center text-sm text-neutral-black/75 sm:flex-row sm:flex-wrap sm:gap-x-1">
                            <span className="leading-normal">Already have an account?</span>
                            <Link
                                href="/login"
                                className="inline-flex min-h-10 items-center justify-center font-semibold text-primary-darkgreen underline decoration-primary-darkgreen/40 underline-offset-4 hover:opacity-80"
                            >
                                Log in
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}
