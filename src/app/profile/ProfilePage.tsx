"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FaCamera, FaCheckCircle, FaIdCard, FaTimesCircle, FaUpload } from "react-icons/fa";
import Navbar from "@/components/ui/general/layout/navbar";
import OutlineButton from "@/components/ui/general/inputs/outlinebutton";
import OutlineInputField from "@/components/ui/general/inputs/outlineinputfield";
import { UserRole, VerificationStatus } from "@/types/schema";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useUserProfile } from "@/context/UserProfileContext";
import AuthLoadingOverlay from "@/components/auth/AuthLoadingOverlay";
import {
  PROFILE_AVATARS_BUCKET,
  IDENTITY_DOCUMENTS_BUCKET,
  avatarObjectPath,
  identityDocObjectPath,
} from "@/lib/storage/paths";

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const DOC_MAX_BYTES = 10 * 1024 * 1024;

type ProfileRow = {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  address: string | null;
  bio: string | null;
  businessName: string | null;
  portfolioLinks: string | null;
  avatarUrl: string | null;
  avatarStoragePath: string | null;
  idDocumentPath: string | null;
  idDocumentFileName: string | null;
  hasCompletedOnboarding: boolean;
};

export default function ProfilePage() {
  const router = useRouter();
  const { refresh: refreshGlobalProfile } = useUserProfile();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const idInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingId, setUploadingId] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [bio, setBio] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [portfolioLinks, setPortfolioLinks] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarStoragePath, setAvatarStoragePath] = useState<string | null>(null);
  const [idDocumentPath, setIdDocumentPath] = useState<string | null>(null);
  const [idDocumentFileName, setIdDocumentFileName] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [role, setRole] = useState<UserRole>(UserRole.RESIDENT);
  const [verification, setVerification] = useState<VerificationStatus>(VerificationStatus.UNVERIFIED);

  const isPlanner = role === UserRole.CITY_PLANNER;

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setEmail(user.email ?? "");
      setEmailVerified(Boolean(user.email_confirmed_at));
      const meta = user.user_metadata ?? {};
      setRole((meta.role as UserRole) || UserRole.RESIDENT);

      const res = await fetch("/api/profile", { credentials: "same-origin" });
      let row: ProfileRow | null = null;
      if (res.ok) {
        const json = await res.json();
        row = json.profile as ProfileRow | null;
      }

      const first =
        row?.firstName ??
        (meta.first_name as string | undefined) ??
        "";
      const last =
        row?.lastName ??
        (meta.last_name as string | undefined) ??
        "";
      const combined = `${first} ${last}`.trim();
      setFullName(combined);

      setPhone(row?.phone ?? (meta.phone as string | undefined) ?? "");
      setAddress(row?.address ?? (meta.address as string | undefined) ?? "");
      setBio(row?.bio ?? (meta.bio as string | undefined) ?? "");
      setBusinessName(
        row?.businessName ?? (meta.business_name as string | undefined) ?? ""
      );
      setPortfolioLinks(
        row?.portfolioLinks ??
        (meta.portfolio_links as string | undefined) ??
        ""
      );
      setAvatarUrl(
        row?.avatarUrl ?? (meta.avatar_url as string | undefined) ?? null
      );
      setAvatarStoragePath(row?.avatarStoragePath ?? null);
      setIdDocumentPath(row?.idDocumentPath ?? null);
      setIdDocumentFileName(row?.idDocumentFileName ?? null);

      if (row?.idDocumentPath) {
        setVerification(VerificationStatus.PENDING);
      } else {
        setVerification(VerificationStatus.UNVERIFIED);
      }
    } finally {
      setLoading(false);
    }
  }, [refreshGlobalProfile]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const splitName = () => {
    const parts = fullName.trim().split(/\s+/);
    const firstName = parts[0] ?? "";
    const lastName = parts.slice(1).join(" ");
    return { firstName, lastName };
  };

  const handleSave = async () => {
    const { firstName, lastName } = splitName();
    const t = toast.loading("Saving your profile…");
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          firstName,
          lastName,
          phone: phone.trim() || null,
          address: address.trim() || null,
          bio: bio.trim() || null,
          businessName: businessName.trim() || null,
          portfolioLinks: portfolioLinks.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Could not save profile", { id: t });
        return;
      }
      toast.success("Profile saved", { id: t });
      await refreshGlobalProfile();
      await loadProfile();
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("Image must be 5MB or smaller");
      return;
    }

    setUploadingAvatar(true);
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You need to be signed in");
      setUploadingAvatar(false);
      return;
    }

    const path = avatarObjectPath(user.id, file.name);
    const toastId = toast.loading("Uploading photo…");


    try {
      if (avatarStoragePath) {
        await supabase.storage
          .from(PROFILE_AVATARS_BUCKET)
          .remove([avatarStoragePath]);
      }

      const { error: upErr } = await supabase.storage
        .from(PROFILE_AVATARS_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });

      if (upErr) {
        toast.error(upErr.message, { id: toastId });
        return;
      }

      const { data: pub } = supabase.storage
        .from(PROFILE_AVATARS_BUCKET)
        .getPublicUrl(path);

      const patchRes = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          avatarUrl: pub.publicUrl,
          avatarStoragePath: path,
        }),
      });
      const pj = (await patchRes.json().catch(() => ({}))) as { error?: string };
      if (!patchRes.ok) {
        toast.error(pj.error ?? "Could not save photo URL", { id: toastId });
        return;
      }

      setAvatarUrl(pub.publicUrl);
      setAvatarStoragePath(path);
      toast.success("Profile photo updated", { id: toastId });
      await refreshGlobalProfile();
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleIdFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > DOC_MAX_BYTES) {
      toast.error("File must be 10MB or smaller");
      return;
    }

    setUploadingId(true);
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You need to be signed in");
      setUploadingId(false);
      return;
    }

    const path = identityDocObjectPath(user.id, file.name);
    const toastId = toast.loading("Uploading document…");

    try {
      const { error: upErr } = await supabase.storage
        .from(IDENTITY_DOCUMENTS_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });

      if (upErr) {
        toast.error(upErr.message, { id: toastId });
        return;
      }

      const patchRes = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          idDocumentPath: path,
          idDocumentFileName: file.name,
        }),
      });
      const pj = (await patchRes.json().catch(() => ({}))) as { error?: string };
      if (!patchRes.ok) {
        toast.error(pj.error ?? "Could not save document reference", { id: toastId });
        return;
      }

      setIdDocumentPath(path);
      setIdDocumentFileName(file.name);
      toast.success("ID or document uploaded", { id: toastId });
      setVerification(VerificationStatus.PENDING);
    } finally {
      setUploadingId(false);
    }
  };

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/signout", { method: "POST", credentials: "include" });
      await refreshGlobalProfile();
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Could not sign out");
      setSigningOut(false);
    }
  }

  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    fullName || email || "User"
  )}&background=2DC937&color=fff`;
  const displayAvatar = avatarUrl || fallbackAvatar;

  return (
    <main className="relative min-h-screen bg-neutral-100 font-roboto">
      <Navbar />
      <AuthLoadingOverlay open={signingOut} message="Logging out…" />
      <AuthLoadingOverlay
        open={uploadingAvatar}
        message="Uploading profile photo…"
      />

      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary-green/5 rounded-full blur-[120px]" />
          <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-primary-green/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-20 pt-32 md:px-8">
        <header className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-green">
              Account Management
            </span>
            <h1 className="text-4xl font-black text-neutral-900 font-poppins tracking-tight">
              Personal Profile
            </h1>
            <p className="max-w-xl text-sm font-medium text-neutral-500 leading-relaxed">
              Manage your identity and preferences across the GreenPoint platform.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/home_dashboard"
              className="h-12 px-6 rounded-2xl bg-white border border-neutral-100 flex items-center justify-center text-sm font-bold text-neutral-600 hover:bg-neutral-50 transition-all shadow-sm"
            >
              Dashboard
            </Link>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="h-12 px-6 rounded-2xl bg-neutral-900 flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-white hover:bg-neutral-800 transition-all shadow-xl shadow-neutral-200 disabled:opacity-50"
            >
              Sign out
            </button>
          </div>
        </header>

        {loading ? (
          <div className="h-64 rounded-[2.5rem] bg-white/50 backdrop-blur-md flex items-center justify-center border border-white/50">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-primary-green/20 border-t-primary-green rounded-full animate-spin" />
              <span className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Loading Profile...</span>
            </div>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
            <aside className="space-y-6">
              <div className="bg-white/80 backdrop-blur-2xl rounded-[2.5rem] border border-white/50 p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.05)]">
                <div className="relative group mx-auto w-32 h-32 mb-6">
                  <div className="absolute inset-0 rounded-full bg-primary-green/10 animate-pulse group-hover:scale-110 transition-transform" />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="relative w-full h-full rounded-full overflow-hidden border-4 border-white shadow-xl"
                  >
                    <img
                      src={displayAvatar}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <FaCamera size={20} />
                    </div>
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(ev) => void handleAvatarFile(ev)}
                  />
                </div>
                
                <div className="text-center space-y-1">
                  <h3 className="font-black text-neutral-900 tracking-tight">
                    {fullName || "GreenPoint Member"}
                  </h3>
                  <p className="text-xs font-medium text-neutral-400">
                    {email}
                  </p>
                </div>

                <div className="mt-6 pt-6 border-t border-neutral-100 flex flex-col gap-2">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${emailVerified ? "bg-primary-green/10 text-primary-green" : "bg-amber-100 text-amber-700"}`}>
                    {emailVerified ? <FaCheckCircle size={12} /> : <FaTimesCircle size={12} />}
                    {emailVerified ? "Verified User" : "Unverified"}
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-50 text-neutral-400 text-[10px] font-black uppercase tracking-widest">
                    <FaIdCard size={12} />
                    {role.replace("_", " ")}
                  </div>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-2xl rounded-[2.5rem] border border-white/50 p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.05)] space-y-4">
                <div className="space-y-1">
                  <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Documents</h4>
                  <p className="text-xs font-medium text-neutral-500 leading-relaxed">
                    Identity and permits for official verification.
                  </p>
                </div>
                <input
                  ref={idInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={(ev) => void handleIdFile(ev)}
                />
                <button
                  onClick={() => idInputRef.current?.click()}
                  disabled={uploadingId}
                  className="w-full h-11 rounded-xl bg-primary-green/10 text-primary-green text-xs font-black uppercase tracking-widest hover:bg-primary-green/20 transition-all flex items-center justify-center gap-2"
                >
                  <FaUpload size={12} />
                  {uploadingId ? "Uploading..." : "Add Document"}
                </button>
                {idDocumentFileName && (
                  <p className="text-[10px] font-bold text-neutral-400 text-center truncate px-2">
                    {idDocumentFileName}
                  </p>
                )}
              </div>
            </aside>

            <section className="bg-white/80 backdrop-blur-2xl rounded-[2.5rem] border border-white/50 p-8 md:p-12 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.05)]">
              <div className="flex items-center justify-between mb-10 pb-6 border-b border-neutral-100">
                <h2 className="text-xl font-black text-neutral-900 font-poppins tracking-tight">Account Details</h2>
                <button
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="h-10 px-6 rounded-xl bg-primary-green text-white text-[10px] font-black uppercase tracking-widest hover:shadow-lg hover:shadow-green-100 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>

              <div className="space-y-8">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Full Name</label>
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full h-12 px-4 rounded-xl bg-neutral-50 border border-neutral-100 focus:border-primary-green focus:bg-white outline-none transition-all font-medium text-sm text-neutral-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Phone Number</label>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+63 ..."
                      className="w-full h-12 px-4 rounded-xl bg-neutral-50 border border-neutral-100 focus:border-primary-green focus:bg-white outline-none transition-all font-medium text-sm text-neutral-900"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Home Address</label>
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street, City, Region"
                    className="w-full h-12 px-4 rounded-xl bg-neutral-50 border border-neutral-100 focus:border-primary-green focus:bg-white outline-none transition-all font-medium text-sm text-neutral-900"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">About Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={4}
                    placeholder="Tell us about yourself..."
                    className="w-full p-4 rounded-xl bg-neutral-50 border border-neutral-100 focus:border-primary-green focus:bg-white outline-none transition-all font-medium text-sm text-neutral-900 resize-none"
                  />
                </div>

                <div className="pt-8 border-t border-neutral-100">
                  <h3 className="text-sm font-black text-neutral-900 uppercase tracking-widest mb-6">Professional Information</h3>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Organization</label>
                      <input
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="Organization or business"
                        className="w-full h-12 px-4 rounded-xl bg-neutral-50 border border-neutral-100 focus:border-primary-green focus:bg-white outline-none transition-all font-medium text-sm text-neutral-900"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Portfolio Link</label>
                      <input
                        value={portfolioLinks}
                        onChange={(e) => setPortfolioLinks(e.target.value)}
                        placeholder="https://..."
                        className="w-full h-12 px-4 rounded-xl bg-neutral-50 border border-neutral-100 focus:border-primary-green focus:bg-white outline-none transition-all font-medium text-sm text-neutral-900"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                   <button
                    onClick={() => void handleSave()}
                    disabled={saving}
                    className="w-full md:w-auto h-14 px-10 rounded-2xl bg-neutral-900 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-neutral-800 transition-all active:scale-[0.98] disabled:opacity-50 shadow-xl shadow-neutral-200"
                  >
                    {saving ? "Saving Changes..." : "Save Profile"}
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
