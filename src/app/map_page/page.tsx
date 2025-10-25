"use client";

import Navbar from "@/components/ui/general/layout/navbar";
import dynamic from "next/dynamic";

const MapWrapper = dynamic(() => import("@/components/map/map_wrapper"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-neutral-black/50">Loading map…</div>
    </div>
  ),
});

export default function MapPage() {
  return (
    <main className="h-screen w-screen relative bg-gradient-to-br from-white to-green-100">
      <Navbar />
      <MapWrapper 
      searchBoxLocation="absolute top-27 left-8 w-80 z-10"
      />
    </main>
  );
}