"use client";

import { useState } from "react";
import Link from "next/link";
import AuthCard from "@/components/auth/AuthCard";
import OAuthButtons from "@/components/auth/OAuthButtons";
import Divider from "@/components/auth/Divider";
import "@/components/auth/auth.css";

export default function AuthPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleOAuthGoogle = () => {
        window.location.href = "/api/auth/google";
    };

    const handleOAuthFacebook = () => {
        window.location.href = "/api/auth/facebook";
    };

    const handleOAuthApple = () => {
        window.location.href = "/api/auth/apple";
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Placeholder: handle login/signup logic
        console.log("Login attempt:", { email, password });
    };

    return (
        <main className="auth-page">
            <AuthCard>
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-neutral-black">GreenPoint</h1>
                    <p className="text-neutral-black/70">Sign in to your account</p>
                </div>

                <OAuthButtons
                    onGoogleClick={handleOAuthGoogle}
                    onFacebookClick={handleOAuthFacebook}
                    onAppleClick={handleOAuthApple}
                />

                <Divider text="or continue with" />

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-neutral-black mb-1">
                            Email Address
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="useremail@domain.com"
                            required
                            className="w-full px-3 py-2 border border-neutral-grey rounded-lg bg-gray-100 text-neutral-black placeholder:text-neutral-black/50 focus:border-primary-green"
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-neutral-black mb-1">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            required
                            className="w-full px-3 py-2 border border-neutral-grey rounded-lg bg-gray-100 text-neutral-black placeholder:text-neutral-black/50 focus:border-primary-green"
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full py-2 bg-primary-green text-white rounded-lg font-medium hover:bg-green-700 transition"
                    >
                        Sign In
                    </button>
                </form>

                <p className="text-center mt-6 text-neutral-black/70">
                    Don&apos;t have an account?{" "}
                    <Link href="/signup" className="text-primary-darkgreen underline hover:opacity-75">
                        Sign Up
                    </Link>
                </p>
            </AuthCard>
        </main>
    );
}
