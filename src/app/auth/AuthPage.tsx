"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import AuthCard from "@/components/auth/AuthCard";
import OAuthButtons from "@/components/auth/OAuthButtons";
import Divider from "@/components/auth/Divider";
import "@/components/auth/auth.css";
import { startOAuthRedirect } from "@/lib/auth/oauth-start";

export default function AuthPage() {
    const searchParams = useSearchParams();
    const next = useMemo(() => searchParams.get("next") ?? "/home_dashboard", [searchParams]);

    return (
        <main className="auth-page">
            <AuthCard>
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-neutral-black">GreenPoint</h1>
                    <p className="text-neutral-black/70">Sign in to your account</p>
                </div>

                <OAuthButtons
                    onGoogleClick={() => startOAuthRedirect("google", next)}
                    onFacebookClick={() => startOAuthRedirect("facebook", next)}
                    onAppleClick={() => startOAuthRedirect("apple", next)}
                />

                <Divider text="or continue with" />

                <p className="text-center text-neutral-black/70">
                    <Link href={`/login${next !== "/home_dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-primary-darkgreen underline hover:opacity-75">
                        Email &amp; password
                    </Link>
                    {" · "}
                    <Link href="/signup" className="text-primary-darkgreen underline hover:opacity-75">
                        Create account
                    </Link>
                </p>
            </AuthCard>
        </main>
    );
}
