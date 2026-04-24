"use client";

import { FaGoogle } from "react-icons/fa";

interface OAuthButtonsProps {
  onGoogleClick: () => void;
}

export default function OAuthButtons({ onGoogleClick }: OAuthButtonsProps) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onGoogleClick}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white transition-shadow hover:shadow-md"
        aria-label="Continue with Google"
      >
        <FaGoogle className="text-red-500" size={20} />
        <span className="font-medium text-gray-700">Continue with Google</span>
      </button>
    </div>
  );
}
