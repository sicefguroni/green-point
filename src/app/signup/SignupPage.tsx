"use client";

import Link from "next/link";
import { useState } from "react";
import { FaGoogle, FaFacebook, FaApple } from "react-icons/fa";
import OutlineButton from "../../components/ui/general/inputs/outlinebutton";
import OutlineInputField from "../../components/ui/general/inputs/outlineinputfield";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { startOAuthRedirect } from "@/lib/auth/oauth-start";

export default function SignupPage() {
    const [form, setForm] = useState({
        email: "",
        password: "",
        confirmPassword: "",
    });
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

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
        setLoading(true);
        startOAuthRedirect(provider, "/auth/onboarding");
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setMessage(null);
        if (!validatePasswords()) return;

        setLoading(true);
        try {
            const supabase = createSupabaseBrowserClient();
            const { error: signUpError } = await supabase.auth.signUp({
                email: form.email,
                password: form.password,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent("/auth/onboarding")}`,
                },
            });

            if (signUpError) {
                setError(signUpError.message);
                return;
            }

            setMessage("Check your email to verify your account, then you’ll be redirected to onboarding.");
        } finally {
            setLoading(false);
        }
    };
    return (
        <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-white to-green-100 font-poppins">
            <div className="w-full max-w-lg bg-white shadow-lg rounded-lg p-8">
                <h1 className="text-3xl font-bold text-center mb-6 font-poppins">Create an Account</h1>
                <p className="text-center text-neutral-black/70 mb-6 font-poppins">
                    Start your journey with GreenPoint.
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

                {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
                {message && <p className="text-emerald-700 text-sm mb-4">{message}</p>}

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
                        disabled={loading || !form.email || !form.password || !form.confirmPassword}
                        className="w-full text-center text-xl text-white bg-primary-green py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {loading ? "Creating account..." : "Sign Up"}
                    </button>
                </form>

                <p className="text-center mt-6 font-poppins">
                    Already have an account?{' '}
                    <Link
                        href="/login"
                        className="text-primary-darkgreen underline hover:opacity-75"
                    >
                        Log In
                    </Link>
                </p>
            </div>
        </main>
    );
}
