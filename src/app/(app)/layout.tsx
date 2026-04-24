import { UserProfileProvider } from "@/context/UserProfileContext";

/**
 * Authenticated app shell: profile context + Supabase session work only for these routes,
 * not for marketing/auth pages — faster landing TTI and smaller first compile for `/`.
 */
export default function AppShellLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <UserProfileProvider initialIsAuthenticated={false}>
      {children}
    </UserProfileProvider>
  );
}
