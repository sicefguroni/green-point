import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export const metadata = {
  title: "OAuth consent preview | GreenPoint",
  description:
    "Preview URL for OAuth and authorization flows (GreenPoint / Supabase).",
};

/**
 * Public preview route for OAuth consent / app verification.
 * Add to Supabase Auth redirect allow-list if required: http://localhost:3000/oauth/consent
 */
export default async function OAuthConsentPreviewPage() {
  let signedIn = false;
  let email: string | null = null;

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data } = await supabase.auth.getUser();
    signedIn = !!data.user;
    email = data.user?.email ?? null;
  } catch {
    // Build-time or missing env: still render static preview.
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-white to-green-100 px-6 py-16 font-poppins text-neutral-black">
      <div className="mx-auto max-w-lg rounded-2xl border border-neutral-black/10 bg-white p-8 shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-darkgreen">
          GreenPoint
        </p>
        <h1 className="mt-2 text-2xl font-bold">OAuth consent preview</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-black/75">
          This page is the registered <strong>authorization / consent preview</strong> URL for
          local development:{" "}
          <code className="rounded bg-neutral-black/5 px-1.5 py-0.5 text-xs">
            /oauth/consent
          </code>
          . Use it in provider consoles or Supabase redirect settings when a stable preview link
          is required.
        </p>

        <section className="mt-6 rounded-xl bg-neutral-black/[0.03] p-4 text-sm">
          <p className="font-medium text-neutral-black">Session preview</p>
          <p className="mt-2 text-neutral-black/70">
            {signedIn ? (
              <>
                Signed in as <span className="font-medium">{email ?? "user"}</span>.
              </>
            ) : (
              <>Not signed in. Use Log in to test a session-aware consent flow.</>
            )}
          </p>
        </section>

        <ul className="mt-6 list-inside list-disc space-y-2 text-sm text-neutral-black/75">
          <li>Sign-in continues to use <code className="text-xs">/auth/callback</code>.</li>
          <li>This route stays public and does not require onboarding.</li>
        </ul>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-neutral-black/15 px-4 text-sm font-semibold hover:bg-neutral-50"
          >
            Home
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary-green px-4 text-sm font-semibold text-white hover:bg-green-700"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="inline-flex min-h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-primary-darkgreen underline underline-offset-4"
          >
            Sign up
          </Link>
        </div>
      </div>
    </main>
  );
}
