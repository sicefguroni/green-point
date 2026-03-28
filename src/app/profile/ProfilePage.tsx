"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FaCamera, FaCheckCircle, FaIdCard, FaTimesCircle, FaUpload } from "react-icons/fa";
import Navbar from "@/components/ui/general/layout/navbar";
import OutlineButton from "@/components/ui/general/inputs/outlinebutton";
import OutlineInputField from "@/components/ui/general/inputs/outlineinputfield";
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
    } finally {
      setLoading(false);
    }
  }, []);

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
    <main className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 font-poppins">
      <Navbar />
      <AuthLoadingOverlay open={signingOut} message="Logging out…" />
      <AuthLoadingOverlay
        open={uploadingAvatar}
        message="Uploading profile photo…"
      />

      <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-28 md:px-8">
        <header className="mb-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-darkgreen">
              Account
            </p>
            <h1 className="mt-1 text-3xl font-bold text-neutral-black md:text-4xl">
              Your profile
            </h1>
            <p className="mt-2 max-w-xl text-sm text-neutral-black/65">
              Update how you appear across GreenPoint, manage your photo, and
              store verification documents securely.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch md:w-auto md:justify-end">
            <Link
              href="/home_dashboard"
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-neutral-black/15 bg-white px-4 py-2.5 text-center text-sm font-semibold text-neutral-black shadow-sm transition hover:bg-neutral-50 sm:flex-initial sm:min-w-[9.5rem]"
            >
              Dashboard
            </Link>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-neutral-black px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60 sm:flex-initial sm:min-w-[9.5rem]"
            >
              Sign out
            </button>
          </div>
        </header>

        {loading ? (
          <div className="rounded-2xl border border-neutral-black/10 bg-white/80 p-12 text-center text-neutral-black/60">
            Loading profile…
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,320px)_1fr]">
            <section className="h-fit space-y-6">
              <div className="rounded-2xl border border-neutral-black/10 bg-white p-6 shadow-sm">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="group relative mx-auto flex h-36 w-36 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-primary-green/40 bg-emerald-50/50 shadow-inner outline-none ring-offset-2 transition hover:border-primary-green hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-green disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Upload profile photo"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- user-controlled dynamic URLs */}
                  <img
                    src={displayAvatar}
                    alt=""
                    className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                  />
                  <span className="absolute inset-0 flex flex-col items-center justify-end bg-gradient-to-t from-black/55 via-black/10 to-transparent pb-3 text-[11px] font-semibold text-white opacity-0 transition group-hover:opacity-100">
                    <FaCamera className="mb-0.5" aria-hidden />
                    Change photo
                  </span>
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  aria-label="Upload profile photo"
                  onChange={(ev) => void handleAvatarFile(ev)}
                />
                <p className="mt-4 text-center text-sm font-semibold text-neutral-black">
                  {fullName || email?.split("@")[0] || "Member"}
                </p>
                <p className="text-center text-xs text-neutral-black/55">{email}</p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${emailVerified
                      ? "bg-emerald-100 text-emerald-900"
                      : "bg-amber-100 text-amber-900"
                      }`}
                  >
                    {emailVerified ? (
                      <FaCheckCircle aria-hidden />
                    ) : (
                      <FaTimesCircle aria-hidden />
                    )}
                    {emailVerified ? "Email verified" : "Verify your email"}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-black/10 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-primary-darkgreen">
                    <FaIdCard className="h-6 w-6" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold text-neutral-black">
                      Upload ID or relevant files
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-black/60">
                      Store a government ID, permit, or other document for
                      verification. Files are kept in your private storage
                      folder.
                    </p>
                    <input
                      ref={idInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="hidden"
                      aria-label="Upload ID or verification document"
                      onChange={(ev) => void handleIdFile(ev)}
                    />
                    <button
                      type="button"
                      onClick={() => idInputRef.current?.click()}
                      disabled={uploadingId}
                      className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-primary-darkgreen hover:underline disabled:opacity-50"
                    >
                      <FaUpload aria-hidden />
                      {uploadingId ? "Uploading…" : "Choose file"}
                    </button>
                    {(idDocumentPath || idDocumentFileName) && (
                      <p className="mt-2 truncate text-xs text-neutral-black/70">
                        On file: {idDocumentFileName ?? idDocumentPath}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-neutral-black/10 bg-white p-6 shadow-sm md:p-8">
              <div className="flex flex-col gap-4 border-b border-neutral-black/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold text-neutral-black">
                  Personal information
                </h2>
                <OutlineButton
                  text={saving ? "Saving…" : "Save changes"}
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className={
                    saving ? "opacity-70 cursor-not-allowed" : "bg-primary-green text-white"
                  }
                />
              </div>

              <div className="mt-8 space-y-6">
                <div className="grid gap-4 md:grid-cols-2 md:items-end">
                  <OutlineInputField
                    compact
                    label="Full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder_="Your full name"
                  />
                  <OutlineInputField
                    compact
                    label="Phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder_="+63 …"
                  />
                </div>

                <OutlineInputField
                  compact
                  label="Email"
                  type="email"
                  value={email}
                  readOnly
                  onChange={() => { }}
                  placeholder_="you@example.com"
                />
                <p className="-mt-4 text-xs text-neutral-black/50">
                  Email changes use Supabase account settings; this field is
                  read-only here.
                </p>

                <OutlineInputField
                  compact
                  label="Address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder_="Street, city, region"
                />

                <div>
                  <label className="text-sm font-medium text-neutral-black">
                    Bio
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={4}
                    className="mt-2 w-full resize-none rounded-xl border border-neutral-black/15 bg-white p-3 text-sm text-neutral-black outline-none transition focus:border-primary-green focus:ring-2 focus:ring-primary-green/20"
                    placeholder="A short introduction…"
                  />
                </div>

                <div className="border-t border-neutral-black/10 pt-6">
                  <h3 className="text-lg font-semibold text-neutral-black">
                    Professional (optional)
                  </h3>
                  <p className="mt-1 text-xs text-neutral-black/55">
                    Useful for planners, consultants, and partner organizations.
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2 md:items-end">
                    <OutlineInputField
                      compact
                      label="Organization or business"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder_="Company or team"
                    />
                    <OutlineInputField
                      compact
                      label="Portfolio or website"
                      value={portfolioLinks}
                      onChange={(e) => setPortfolioLinks(e.target.value)}
                      placeholder_="https://…"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <OutlineButton
                    text={saving ? "Saving…" : "Save changes"}
                    onClick={() => void handleSave()}
                    disabled={saving}
                    className={saving ? "opacity-70" : "bg-primary-green text-white"}
                  />
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
