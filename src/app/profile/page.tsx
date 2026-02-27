"use client";

import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();

  return (
    <main className="flex items-center justify-center min-h-screen px-6 bg-gray-100">
      <div className="w-full max-w-lg p-8 bg-white rounded-lg shadow-lg text-center">
        <button
          onClick={() => router.push("/")}
          className="mb-4 px-4 py-2 bg-gray-300 text-neutral-black rounded hover:bg-gray-400 transition"
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold font-poppins text-neutral-black mb-4">
          Profile
        </h1>
        <p className="text-neutral-grey">Profile page - Coming soon!</p>
      </div>
    </main>
  );
}