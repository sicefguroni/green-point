import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono, Poppins, Roboto } from "next/font/google";
import { BarangayProvider } from "@/context/BarangayContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { UserProfileProvider } from "@/context/UserProfileContext";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const poppins = Poppins({
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  variable: "--poppins-font",
});

const roboto = Roboto({
  weight: ["100", "300", "400", "500", "700", "900"],
  subsets: ["latin"],
  variable: "--roboto-font",
});

export const metadata: Metadata = {
  title: "Green Point",
  description:
    "GreenPoint is a Geographic Information System (GIS)-based framework designed to identify, evaluate, and recommend urban greening interventions in Mandaue City, Cebu.",
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

  return (
    <html
      lang="en"
      className={initialTheme === "dark" ? "dark" : undefined}
      style={{ colorScheme: initialTheme }}
    >
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${poppins.variable} ${roboto.variable} antialiased`}
      >
        <ThemeProvider
          initialTheme={initialTheme}
          themeFromCookie={themeFromCookie}
        >
          <UserProfileProvider>
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
