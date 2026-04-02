"use client";

import Link from "next/link";
import { FaGoogle, FaFacebook, FaApple } from "react-icons/fa";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import OutlineButton from "../../components/ui/general/inputs/outlinebutton";
import OutlineInputField from "../../components/ui/general/inputs/outlineinputfield";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { startOAuthRedirect } from "@/lib/auth/oauth-start";
import { friendlySignInError } from "@/lib/auth/supabase-auth-messages";
import AuthLoadingOverlay from "@/components/auth/AuthLoadingOverlay";
import "@/components/auth/auth.css";

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const next = useMemo(() => searchParams.get("next") ?? "/home_dashboard", [searchParams]);
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
        const oauthCheck = searchParams.get("oauth_check");
        const err = searchParams.get("error");
        if (oauthCheck === "no_account") {
            queryHandled.current = true;
            toast.error("No account found. Please register first.", {
                description: "Use email sign-up to create your profile, then you can use social sign-in.",
            });
            const nextOnly = searchParams.get("next");
            router.replace(
                nextOnly
                    ? `/login?next=${encodeURIComponent(nextOnly)}`
                    : "/login",
                { scroll: false }
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
            const nextOnly = searchParams.get("next");
            router.replace(
                nextOnly
                    ? `/login?next=${encodeURIComponent(nextOnly)}`
                    : "/login",
                { scroll: false }
            );
        }
    }, [searchParams, router]);

    function signInWithOAuth(provider: "google" | "facebook" | "apple") {
        setError(null);
        setOauthBusy(true);
        toast.message("Welcome back! Signing you in…", {
            description: "Redirecting to your provider.",
        });
        startOAuthRedirect(provider, next);
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

            toast.success("Signed in successfully.");
            router.push(next);
            router.refresh();
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-white to-green-100 font-poppins px-4 py-8">
            <AuthLoadingOverlay open={overlayOpen} message={overlayMessage} />
            <div className="auth-card-anim w-full max-w-lg bg-white shadow-lg rounded-lg p-6 sm:p-8">
                <h1 className="text-3xl font-bold text-center mb-6 font-poppins">Welcome Back</h1>
                <p className="text-center text-neutral-black/70 mb-6 font-poppins">
                    Please sign in to continue to GreenPoint.
                </p>

                <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
                    <OutlineButton
                        icon={<FaGoogle size={20} className="text-red-600" />}
                        text="Google"
                        onClick={() => signInWithOAuth("google")}
                        disabled={overlayOpen}
                    />
                    <OutlineButton
                        icon={<FaFacebook size={20} className="text-blue-600" />}
                        text="Facebook"
                        onClick={() => signInWithOAuth("facebook")}
                        disabled={overlayOpen}
                    />
                    <OutlineButton
                        icon={<FaApple size={20} className="text-black" />}
                        text="Apple"
                        onClick={() => signInWithOAuth("apple")}
                        disabled={overlayOpen}
                    />
                </div>

                <div className="flex items-center mb-6">
                    <div className="flex-grow h-px bg-gray-300" />
                    <span className="mx-4 text-gray-400 font-medium">or</span>
                    <div className="flex-grow h-px bg-gray-300" />
                </div>

                {error && (
                    <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {error}
                    </p>
                )}

                <form className="space-y-4 font-poppins" onSubmit={onSubmit}>
                    <OutlineInputField
                        placeholder_="useremail@domain.com"
                        label="Email Address"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <OutlineInputField
                        placeholder_="Enter your password"
                        label="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                        type="submit"
                        disabled={loading || !email || !password}
                        className="block w-full text-center text-xl text-white bg-primary-green py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {loading ? "Processing…" : "Log In"}
                    </button>
                </form>

                <div className="mt-8 flex flex-col items-center justify-center gap-1 text-center text-sm text-neutral-black/75 sm:flex-row sm:flex-wrap sm:gap-x-1">
                    <span className="leading-normal">Don&apos;t have an account?</span>
                    <Link
                        href="/signup"
                        className="inline-flex min-h-10 items-center justify-center font-semibold text-primary-darkgreen underline decoration-primary-darkgreen/40 underline-offset-4 hover:opacity-80"
                    >
                        Sign up
                    </Link>
                </div>
            </div>
        </main>
    );
}
