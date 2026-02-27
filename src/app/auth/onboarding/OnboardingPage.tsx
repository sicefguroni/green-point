"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        if (errors[e.target.name]) {
            setErrors({ ...errors, [e.target.name]: "" });
        }
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

    const handleConfirm = () => {
        console.log("Onboarding form confirmed:", form);
        router.push("/profile");
    };

    const handleEdit = () => {
        setShowConfirmation(false);
    };

    return (
        <main className="flex flex-col items-center justify-center min-h-screen px-6 bg-white font-poppins">
            {/* Confirmation Modal */}
            {showConfirmation && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6">
                    <div className="bg-white rounded-lg p-8 max-w-md shadow-2xl">
                        <h2 className="text-2xl font-bold text-neutral-black mb-4">Confirm Your Details</h2>
                        <div className="space-y-3 mb-6 bg-gray-50 p-4 rounded">
                            <div>
                                <p className="text-sm text-neutral-grey">First Name</p>
                                <p className="text-lg font-medium text-neutral-black">{form.firstName}</p>
                            </div>
                            <div>
                                <p className="text-sm text-neutral-grey">Last Name</p>
                                <p className="text-lg font-medium text-neutral-black">{form.lastName}</p>
                            </div>
                            {form.phone && (
                                <div>
                                    <p className="text-sm text-neutral-grey">Phone Number</p>
                                    <p className="text-lg font-medium text-neutral-black">{form.phone}</p>
                                </div>
                            )}
                            <div>
                                <p className="text-sm text-neutral-grey">Address</p>
                                <p className="text-lg font-medium text-neutral-black">{form.address}</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleEdit}
                                className="flex-1 border border-gray-300 text-neutral-black px-4 py-2 rounded font-poppins font-medium hover:bg-gray-100 transition"
                            >
                                Edit
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="flex-1 text-white bg-primary-green px-4 py-2 rounded font-poppins font-medium hover:bg-green-700 transition"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="w-full max-w-lg p-8 bg-white shadow-lg rounded-lg">
                <h1 className="text-3xl font-bold mb-2 text-center text-neutral-black">Welcome Aboard</h1>
                <p className="mb-6 text-center text-neutral-grey">
                    Tell us a little about yourself so we can get started.
                </p>
                <form className="flex flex-col space-y-4" onSubmit={handleSubmit}>
                    <div>
                        <input
                            name="firstName"
                            placeholder="First name *"
                            value={form.firstName}
                            onChange={handleChange}
                            className={`w-full border p-3 rounded font-poppins transition ${errors.firstName ? "border-red-500 bg-red-50" : "border-gray-300 hover:border-gray-400"}`}
                        />
                        {errors.firstName && <p className="text-red-600 text-sm mt-1">{errors.firstName}</p>}
                    </div>
                    <div>
                        <input
                            name="lastName"
                            placeholder="Last name *"
                            value={form.lastName}
                            onChange={handleChange}
                            className={`w-full border p-3 rounded font-poppins transition ${errors.lastName ? "border-red-500 bg-red-50" : "border-gray-300 hover:border-gray-400"}`}
                        />
                        {errors.lastName && <p className="text-red-600 text-sm mt-1">{errors.lastName}</p>}
                    </div>
                    <div>
                        <input
                            name="phone"
                            type="tel"
                            placeholder="Phone number (optional)"
                            value={form.phone}
                            onChange={handleChange}
                            className="w-full border border-gray-300 p-3 rounded font-poppins hover:border-gray-400 transition"
                        />
                    </div>
                    <div>
                        <input
                            name="address"
                            placeholder="Address *"
                            value={form.address}
                            onChange={handleChange}
                            className={`w-full border p-3 rounded font-poppins transition ${errors.address ? "border-red-500 bg-red-50" : "border-gray-300 hover:border-gray-400"}`}
                        />
                        {errors.address && <p className="text-red-600 text-sm mt-1">{errors.address}</p>}
                    </div>
                    <button type="submit" className="w-full text-white bg-primary-green hover:bg-green-700 px-4 py-3 rounded font-poppins font-medium transition mt-2">
                        Complete Profile
                    </button>
                </form>
                <p className="text-center text-neutral-grey text-sm mt-4">* Required fields</p>
            </div>
        </main>
    );
}
