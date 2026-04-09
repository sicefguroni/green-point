import { Suspense } from "react";
import LoginPage from "./LoginPage";

export default function Login() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-white to-green-100 font-poppins">
          <p className="text-neutral-black/70">Loading…</p>
        </main>
      }
    >
      <LoginPage />
    </Suspense>
  );
}
