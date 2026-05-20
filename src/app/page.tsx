import LandingPageClient from "@/components/landing/landing-page-client";

/**
 * Server shell keeps the first HTML response small; interactive UI is in the client boundary.
 */
export default function LandingPage() {
  return (
    <main className="relative bg-background">
      <LandingPageClient />
    </main>
  );
}
