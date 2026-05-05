"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, ListCheck, LogOut, Mail, Moon, PencilLine, ShieldCheck, Sun } from "lucide-react";
import Navbar from "@/components/ui/general/layout/navbar";
import { useTheme } from "@/context/ThemeContext";
import { useUserProfile } from "@/context/UserProfileContext";
import {
  CHATBOT_SYSTEM_PROMPT_STORAGE_KEY,
  normalizeSystemPromptOverride,
} from "@/lib/ai/chat-prompt";
import {
  PASSWORD_HINT_SHORT,
  PASSWORD_POLICY_SR_NOTE,
  passwordMeetsPolicy,
} from "@/lib/auth/password-policy";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type PasswordFormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function formatProviderLabel(provider: string | null) {
  if (!provider) return "Unknown";
  if (provider === "email") return "Email + password";

  return provider
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function SettingsPage() {
  const router = useRouter();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { email, loading: profileLoading, refresh } = useUserProfile();
  const [hasCustomChatbotPrompt, setHasCustomChatbotPrompt] = useState(false);
  const [authProvider, setAuthProvider] = useState<string | null>(null);
  const [hasPasswordLogin, setHasPasswordLogin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const storedPrompt = window.localStorage.getItem(
        CHATBOT_SYSTEM_PROMPT_STORAGE_KEY,
      );
      setHasCustomChatbotPrompt(Boolean(normalizeSystemPromptOverride(storedPrompt)));
    } catch {
      setHasCustomChatbotPrompt(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadAccountInfo() {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!active) return;

        const provider =
          typeof user?.app_metadata?.provider === "string"
            ? user.app_metadata.provider
            : null;
        const identityProviders = (user?.identities ?? [])
          .map((identity) => identity?.provider)
          .filter(isString);

        setAuthProvider(provider ?? identityProviders[0] ?? null);
        setHasPasswordLogin(
          provider === "email" || identityProviders.includes("email"),
        );
      } finally {
        if (active) {
          setAuthLoading(false);
        }
      }
    }

    void loadAccountInfo();

    return () => {
      active = false;
    };
  }, []);

  const authMethodLabel = authLoading
    ? "Checking account type..."
    : formatProviderLabel(authProvider);
  const accountEmail =
    email ?? "Your email address will appear here once the profile finishes loading.";
  const accountLoading = profileLoading || authLoading;

  function updatePasswordField(field: keyof PasswordFormState) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      setPasswordForm((current) => ({
        ...current,
        [field]: value,
      }));
      setPasswordError(null);
      setPasswordMessage(null);
    };
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      await fetch("/api/auth/signout", {
        method: "POST",
        credentials: "include",
      }).catch(() => undefined);
      await refresh().catch(() => undefined);
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Could not sign out");
    } finally {
      setSigningOut(false);
    }
  }

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordMessage(null);

    if (!hasPasswordLogin) {
      return;
    }

    const currentEmail = email?.trim();
    if (!currentEmail) {
      setPasswordError("Your email address is not available right now.");
      return;
    }

    if (!passwordMeetsPolicy(passwordForm.newPassword)) {
      setPasswordError(
        "That password is not strong enough yet. Check the hint and try again.",
      );
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    if (!passwordForm.currentPassword) {
      setPasswordError("Enter your current password to confirm the change.");
      return;
    }

    setChangingPassword(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password: passwordForm.currentPassword,
      });

      if (signInError) {
        setPasswordError("Current password is incorrect.");
        toast.error("Current password is incorrect.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (updateError) {
        setPasswordError(updateError.message);
        toast.error(updateError.message);
        return;
      }

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setPasswordMessage(
        "Password updated. Use the new password the next time you sign in.",
      );
      toast.success("Password updated");
      await refresh().catch(() => undefined);
    } finally {
      setChangingPassword(false);
    }
  }

  const passwordLoadingCard = (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-gradient-to-br from-emerald-50 to-lime-100 dark:from-emerald-900/40 dark:to-lime-800/30 rounded-lg">
          <ShieldCheck className="w-6 h-6 text-primary-green dark:text-lime-300" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
            Change password
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Checking whether this account can use a password.
          </p>
        </div>
      </div>
      <div className="mt-6 space-y-3">
        <div className="h-11 rounded-2xl bg-neutral-100 dark:bg-neutral-700 animate-pulse" />
        <div className="h-11 rounded-2xl bg-neutral-100 dark:bg-neutral-700 animate-pulse" />
        <div className="h-11 rounded-2xl bg-neutral-100 dark:bg-neutral-700 animate-pulse" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900 transition-colors">
      <Navbar />

      {/* Main Content */}
      <div className="pt-24 sm:pt-28 md:pt-32 px-4 sm:px-6 md:px-8 lg:px-10 pb-10">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-10 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-green">
              Settings
            </p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-neutral-900 dark:text-white">
              Account and app preferences
            </h1>
            <p className="max-w-2xl text-neutral-600 dark:text-neutral-400 text-sm sm:text-base leading-relaxed">
              Manage account security, appearance, and the assistant behavior in one place.
            </p>
          </div>

          <div className="space-y-10">
            <section className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-green">
                    Account
                  </p>
                  <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
                    Sign-in & security
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  disabled={signingOut}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-neutral-900 px-5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
                >
                  <LogOut className="h-4 w-4" />
                  {signingOut ? "Signing out..." : "Sign out"}
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="p-3 bg-gradient-to-br from-emerald-50 to-lime-100 dark:from-emerald-900/40 dark:to-lime-800/30 rounded-lg">
                        <Mail className="w-6 h-6 text-primary-green dark:text-lime-300" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                          Signed in as
                        </p>
                        {accountLoading ? (
                          <div className="mt-2 h-6 w-56 rounded-full bg-neutral-100 dark:bg-neutral-700 animate-pulse" />
                        ) : (
                          <h3 className="mt-1 truncate text-lg font-semibold text-neutral-900 dark:text-white">
                            {accountEmail}
                          </h3>
                        )}
                        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                          {accountLoading
                            ? "Checking how this account signs in..."
                            : hasPasswordLogin
                              ? "You can update your password from this panel."
                              : `You sign in with ${authMethodLabel}. Password changes are managed by that provider.`}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600 dark:bg-neutral-700 dark:text-neutral-200">
                        {authMethodLabel}
                      </span>
                      {hasPasswordLogin && (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                          Password enabled
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {accountLoading ? (
                  passwordLoadingCard
                ) : hasPasswordLogin ? (
                  <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-gradient-to-br from-emerald-50 to-lime-100 dark:from-emerald-900/40 dark:to-lime-800/30 rounded-lg">
                        <ShieldCheck className="w-6 h-6 text-primary-green dark:text-lime-300" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                          Change password
                        </h3>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                          Re-enter your current password, then choose a stronger new one.
                        </p>
                      </div>
                    </div>

                    <form className="mt-6 space-y-5" onSubmit={handlePasswordSubmit}>
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
                            Current password
                          </span>
                          <input
                            type="password"
                            autoComplete="current-password"
                            value={passwordForm.currentPassword}
                            onChange={updatePasswordField("currentPassword")}
                            className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-primary-green focus:ring-2 focus:ring-primary-green/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            disabled={changingPassword}
                          />
                        </label>

                        <label className="space-y-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
                            New password
                          </span>
                          <input
                            type="password"
                            autoComplete="new-password"
                            minLength={12}
                            value={passwordForm.newPassword}
                            onChange={updatePasswordField("newPassword")}
                            className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-primary-green focus:ring-2 focus:ring-primary-green/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            disabled={changingPassword}
                          />
                        </label>
                      </div>

                      <label className="space-y-2 block">
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
                          Confirm new password
                        </span>
                        <input
                          type="password"
                          autoComplete="new-password"
                          minLength={12}
                          value={passwordForm.confirmPassword}
                          onChange={updatePasswordField("confirmPassword")}
                          className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-primary-green focus:ring-2 focus:ring-primary-green/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                          disabled={changingPassword}
                        />
                      </label>

                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {PASSWORD_HINT_SHORT}
                      </p>
                      <p className="sr-only">{PASSWORD_POLICY_SR_NOTE}</p>

                      {passwordError && (
                        <div
                          className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200"
                          role="alert"
                        >
                          {passwordError}
                        </div>
                      )}

                      {passwordMessage && (
                        <div
                          className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
                          role="status"
                        >
                          {passwordMessage}
                        </div>
                      )}

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          Updating the password keeps your current session active.
                        </p>
                        <button
                          type="submit"
                          disabled={changingPassword}
                          className="inline-flex h-11 items-center justify-center rounded-full bg-primary-green px-5 text-sm font-semibold text-white transition hover:bg-primary-green/90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <KeyRound className="mr-2 h-4 w-4" />
                          {changingPassword ? "Updating..." : "Update password"}
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-700 dark:to-neutral-600 rounded-lg">
                        <ShieldCheck className="w-6 h-6 text-neutral-700 dark:text-neutral-200" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                          Password managed externally
                        </h3>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                          {`You sign in with ${authMethodLabel}, so password changes are handled by that account provider.`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-green">
                  Preferences
                </p>
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
                  Appearance
                </h2>
              </div>

              <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-700 dark:to-neutral-600 rounded-lg">
                      {isDarkMode ? (
                        <Moon className="w-6 h-6 text-neutral-700 dark:text-yellow-300" />
                      ) : (
                        <Sun className="w-6 h-6 text-yellow-500" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                        Dark Mode
                      </h3>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        {isDarkMode
                          ? "Dark mode is enabled"
                          : "Light mode is enabled"}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={toggleDarkMode}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                      isDarkMode
                        ? "bg-primary-green"
                        : "bg-neutral-300 dark:bg-neutral-600"
                    }`}
                    role="switch"
                    aria-checked={isDarkMode}
                    aria-label="Toggle dark mode"
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                        isDarkMode ? "translate-x-7" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-green">
                  Assistant
                </p>
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
                  Chatbot instructions
                </h2>
              </div>

              <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-emerald-50 to-lime-100 dark:from-emerald-900/40 dark:to-lime-800/30 rounded-lg">
                      <ListCheck className="w-6 h-6 text-primary-green dark:text-lime-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                          Chatbot Instructions
                        </h3>
                        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600 dark:bg-neutral-700 dark:text-neutral-200">
                          {hasCustomChatbotPrompt ? "Custom" : "Default"}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                        {hasCustomChatbotPrompt
                          ? "A custom assistant prompt is active in this browser."
                          : "Edit how the GreenPoint assistant responds to your questions."}
                      </p>
                    </div>
                  </div>

                  <Link
                    href="/settings/chatbot-prompt"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 transition-colors hover:border-primary-green hover:text-primary-green dark:border-neutral-700 dark:text-neutral-200 dark:hover:border-primary-green dark:hover:text-primary-green"
                    aria-label="Edit chatbot system prompt"
                  >
                    <PencilLine className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-green">
                  Privacy & Data
                </p>
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
                  Coming soon
                </h2>
              </div>

              <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-6 text-center">
                <p className="text-neutral-500 dark:text-neutral-400 text-sm">
                  Export data, local preference reset, and account deletion can live here next.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
