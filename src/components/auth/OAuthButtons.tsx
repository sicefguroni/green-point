"use client";

import { FaGoogle, FaFacebook } from "react-icons/fa";

interface OAuthButtonsProps {
    onGoogleClick: () => void;
    onFacebookClick: () => void;
}

export default function OAuthButtons({
    onGoogleClick,
    onFacebookClick,
}: OAuthButtonsProps) {
    return (
        <div className="space-y-3">
            <button
                onClick={onGoogleClick}
                className="w-full h-12 flex items-center justify-center gap-3 border border-gray-300 rounded-lg bg-white hover:shadow-md transition-shadow"
                aria-label="Continue with Google"
            >
                <FaGoogle className="text-red-500" size={20} />
                <span className="text-gray-700 font-medium">Continue with Google</span>
            </button>
            <button
                onClick={onFacebookClick}
                className="w-full h-12 flex items-center justify-center gap-3 border border-gray-300 rounded-lg bg-white hover:shadow-md transition-shadow"
                aria-label="Continue with Facebook"
            >
                <FaFacebook className="text-blue-600" size={20} />
                <span className="text-gray-700 font-medium">Continue with Facebook</span>
            </button>
            <button
                onClick={onAppleClick}
                className="w-full h-12 flex items-center justify-center gap-3 border border-gray-300 rounded-lg bg-white hover:shadow-md transition-shadow"
                aria-label="Continue with Apple"
            >
                <FaApple className="text-black" size={20} />
                <span className="text-gray-700 font-medium">Continue with Apple</span>
            </button>
        </div>
    );
}
