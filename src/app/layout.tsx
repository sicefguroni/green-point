import type { Metadata } from "next";
import { cookies } from "next/headers";
import { BarangayProvider } from "@/context/BarangayContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { UserProfileProvider } from "@/context/UserProfileContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Green Point",
  description:
    "GreenPoint is a Geographic Information System (GIS)-based framework designed to identify, evaluate, and recommend urban greening interventions in Mandaue City, Cebu.",
  icons: {
    icon: "/images/logo/greenpointlogo.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("theme")?.value;
  const initialTheme = themeCookie === "dark" ? "dark" : "light";
  const themeFromCookie = themeCookie === "dark" || themeCookie === "light";
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const initialIsAuthenticated = Boolean(user);

  return (
    <html
      lang="en"
      className={initialTheme === "dark" ? "dark" : undefined}
      style={{ colorScheme: initialTheme }}
    >
      <body className="antialiased">
        <ThemeProvider
          initialTheme={initialTheme}
          themeFromCookie={themeFromCookie}
        >
          <UserProfileProvider initialIsAuthenticated={initialIsAuthenticated}>
            <BarangayProvider>{children}</BarangayProvider>
            <Toaster
              position="top-center"
              richColors
              closeButton
              toastOptions={{
                classNames: {
                  toast: "font-poppins",
                  title: "font-poppins",
                  description: "font-poppins",
                },
              }}
            />
          </UserProfileProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
