import { Suspense } from "react";
import VerifyPage from "./VerifyPage";

export default function EmailVerification() {
  return (
    <Suspense fallback={null}>
      <VerifyPage />
    </Suspense>
  );
}
