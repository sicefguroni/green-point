import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BarangayProvider } from "@/context/BarangayContext";
import "./globals.css";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Green Point",
  description: "GreenPoint is a Geographic Information System (GIS)-based framework designed to identify, evaluate, and recommend urban greening interventions in Mandaue City, Cebu.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <BarangayProvider>
          {children}
        </BarangayProvider>
      </body>
    </html>
  );
}
