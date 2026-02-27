"use client";

import Link from "next/link";
import { useState } from "react";
import { FaGoogle, FaFacebook, FaApple } from "react-icons/fa";
import OutlineButton from "../../components/ui/general/inputs/outlinebutton";
import OutlineInputField from "../../components/ui/general/inputs/outlineinputfield";

export default function SignupPage() {
    const [form, setForm] = useState({
        email: "",
        password: "",
        confirmPassword: "",
    });
    const [error, setError] = useState<string | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setForm({ ...form, [name]: value });
        setError(null);
    };

    const validatePasswords = (): boolean => {
        if (form.password !== form.confirmPassword) {
            setError("Passwords do not match");
            return false;
        }
        return true;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validatePasswords()) {
            // Proceed to verification page
            window.location.href = "/auth/verify";
        }
    };
    return (
        <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-white to-green-100 font-poppins">
            <div className="w-full max-w-lg bg-white shadow-lg rounded-lg p-8">
                <h1 className="text-3xl font-bold text-center mb-6 font-poppins">Create an Account</h1>
                <p className="text-center text-neutral-black/70 mb-6 font-poppins">
                    Start your journey with GreenPoint.
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

                <form className="space-y-4 font-poppins" onSubmit={handleSubmit}>
                    <div>
                        <OutlineInputField
                            placeholder_="useremail@domain.com"
                            label="Email Address"
                            type="email"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                        />
                    </div>
                    <div>
                        <OutlineInputField
                            placeholder_="Enter your password"
                            label="Password"
                            type="password"
                            value={form.password}
                            onChange={handleChange}
                            name="password"
                        />
                    </div>
                    <div>
                        <OutlineInputField
                            placeholder_="Confirm your password"
                            label="Confirm Password"
                            type="password"
                            value={form.confirmPassword}
                            onChange={handleChange}
                            name="confirmPassword"
                        />
                        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
                    </div>
                    <button
                        type="submit"
                        disabled={!form.email || !form.password || !form.confirmPassword}
                        className="w-full text-center text-xl text-white bg-primary-green py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Sign Up
                    </button>
                </form>

                <p className="text-center mt-6 font-poppins">
                    Already have an account?{' '}
                    <Link
                        href="/login"
                        className="text-primary-darkgreen underline hover:opacity-75"
                    >
                        Log In
                    </Link>
                </p>
            </div>
        </main>
    );
}
