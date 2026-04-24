"use client";

import { Suspense } from "react";
import OnboardingPage from "./OnboardingPage";

export default function Onboarding() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50/90 via-white to-neutral-50">
          <div
            className="h-11 w-11 animate-spin rounded-full border-2 border-primary-green border-t-transparent"
            aria-label="Loading"
          />
        </div>
      }
    >
      <OnboardingPage />
    </Suspense>
  );
}
