import Link from "next/link";

export default function AuthLanding() {
    return (
        <main className="flex flex-col items-center justify-center min-h-screen">
            <h1 className="text-3xl font-bold mb-6">Welcome to GreenPoint</h1>
            <p className="mb-4">
                You should arrive here after signing up or logging in. Replace this
                content with your post-auth pages (dashboard, profile, etc.).
            </p>
            <Link
                href="/home_dashboard"
                className="text-white bg-primary-green px-4 py-2 rounded"
            >
                Go to Dashboard
            </Link>
        </main>
    );
}
