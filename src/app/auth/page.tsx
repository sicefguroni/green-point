import { Suspense } from "react";
import AuthPage from "./AuthPage";

export default function Auth() {
    return (
        <Suspense
            fallback={
                <main className="auth-page flex min-h-screen items-center justify-center font-poppins text-neutral-black/70">
                    Loading…
                </main>
            }
        >
            <AuthPage />
        </Suspense>
    );
}
