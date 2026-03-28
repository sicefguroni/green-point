"use client";

import { ChangeEvent, useEffect, useMemo, useState, useRef } from "react";
import { FaCheckCircle, FaTimesCircle, FaUpload, FaIdCard } from "react-icons/fa";
import OutlineButton from "@/components/ui/general/inputs/outlinebutton";
import OutlineInputField from "@/components/ui/general/inputs/outlineinputfield";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Role = "planner" | "user";
type VerificationStatus = "verified" | "unverified" | "pending";

export default function ProfilePage() {
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const [profile, setProfile] = useState({
        photoUrl: "",
        name: "",
        email: "",
        role: "planner" as Role,
        verification: "pending" as VerificationStatus,
        bio: "Passionate about sustainable urban planning and community engagement.",
        phone: "+63 912 345 6789",
        businessName: "GreenPoint Consulting",
        portfolioLinks: "https://www.linkedin.com/in/juandelacruz",
        idStatus: "pending" as VerificationStatus,
    });

    const isPlanner = profile.role === "planner";

    // --- Labels ---
    const verificationLabel = useMemo(() => {
        if (profile.verification === "verified") return "Verified";
        if (profile.verification === "unverified") return "Unverified";
        return "Pending verification";
    }, [profile.verification]);

    const idUploadLabel = useMemo(() => {
        if (profile.idStatus === "verified") return "ID Verified";
        if (profile.idStatus === "unverified") return "Upload required";
        return "Pending review";
    }, [profile.idStatus]);

    // --- Handlers ---
    const handleChange = (field: keyof typeof profile) => (
        e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        setProfile((prev) => ({ ...prev, [field]: e.target.value }));
    };

    const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        setProfile((prev) => ({ ...prev, photoUrl: url }));
    };

    const handleIdUpload = () => {
        // Mocking an ID upload trigger
        alert("Select your government ID file");
        setProfile(prev => ({ ...prev, idStatus: "pending" }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const supabase = createSupabaseBrowserClient();
            const [firstName, ...rest] = profile.name.trim().split(/\s+/);
            const lastName = rest.join(" ");
            const { error } = await supabase.auth.updateUser({
                data: {
                    first_name: firstName || null,
                    last_name: lastName || null,
                    phone: profile.phone || null,
                    business_name: profile.businessName || null,
                    portfolio_links: profile.portfolioLinks || null,
                    bio: profile.bio || null,
                },
            });
            if (error) throw error;
            alert("Profile updated successfully!");
        } finally {
            setSaving(false);
        }
    };

    async function handleSignOut() {
        await fetch("/api/auth/signout", { method: "POST", credentials: "include" });
        router.push("/login");
        router.refresh();
    }

    // Load Supabase user into UI
    useEffect(() => {
        let mounted = true;
        (async () => {
            const supabase = createSupabaseBrowserClient();
            const { data } = await supabase.auth.getUser();
            if (!mounted) return;
            const u = data.user;
            if (!u) return;
            const first = (u.user_metadata?.first_name as string | undefined) ?? "";
            const last = (u.user_metadata?.last_name as string | undefined) ?? "";
            const name = `${first} ${last}`.trim();
            setProfile((prev) => ({
                ...prev,
                email: u.email ?? "",
                name: name || prev.name,
                phone: (u.user_metadata?.phone as string | undefined) ?? prev.phone,
                businessName: (u.user_metadata?.business_name as string | undefined) ?? prev.businessName,
                portfolioLinks: (u.user_metadata?.portfolio_links as string | undefined) ?? prev.portfolioLinks,
                bio: (u.user_metadata?.bio as string | undefined) ?? prev.bio,
                verification: u.email_confirmed_at ? "verified" : "unverified",
            }));
        })();
        return () => {
            mounted = false;
        };
    }, []);

    return (
        <main className="min-h-screen bg-gradient-to-br from-white to-green-100 py-10 px-4 font-poppins">
            <div className="mx-auto w-full max-w-6xl space-y-6">
                <header className="flex flex-col gap-2">
                    <h1 className="text-3xl font-semibold text-neutral-black">My Profile</h1>
                    <p className="text-neutral-black/70 max-w-2xl">
                        Update your profile information, upload your ID, and keep your contact details current.
                    </p>
                    <div className="flex flex-wrap gap-3 pt-2">
                        <Link
                            href="/home_dashboard"
                            className="inline-flex items-center justify-center rounded-lg border border-neutral-grey/40 bg-white px-4 py-2 text-sm font-semibold text-neutral-black hover:bg-gray-50"
                        >
                            Back to dashboard
                        </Link>
                        <button
                            type="button"
                            onClick={() => void handleSignOut()}
                            className="inline-flex items-center justify-center rounded-lg bg-neutral-black px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                        >
                            Sign out
                        </button>
                    </div>
                </header>

                <section className="grid gap-6 lg:grid-cols-3">
                    {/* Left Column: Summary Card */}
                    <article className="rounded-2xl border border-neutral-grey/40 bg-white p-6 shadow-sm h-fit">
                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="relative">
                                <div className="h-28 w-28 overflow-hidden rounded-full border border-neutral-grey/50 bg-neutral-grey/10">
                                    {profile.photoUrl ? (
                                        <img
                                            src={profile.photoUrl}
                                            alt="Profile"
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center text-neutral-grey text-xs">No Photo</div>
                                    )}
                                </div>
                                <label className="absolute -bottom-1 right-0 flex cursor-pointer items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-neutral-black shadow-md hover:bg-gray-50 transition-colors border border-neutral-grey/20">
                                    <FaUpload className="text-neutral-black/70" />
                                    <span>Change</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handlePhotoChange}
                                    />
                                </label>
                            </div>

                            <div className="space-y-1">
                                <h2 className="text-xl font-semibold text-neutral-black">{profile.name || "New User"}</h2>
                                <p className="text-sm text-neutral-black/70">{profile.email}</p>
                            </div>

                            <div className="flex flex-wrap items-center justify-center gap-2">
                                <span className="rounded-full bg-neutral-grey/20 px-3 py-1 text-xs font-medium text-neutral-black capitalize">
                                    {profile.role}
                                </span>
                                <span
                                    className={`rounded-full px-3 py-1 text-xs font-medium ${profile.verification === "verified"
                                            ? "bg-emerald-100 text-emerald-800"
                                            : profile.verification === "unverified"
                                                ? "bg-rose-100 text-rose-800"
                                                : "bg-amber-100 text-amber-800"
                                        }`}
                                >
                                    {verificationLabel}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-neutral-black/70">
                                {profile.verification === "verified" ? (
                                    <FaCheckCircle className="text-emerald-600" />
                                ) : (
                                    <FaTimesCircle className="text-rose-600" />
                                )}
                                <span>
                                    {profile.verification === "verified"
                                        ? "Your account is verified"
                                        : "Verification in progress"}
                                </span>
                            </div>
                        </div>
                    </article>

                    {/* Right Column: Edit Form */}
                    <article className="lg:col-span-2 rounded-2xl border border-neutral-grey/40 bg-white p-6 shadow-sm">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-4">
                            <h2 className="text-xl font-semibold text-neutral-black">Personal Information</h2>
                            <OutlineButton
                                text={saving ? "Saving..." : "Save Changes"}
                                onClick={handleSave}
                                disabled={saving}
                                className={saving ? "opacity-70 cursor-not-allowed" : "bg-primary-green text-white"}
                            />
                        </div>

                        <div className="mt-6 space-y-6">
                            {/* Row 1: Name & Phone */}
                            <div className="grid gap-4 md:grid-cols-2">
                                <OutlineInputField
                                    label="Full Name"
                                    value={profile.name}
                                    onChange={handleChange("name")}
                                    placeholder_="Enter your complete name"
                                />
                                <OutlineInputField
                                    label="Phone"
                                    type="tel"
                                    value={profile.phone}
                                    onChange={handleChange("phone")}
                                    placeholder_="e.g. +63 912 345 6789"
                                />
                            </div>

                            {/* Row 2: Email */}
                            <div className="grid gap-4 md:grid-cols-1">
                                <OutlineInputField
                                    label="Email Address"
                                    type="email"
                                    value={profile.email}
                                    onChange={handleChange("email")}
                                    placeholder_="you@example.com"
                                />
                            </div>

                            {/* Row 3: Bio */}
                            <div className="flex flex-col space-y-2">
                                <label className="text-sm font-medium text-neutral-black">Bio</label>
                                <textarea
                                    value={profile.bio}
                                    onChange={handleChange("bio")}
                                    className="min-h-[100px] w-full resize-none rounded-lg border border-neutral-grey/40 bg-white p-3 text-sm text-neutral-black focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-600 transition-all"
                                    placeholder="Tell us a bit about yourself..."
                                />
                            </div>

                            {/* Planner Specific Section */}
                            {isPlanner && (
                                <div className="pt-6 border-t space-y-6">
                                    <h3 className="text-lg font-semibold text-neutral-black">Professional Details</h3>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <OutlineInputField
                                            label="Business Name"
                                            value={profile.businessName}
                                            onChange={handleChange("businessName")}
                                            placeholder_="Your company name"
                                        />
                                        <OutlineInputField
                                            label="Portfolio Link"
                                            value={profile.portfolioLinks}
                                            onChange={handleChange("portfolioLinks")}
                                            placeholder_="https://portfolio.com"
                                        />
                                    </div>

                                    {/* ID Verification Box */}
                                    <div className="rounded-xl border border-dashed border-neutral-grey/60 bg-neutral-grey/5 p-5">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex gap-3">
                                                <div className="mt-1 text-neutral-black/60">
                                                    <FaIdCard size={24} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-neutral-black">Government ID Verification</p>
                                                    <p className="text-xs text-neutral-black/60 mt-1">
                                                        Required for planners to gain "Verified" status.
                                                        Upload a clear photo of your Passport or Driver's License.
                                                    </p>
                                                    <button
                                                        onClick={handleIdUpload}
                                                        className="mt-3 text-xs font-bold text-green-700 hover:underline flex items-center gap-1"
                                                    >
                                                        <FaUpload /> Click to upload document
                                                    </button>
                                                </div>
                                            </div>
                                            <span
                                                className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${profile.idStatus === "verified"
                                                        ? "bg-emerald-100 text-emerald-800"
                                                        : profile.idStatus === "unverified"
                                                            ? "bg-rose-100 text-rose-800"
                                                            : "bg-amber-100 text-amber-800"
                                                    }`}
                                            >
                                                {profile.idStatus}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end pt-4">
                                <OutlineButton
                                    text={saving ? "Saving..." : "Save Changes"}
                                    onClick={handleSave}
                                    disabled={saving}
                                    className={saving ? "opacity-70" : ""}
                                />
                            </div>
                        </div>
                    </article>
                </section>
            </div>
        </main>
    );
}