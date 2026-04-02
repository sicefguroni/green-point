"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type UserProfileContextValue = {
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setDisplayName("");
        setAvatarUrl(null);
        setEmail(null);
        return;
      }

      setEmail(user.email ?? null);
      const meta = user.user_metadata ?? {};
      const first = (meta.first_name as string | undefined) ?? "";
      const last = (meta.last_name as string | undefined) ?? "";
      const metaName = `${first} ${last}`.trim();
      const metaAvatar = (meta.avatar_url as string | undefined) ?? null;

      const res = await fetch("/api/profile", { credentials: "same-origin" });
      if (res.ok) {
        const json: {
          profile: {
            firstName: string | null;
            lastName: string | null;
            avatarUrl: string | null;
          } | null;
        } = await res.json();
        const p = json.profile;
        const dbName = p
          ? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim()
          : "";
        setDisplayName(
          dbName || metaName || user.email?.split("@")[0] || "User"
        );
        setAvatarUrl(p?.avatarUrl ?? metaAvatar);
      } else {
        setDisplayName(metaName || user.email?.split("@")[0] || "User");
        setAvatarUrl(metaAvatar);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const supabase = createSupabaseBrowserClient();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  const value = useMemo(
    () => ({
      displayName,
      avatarUrl,
      email,
      loading,
      refresh,
    }),
    [displayName, avatarUrl, email, loading, refresh]
  );

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const ctx = useContext(UserProfileContext);
  if (!ctx) {
    throw new Error("useUserProfile must be used within UserProfileProvider");
  }
  return ctx;
}
