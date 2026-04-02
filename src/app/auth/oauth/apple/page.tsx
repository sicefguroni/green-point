"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { startOAuthRedirect } from "@/lib/auth/oauth-start";

function AppleOAuthContent() {
    const searchParams = useSearchParams();
    const next = searchParams.get("next") ?? "/auth/onboarding";

    useEffect(() => {
        startOAuthRedirect("apple", next);
    }, [next]);

    return (
        <div className="w-full max-w-lg p-8 bg-white shadow-lg rounded-lg text-center">
            <div className="mb-6 flex justify-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center animate-pulse">
                    <span className="text-3xl">🍎</span>
                </div>
            </div>
            <h1 className="text-2xl font-bold text-neutral-black mb-2">Apple Authentication</h1>
            <p className="text-neutral-grey mb-6">Redirecting you to Apple to sign in…</p>
            <div className="mt-6 flex justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-green" />
            </div>
        </div>
    );
}

export default function AppleOAuth() {
    return (
        <main className="flex items-center justify-center min-h-screen px-6 bg-white font-poppins">
            <Suspense
                fallback={
                    <div className="w-full max-w-lg p-8 text-center text-neutral-grey">Loading…</div>
                }
            >
                <AppleOAuthContent />
            </Suspense>
        </main>
    );
}
