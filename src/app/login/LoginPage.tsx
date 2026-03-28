"use client";

import Link from "next/link";
import { FaGoogle, FaFacebook, FaApple } from "react-icons/fa";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import OutlineButton from "../../components/ui/general/inputs/outlinebutton";
import OutlineInputField from "../../components/ui/general/inputs/outlineinputfield";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { startOAuthRedirect } from "@/lib/auth/oauth-start";

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const next = useMemo(() => searchParams.get("next") ?? "/home_dashboard", [searchParams]);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    function signInWithOAuth(provider: "google" | "facebook" | "apple") {
        setError(null);
        setLoading(true);
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
                setError(signInError.message);
                return;
            }
            router.push(next);
            router.refresh();
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-white to-green-100 font-poppins">
            <div className="w-full max-w-lg bg-white shadow-lg rounded-lg p-8">
                <h1 className="text-3xl font-bold text-center mb-6 font-poppins">Welcome Back</h1>
                <p className="text-center text-neutral-black/70 mb-6 font-poppins">
                    Please sign in to continue to GreenPoint.
                </p>

                <div className="flex justify-center space-x-4 mb-6">
                    <OutlineButton
                        icon={<FaGoogle size={20} className="text-red-600" />}
                        text="Google"
                        onClick={() => signInWithOAuth("google")}
                        disabled={loading}
                    />
                    <OutlineButton
                        icon={<FaFacebook size={20} className="text-blue-600" />}
                        text="Facebook"
                        onClick={() => signInWithOAuth("facebook")}
                        disabled={loading}
                    />
                    <OutlineButton
                        icon={<FaApple size={20} className="text-black" />}
                        text="Apple"
                        onClick={() => signInWithOAuth("apple")}
                        disabled={loading}
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
                        {loading ? "Signing in..." : "Log In"}
                    </button>
                </form>

                <p className="text-center mt-6 font-poppins">
                    Don&apos;t have an account?{' '}
                    <Link
                        href="/signup"
                        className="text-primary-darkgreen underline hover:opacity-75"
                    >
                        Sign Up
                    </Link>
                </p>
            </div>
        </main>
    );
}
