import LandingPageClient from "@/components/landing/landing-page-client";

/**
 * Server shell keeps the first HTML response small; interactive UI is in the client boundary.
 */
export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-gradient-to-br from-white via-emerald-50/30 to-green-100 text-neutral-900 transition-colors dark:from-neutral-950 dark:via-emerald-950/40 dark:to-neutral-900 dark:text-neutral-50">
      <LandingPageClient />
    </main>
  );
}
