"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function VerifyPage() {
    const router = useRouter();
    const [otp, setOtp] = useState("");
    const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
    const [timer, setTimer] = useState(60);
    const [message, setMessage] = useState<string | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);

    // static OTP for demo
    const sendOtp = () => {
        const code = "123456"; // fixed sample code
        setGeneratedOtp(code);
        console.log("Static OTP (demo):", code);
        setMessage("A one-time code has been sent to your email.");
        setTimer(60);
    };

    const handleResend = () => {
        setOtp("");
        sendOtp();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (otp === generatedOtp) {
            setMessage(null);
            setShowSuccess(true);
            // Auto-redirect after 2 seconds
            setTimeout(() => {
                router.push("/auth/onboarding");
            }, 2000);
        } else {
            setMessage("Invalid OTP, please try again.");
        }
    };

    useEffect(() => {
        sendOtp();
    }, []);

    useEffect(() => {
        if (timer <= 0) return;
        const id = setInterval(() => setTimer((t) => t - 1), 1000);
        return () => clearInterval(id);
    }, [timer]);

    return (
        <main className="flex flex-col items-center justify-center min-h-screen px-6 font-poppins">
            {/* Success Modal */}
            {showSuccess && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-8 text-center max-w-sm shadow-2xl animate-pulse">
                        <div className="mb-4 text-6xl">✓</div>
                        <h2 className="text-2xl font-bold text-primary-green mb-2">Email Verified!</h2>
                        <p className="text-neutral-grey mb-4">
                            Your email has been successfully verified. Redirecting to onboarding...
                        </p>
                    </div>
                </div>
            )}

            {!showSuccess && (
                <>
                    <h1 className="text-3xl font-bold mb-4">Verify Your Email</h1>
                    <p className="mb-6 text-center">
                        Enter the one-time code we sent to your email address.
                    </p>
                    {message && <p className="mb-4 text-red-600">{message}</p>}
                    <form onSubmit={handleSubmit} className="flex flex-col items-center space-y-4 w-full max-w-xs">
                        <input
                            type="text"
                            inputMode="numeric"
                            value={otp}
                            onChange={(e) => {
                                const value = e.target.value.replace(/[^0-9]/g, "");
                                if (value.length <= 6) setOtp(value);
                            }}
                            maxLength={6}
                            className="text-center border p-3 rounded w-full text-lg tracking-widest font-poppins"
                            placeholder="123456"
                        />
                        <button
                            type="submit"
                            className="w-full text-white bg-primary-green px-4 py-3 rounded text-lg"
                        >
                            Verify
                        </button>
                    </form>
                    <div className="mt-4">
                        {timer > 0 ? (
                            <span className="text-gray-500">You can request a new code in {timer}s</span>
                        ) : (
                            <button onClick={handleResend} className="text-primary-green underline">
                                Resend code
                            </button>
                        )}
                    </div>
                </>
            )}
        </main>
    );
}
