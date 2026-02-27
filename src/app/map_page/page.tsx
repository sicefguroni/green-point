"use client";

import Navbar from "@/components/ui/general/layout/navbar";
import MapWrapper from "@/components/map/map_wrapper";
import { useState, useCallback } from "react";
import { SelectedFeature } from "@/types/metrics";
import { X, ArrowRight } from "lucide-react";

export default function MapPage() {
  const [selectedFeature, setSelectedFeature] =
    useState<SelectedFeature | null>(null);

  const handleFeatureSelected = useCallback((feature: SelectedFeature) => {
    setSelectedFeature(feature);
  }, []);

  const handleClosePopup = useCallback(() => {
    setSelectedFeature(null);
  }, []);

  const handleGoToGreenSolutions = useCallback(() => {
    if (!selectedFeature) return;

    const params = new URLSearchParams({
      lng: selectedFeature.coords.lng.toString(),
      lat: selectedFeature.coords.lat.toString(),
      address: encodeURIComponent(selectedFeature.address),
      name: encodeURIComponent(selectedFeature.name),
      barangay: encodeURIComponent(selectedFeature.barangay),
    });
    window.location.href = `/green_solutions?${params.toString()}`;
  }, [selectedFeature]);

  return (
    <main className="h-screen w-screen relative bg-neutral-100 font-roboto overflow-hidden">
      <Navbar />

      <MapWrapper
        searchBoxLocation="absolute top-28 right-8 left-auto w-80 max-w-[calc(100vw-4rem)] z-10"
        onFeatureSelected={handleFeatureSelected}
      />

      {/* Modern Location Discovery Modal */}
      {selectedFeature && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-md flex justify-center items-center z-[100] animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full space-y-6 animate-in zoom-in-95 duration-300 border border-neutral-100">
            <div className="flex justify-between items-start">
              <div className="space-y-1 pr-4">
                <h2 className="text-2xl font-bold text-neutral-900 leading-tight">
                  Discover Solutions
                </h2>
                <p className="text-neutral-500 text-sm">
                  View recommendations for this area
                </p>
              </div>
              <button
                onClick={handleClosePopup}
                className="p-2 hover:bg-neutral-100 rounded-full text-neutral-400 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-100 space-y-1">
              <p className="font-bold text-neutral-800 truncate">
                {selectedFeature.name}
              </p>
              <p className="text-sm text-neutral-500 line-clamp-2">
                {selectedFeature.address}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleGoToGreenSolutions}
                className="w-full flex items-center justify-between bg-neutral-900 text-white px-6 py-4 rounded-2xl font-bold hover:bg-neutral-800 transition-all group active:scale-[0.98]"
              >
                <span>Show Green Solutions</span>
                <ArrowRight
                  size={20}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </button>

              <button
                onClick={handleClosePopup}
                className="w-full py-4 text-neutral-500 font-bold hover:text-neutral-700 transition-colors"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
