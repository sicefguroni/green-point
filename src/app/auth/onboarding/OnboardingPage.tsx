"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import AuthLoadingOverlay from "@/components/auth/AuthLoadingOverlay";
import "@/components/auth/auth.css";

export default function OnboardingPage() {
    const router = useRouter();
    const [form, setForm] = useState({
        firstName: "",
        lastName: "",
        phone: "",
        address: "",
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exiting, setExiting] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        if (errors[e.target.name]) {
            setErrors({ ...errors, [e.target.name]: "" });
        }
        setError(null);
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};
        if (!form.firstName.trim()) newErrors.firstName = "First name is required";
        if (!form.lastName.trim()) newErrors.lastName = "Last name is required";
        if (!form.address.trim()) newErrors.address = "Address is required";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validateForm()) {
            setShowConfirmation(true);
        }
    };

    const handleConfirm = async () => {
        setSaving(true);
        setError(null);
        try {
            const res = await fetch("/api/profile/onboarding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({
                    firstName: form.firstName.trim(),
                    lastName: form.lastName.trim(),
                    phone: form.phone.trim() || null,
                    address: form.address.trim(),
                }),
            });

            const json = (await res.json().catch(() => ({}))) as {
                error?: string;
            };

            if (!res.ok) {
                const supabase = createSupabaseBrowserClient();
                const { error: metaErr } = await supabase.auth.updateUser({
                    data: {
                        onboarded: true,
                        hasCompletedOnboarding: true,
                        first_name: form.firstName.trim(),
                        last_name: form.lastName.trim(),
                        phone: form.phone.trim() || null,
                        address: form.address.trim(),
                    },
                });
                if (metaErr) {
                    const msg = json.error ?? "Could not save your profile";
                    setError(msg);
                    toast.error(msg);
                    setShowConfirmation(false);
                    return;
                }
                toast.warning(
                    "Profile saved to your account. Connect DATABASE_URL to sync with the app database."
                );
            } else {
                toast.success("Welcome to GreenPoint!");
            }

            setShowConfirmation(false);
            setExiting(true);
            window.setTimeout(() => {
                router.push("/home_dashboard");
                router.refresh();
            }, 480);
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = () => {
        setShowConfirmation(false);
    };

    return (
        <main
            className={`relative flex flex-col items-center justify-center min-h-screen px-6 bg-gradient-to-br from-white to-green-50 font-poppins ${
                exiting ? "onboarding-exit" : ""
            }`}
        >
            <AuthLoadingOverlay open={saving && !exiting} message="Saving your profile…" />

            {showConfirmation && (
                <div className="auth-overlay-fade fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6">
                    <div className="bg-white rounded-xl p-8 max-w-md shadow-2xl border border-neutral-grey/20 auth-card-anim">
                        <h2 className="text-2xl font-bold text-neutral-black mb-4">
                            Confirm your details
                        </h2>
                        <div className="space-y-3 mb-6 bg-gray-50 p-4 rounded-lg">
                            <div>
                                <p className="text-sm text-neutral-black/60">First name</p>
                                <p className="text-lg font-medium text-neutral-black">{form.firstName}</p>
                            </div>
                            <div>
                                <p className="text-sm text-neutral-black/60">Last name</p>
                                <p className="text-lg font-medium text-neutral-black">{form.lastName}</p>
                            </div>
                            {form.phone && (
                                <div>
                                    <p className="text-sm text-neutral-black/60">Phone</p>
                                    <p className="text-lg font-medium text-neutral-black">{form.phone}</p>
                                </div>
                            )}
                            <div>
                                <p className="text-sm text-neutral-black/60">Address</p>
                                <p className="text-lg font-medium text-neutral-black">{form.address}</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={handleEdit}
                                className="flex-1 border border-gray-300 text-neutral-black px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition"
                            >
                                Edit
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleConfirm()}
                                disabled={saving}
                                className="flex-1 text-white bg-primary-green px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {saving ? "Saving…" : "Confirm"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="w-full max-w-lg p-8 bg-white shadow-xl rounded-2xl border border-neutral-grey/30 auth-card-anim">
                <h1 className="text-3xl font-bold mb-2 text-center text-neutral-black">Welcome aboard</h1>
                <p className="mb-6 text-center text-neutral-black/65 text-sm">
                    Tell us a little about yourself so we can get started.
                </p>
                {error && (
                    <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {error}
                    </p>
                )}
                <form className="flex flex-col space-y-4" onSubmit={handleSubmit}>
                    <div>
                        <input
                            name="firstName"
                            placeholder="First name *"
                            value={form.firstName}
                            onChange={handleChange}
                            className={`w-full border p-3 rounded-lg font-poppins transition outline-none focus:ring-2 focus:ring-primary-green/30 ${
                                errors.firstName ? "border-red-500 bg-red-50" : "border-gray-300 hover:border-gray-400"
                            }`}
                        />
                        {errors.firstName && (
                            <p className="text-red-600 text-sm mt-1">{errors.firstName}</p>
                        )}
                    </div>
                    <div>
                        <input
                            name="lastName"
                            placeholder="Last name *"
                            value={form.lastName}
                            onChange={handleChange}
                            className={`w-full border p-3 rounded-lg font-poppins transition outline-none focus:ring-2 focus:ring-primary-green/30 ${
                                errors.lastName ? "border-red-500 bg-red-50" : "border-gray-300 hover:border-gray-400"
                            }`}
                        />
                        {errors.lastName && (
                            <p className="text-red-600 text-sm mt-1">{errors.lastName}</p>
                        )}
                    </div>
                    <div>
                        <input
                            name="phone"
                            type="tel"
                            placeholder="Phone number (optional)"
                            value={form.phone}
                            onChange={handleChange}
                            className="w-full border border-gray-300 p-3 rounded-lg font-poppins hover:border-gray-400 transition outline-none focus:ring-2 focus:ring-primary-green/30"
                        />
                    </div>
                    <div>
                        <input
                            name="address"
                            placeholder="Address *"
                            value={form.address}
                            onChange={handleChange}
                            className={`w-full border p-3 rounded-lg font-poppins transition outline-none focus:ring-2 focus:ring-primary-green/30 ${
                                errors.address ? "border-red-500 bg-red-50" : "border-gray-300 hover:border-gray-400"
                            }`}
                        />
                        {errors.address && (
                            <p className="text-red-600 text-sm mt-1">{errors.address}</p>
                        )}
                    </div>
                    <button
                        type="submit"
                        className="w-full text-white bg-primary-green hover:bg-green-700 px-4 py-3 rounded-lg font-medium transition mt-2"
                    >
                        Complete profile
                    </button>
                </form>
                <p className="text-center text-neutral-black/55 text-xs mt-4">* Required fields</p>
            </div>
        </main>
    );
}
