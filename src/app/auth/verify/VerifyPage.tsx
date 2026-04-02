"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

export default function VerifyPage() {
    const searchParams = useSearchParams();
    const email = useMemo(() => searchParams.get("email"), [searchParams]);

    return (
        <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-white to-green-100 px-6 font-poppins">
            <div className="w-full max-w-lg rounded-lg bg-white p-8 text-center shadow-lg">
                <h1 className="mb-2 text-3xl font-bold text-neutral-black">Verify your email</h1>
                <p className="mb-6 text-neutral-black/70">
                    We sent a verification link{email ? ` to ${email}` : ""}. Open it to finish creating your account.
                </p>

                <div className="mx-auto mb-6 h-10 w-10 animate-spin rounded-full border-b-2 border-primary-green" />

                <div className="mx-auto flex w-full max-w-sm flex-col items-stretch gap-3">
                    <p className="text-sm leading-relaxed text-neutral-black/60">
                        After you click the link, you’ll be redirected to onboarding automatically.
                    </p>
                    <Link
                        href="/login"
                        className="inline-flex min-h-11 w-full items-center justify-center rounded-lg py-2.5 text-center text-sm font-semibold text-primary-darkgreen underline decoration-primary-darkgreen/40 underline-offset-4 transition hover:bg-neutral-50 hover:opacity-90"
                    >
                        Back to login
                    </Link>
                </div>
            </div>
        </main>
    );
}
