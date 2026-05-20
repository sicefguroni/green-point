"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Mail, Inbox, ShieldCheck } from "lucide-react";

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const email = useMemo(() => searchParams?.get("email"), [searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50/80 via-white to-neutral-50 px-6 py-12 font-poppins">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-xl shadow-neutral-900/5">
        <div className="bg-gradient-to-r from-primary-green/90 to-emerald-700/90 px-8 py-10 text-center text-white">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Mail className="h-7 w-7" aria-hidden />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Verify your email
          </h1>
          <p className="mt-2 text-sm text-white/90">
            One more step to activate your GreenPoint account.
          </p>
        </div>

        <div className="space-y-6 px-8 py-10">
          <p className="text-center text-[15px] leading-relaxed text-neutral-700">
            We sent a secure link
            {email ? (
              <>
                {" "}
                to{" "}
                <span className="font-semibold text-neutral-900">{email}</span>
              </>
            ) : (
              " to your inbox"
            )}
            . Tap <strong>Confirm</strong> in that email — you will be
            redirected to onboarding and signed in automatically.
          </p>

          <ul className="space-y-3 rounded-xl border border-neutral-100 bg-neutral-50/80 p-4 text-sm text-neutral-600">
            <li className="flex gap-3">
              <Inbox
                className="mt-0.5 h-5 w-5 shrink-0 text-primary-green"
                aria-hidden
              />
              <span>
                Check Promotions or Spam if you do not see it within a minute.
              </span>
            </li>
            <li className="flex gap-3">
              <ShieldCheck
                className="mt-0.5 h-5 w-5 shrink-0 text-primary-green"
                aria-hidden
              />
              <span>
                Keep this tab open; after confirming, the app will refresh into
                onboarding.
              </span>
            </li>
          </ul>

          <div className="flex flex-col gap-3 pt-2">
            <Link
              href="/login"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-neutral-900 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              Back to sign in
            </Link>
            <Link
              href="/signup"
              className="text-center text-sm font-semibold text-primary-green underline decoration-primary-green/35 underline-offset-4 hover:opacity-90"
            >
              Wrong email? Sign up again
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
