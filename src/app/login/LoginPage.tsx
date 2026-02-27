"use client";

import Link from "next/link";
import { FaGoogle, FaFacebook, FaApple } from "react-icons/fa";
import OutlineButton from "../../components/ui/general/inputs/outlinebutton";
import OutlineInputField from "../../components/ui/general/inputs/outlineinputfield";

export default function LoginPage() {
    return (
        <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-white to-green-100 font-poppins">
            <div className="w-full max-w-lg bg-white shadow-lg rounded-lg p-8">
                <h1 className="text-3xl font-bold text-center mb-6 font-poppins">Welcome Back</h1>
                <p className="text-center text-neutral-black/70 mb-6 font-poppins">
                    Please sign in to continue to GreenPoint.
                </p>

                <div className="flex justify-center space-x-4 mb-6">
                    <Link href="/auth/oauth/google">
                        <OutlineButton
                            icon={<FaGoogle size={20} className="text-red-600" />}
                            text="Google"
                        />
                    </Link>
                    <Link href="/auth/oauth/facebook">
                        <OutlineButton
                            icon={<FaFacebook size={20} className="text-blue-600" />}
                            text="Facebook"
                        />
                    </Link>
                    <Link href="/auth/oauth/apple">
                        <OutlineButton
                            icon={<FaApple size={20} className="text-black" />}
                            text="Apple"
                        />
                    </Link>
                </div>

                <div className="flex items-center mb-6">
                    <div className="flex-grow h-px bg-gray-300" />
                    <span className="mx-4 text-gray-400 font-medium">or</span>
                    <div className="flex-grow h-px bg-gray-300" />
                </div>

                <form className="space-y-4 font-poppins">
                    <OutlineInputField
                        placeholder_="useremail@domain.com"
                        label="Email Address"
                    />
                    <OutlineInputField
                        placeholder_="Enter your password"
                        label="Password"
                        type="password"
                    />
                    <Link
                        href="/home_dashboard"
                        className="block text-center text-xl text-white bg-primary-green py-3 rounded-lg font-semibold hover:bg-green-700 transition"
                    >
                        Log In
                    </Link>
                </form>

                <p className="text-center mt-6 font-poppins">
                    Don&apos;t have an account?{' '}
                    <Link
                        href="/signup"
                        className="text-primary-darkgreen underline hover:opacity-75"
                    >
                        Sign Up
                    </Link>
                </p>
            </div>
        </main>
    );
}
