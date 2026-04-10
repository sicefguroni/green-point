import type { Metadata } from "next";
import { Geist, Poppins, Roboto } from "next/font/google";
import { BarangayProvider } from "@/context/BarangayContext";
import { AppToaster } from "@/components/ui/toaster-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

/** Fewer weights = smaller font CSS + fewer WOFF2 downloads (Tailwind uses 400–900). */
const poppins = Poppins({
  weight: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  variable: "--poppins-font",
  display: "swap",
});

const roboto = Roboto({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--roboto-font",
  display: "swap",
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
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossOrigin="" />
        <link rel="preconnect" href="https://a.tile.openstreetmap.org" crossOrigin="" />
      </head>
      <body
        className={`${geistSans.variable} ${poppins.variable} ${roboto.variable} antialiased`}
      >
        <BarangayProvider>
          {children}
          <AppToaster />
        </BarangayProvider>
      </body>
    </html>
  );
}
