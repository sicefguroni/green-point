"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  MapPin,
  Phone,
  Sparkles,
  UserRound,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import AuthLoadingOverlay from "@/components/auth/AuthLoadingOverlay";
import "@/components/auth/auth.css";

const VERIFIED_TOAST_KEY = "gp:onboarding_verified_toast";

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  /** After email link: full document load so session cookies apply everywhere (fixes stale client). */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const pending = sessionStorage.getItem(VERIFIED_TOAST_KEY);
    if (pending === "1") {
      sessionStorage.removeItem(VERIFIED_TOAST_KEY);
      toast.success(
        "Email verified — you're signed in. Complete your profile below.",
      );
      return;
    }

    if (searchParams.get("verified") !== "1") return;

    sessionStorage.setItem(VERIFIED_TOAST_KEY, "1");
    window.location.replace(`${window.location.origin}/auth/onboarding`);
  }, [searchParams]);

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
          "Profile saved to your account. Connect DATABASE_URL to sync with the app database.",
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

  const inputClass = (name: string) =>
    `w-full rounded-2xl border bg-white/90 px-4 py-3.5 pl-11 text-[15px] font-medium text-neutral-900 shadow-sm outline-none transition placeholder:text-neutral-400 focus:ring-2 focus:ring-primary-green/35 ${
      errors[name]
        ? "border-rose-300 bg-rose-50/50 focus:border-rose-400"
        : "border-neutral-200 hover:border-neutral-300 focus:border-primary-green/60"
    }`;

  const completion =
    (form.firstName.trim() ? 1 : 0) +
    (form.lastName.trim() ? 1 : 0) +
    (form.address.trim() ? 1 : 0);

  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-gradient-to-b from-emerald-50/90 via-white to-neutral-50 font-poppins text-neutral-900 ${
        exiting ? "onboarding-exit" : ""
      }`}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-24 h-72 w-72 rounded-full bg-primary-green/10 blur-3xl" />
        <div className="absolute -right-16 bottom-20 h-80 w-80 rounded-full bg-emerald-200/25 blur-3xl" />
      </div>

      <AuthLoadingOverlay open={saving && !exiting} message="Saving your profile…" />

      {showConfirmation && (
        <div className="auth-overlay-fade fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/45 px-4 backdrop-blur-md">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-confirm-title"
            className="auth-card-anim w-full max-w-md rounded-3xl border border-white/60 bg-white p-8 shadow-2xl shadow-neutral-900/15"
          >
            <div className="mb-5 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-green/12 text-primary-green">
                <CheckCircle2 className="h-8 w-8" strokeWidth={1.75} />
              </div>
            </div>
            <h2
              id="onboarding-confirm-title"
              className="mb-1 text-center text-xl font-bold tracking-tight text-neutral-900"
            >
              Confirm your details
            </h2>
            <p className="mb-6 text-center text-sm text-neutral-500">
              We&apos;ll use this for your GreenPoint profile and city tools.
            </p>
            <div className="mb-8 space-y-3 rounded-2xl border border-neutral-100 bg-neutral-50/90 p-5">
              <div className="flex justify-between gap-4 border-b border-neutral-200/80 pb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Name
                </span>
                <span className="text-right font-semibold text-neutral-900">
                  {form.firstName} {form.lastName}
                </span>
              </div>
              {form.phone.trim() ? (
                <div className="flex justify-between gap-4 border-b border-neutral-200/80 pb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Phone
                  </span>
                  <span className="text-right font-medium text-neutral-800">
                    {form.phone}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Address
                </span>
                <span className="max-w-[60%] text-right text-sm font-medium leading-snug text-neutral-800">
                  {form.address}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmation(false)}
                className="flex-1 rounded-2xl border border-neutral-200 py-3.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={saving}
                className="flex-1 rounded-2xl bg-primary-green py-3.5 text-sm font-bold text-white shadow-lg shadow-primary-green/25 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save & continue"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-16 sm:px-6">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-green/20 bg-primary-green/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-800">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Profile setup
          </div>
          <h1 className="mb-3 text-3xl font-black tracking-tight text-neutral-900 sm:text-4xl">
            Welcome aboard
          </h1>
          <p className="mx-auto max-w-md text-[15px] leading-relaxed text-neutral-600">
            A quick profile helps us personalize maps, recommendations, and your
            dashboard.
          </p>
          <div
            className="mx-auto mt-6 flex max-w-xs justify-center gap-2"
            aria-hidden
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`h-2 flex-1 max-w-[4rem] rounded-full transition ${
                  completion > i ? "bg-primary-green" : "bg-neutral-200"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-neutral-200/80 bg-white/90 p-8 shadow-[0_24px_64px_-24px_rgba(15,23,42,0.18)] backdrop-blur-md sm:p-10 auth-card-anim">
          {error ? (
            <p
              role="alert"
              className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            >
              {error}
            </p>
          ) : null}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="onboarding-firstName"
                className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500"
              >
                First name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <UserRound
                  className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-neutral-400"
                  aria-hidden
                />
                <input
                  id="onboarding-firstName"
                  name="firstName"
                  placeholder="Maria"
                  value={form.firstName}
                  onChange={handleChange}
                  className={inputClass("firstName")}
                  autoComplete="given-name"
                />
              </div>
              {errors.firstName ? (
                <p className="mt-1.5 text-sm text-rose-600">{errors.firstName}</p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="onboarding-lastName"
                className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500"
              >
                Last name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <UserRound
                  className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-neutral-400"
                  aria-hidden
                />
                <input
                  id="onboarding-lastName"
                  name="lastName"
                  placeholder="Santos"
                  value={form.lastName}
                  onChange={handleChange}
                  className={inputClass("lastName")}
                  autoComplete="family-name"
                />
              </div>
              {errors.lastName ? (
                <p className="mt-1.5 text-sm text-rose-600">{errors.lastName}</p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="onboarding-phone"
                className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500"
              >
                Phone <span className="font-normal text-neutral-400">(optional)</span>
              </label>
              <div className="relative">
                <Phone
                  className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-neutral-400"
                  aria-hidden
                />
                <input
                  id="onboarding-phone"
                  name="phone"
                  type="tel"
                  placeholder="+63 …"
                  value={form.phone}
                  onChange={handleChange}
                  className={`${inputClass("phone")} border-neutral-200`}
                  autoComplete="tel"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="onboarding-address"
                className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500"
              >
                Street / barangay / city <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <MapPin
                  className="pointer-events-none absolute left-3.5 top-[1.125rem] h-[18px] w-[18px] text-neutral-400"
                  aria-hidden
                />
                <input
                  id="onboarding-address"
                  name="address"
                  placeholder="e.g. 12 Rizal St., Brgy. San Antonio, Quezon City"
                  value={form.address}
                  onChange={handleChange}
                  className={inputClass("address")}
                  autoComplete="street-address"
                />
              </div>
              {errors.address ? (
                <p className="mt-1.5 text-sm text-rose-600">{errors.address}</p>
              ) : null}
            </div>

            <button
              type="submit"
              className="mt-2 w-full rounded-2xl bg-neutral-900 py-4 text-sm font-black uppercase tracking-[0.18em] text-white shadow-xl shadow-neutral-900/15 transition hover:bg-neutral-800 active:scale-[0.99]"
            >
              Continue
            </button>
          </form>
          <p className="mt-5 text-center text-xs text-neutral-500">
            <span className="text-rose-500">*</span> Required — you can update
            these later in Profile.
          </p>
        </div>
      </div>
    </main>
  );
}
