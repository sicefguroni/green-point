"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GoogleOAuth() {
    const router = useRouter();
    useEffect(() => {
        const t = setTimeout(() => router.push("/home_dashboard"), 2000);
        return () => clearTimeout(t);
    }, [router]);
    return (
        <main className="flex items-center justify-center min-h-screen px-6 bg-white font-poppins">
            <div className="w-full max-w-lg p-8 bg-white shadow-lg rounded-lg text-center">
                <div className="mb-6 flex justify-center">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center animate-pulse">
                        <span className="text-3xl">🔵</span>
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-neutral-black mb-2">
                    Google Authentication
                </h1>
                <p className="text-neutral-grey mb-6">
                    Processing your Google sign-in...
                </p>
                <p className="text-sm text-neutral-grey/70 leading-relaxed">
                    You're being authenticated with your Google account. This may take a few moments.
                </p>
                <div className="mt-6 flex justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-green"></div>
                </div>
            </div>
        </main>
    );
}
