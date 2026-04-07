import { Suspense } from "react";
import VerifyPage from "./VerifyPage";

export default function EmailVerification() {
  return (
    <Suspense
      fallback={<main className="min-h-screen bg-gradient-to-br from-white to-green-100" />}
    >
      <VerifyPage />
    </Suspense>
  );
}
