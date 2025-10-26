"use client";

import Navbar from "@/components/ui/general/layout/navbar";
import MapWrapper from "@/components/map/map_wrapper";

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