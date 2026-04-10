import type { Metadata } from "next";
import { Geist, Geist_Mono, Poppins, Roboto } from "next/font/google";
import { BarangayProvider } from "@/context/BarangayContext";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href="/geo/mandaue_barangay_boundaries.json"
          as="fetch"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/geo/mandaue_barangays_gi.geojson"
          as="fetch"
          crossOrigin="anonymous"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${poppins.variable} ${roboto.variable} antialiased`}
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
      </body>
    </html>
  );
}
