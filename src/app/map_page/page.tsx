"use client";

import Navbar from "@/components/ui/general/layout/navbar";
import MapWrapper from "@/components/map/map_wrapper";
import { useState } from "react";

interface Feature {
  name: string; 
  address: string; 
  coords: {
    lng: number;
    lat: number;
  };
  properties?: mapboxgl.GeoJSONFeature["properties"];
}

export default function MapPage() {
  const [showPageSwitch, setShowPageSwitch] = useState(false);  
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);

  const handleFeatureSelected = (feature: Feature) => {
    console.log("feature : ", feature)
    setSelectedFeature(feature);
    setShowPageSwitch(true);
  };

  const handleClosePopup = () => {
    setShowPageSwitch(false);
    setSelectedFeature(null);
  };

  const handleGoToGreenSolutions = () => {
    if (!selectedFeature) return;

    const params = new URLSearchParams({      
      lng: selectedFeature.coords.lng.toString(),
      lat: selectedFeature.coords.lat.toString(),
      address: encodeURIComponent(selectedFeature.address),
      name: encodeURIComponent(selectedFeature.name),
    });
    window.location.href = `/green_solutions?${params.toString()}`;
  };

  return (
    <main className="h-screen w-screen relative bg-gradient-to-br from-white to-green-100">
      <Navbar />
      <MapWrapper 
      searchBoxLocation="absolute top-27 left-8 w-80 z-10"
      onFeatureSelected={handleFeatureSelected}
      />

      {showPageSwitch && selectedFeature && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl w-96 text-center">
            <h2 className="text-lg font-semibold text-neutral-black mb-3">
              Show Greening Solutions?
            </h2>

            <div className="text-neutral-700 text-sm mb-4 space-y- bg-neutral-200 rounded-lg p-4 flex flex-col items-center justify-start">
              <p className="font-roboto font-medium text-lg text-neutral-black leading-tight">
                {selectedFeature.name}
              </p>   
              <p className="font-roboto font-regular text-sm text-neutral-black/70">
                {selectedFeature.address}
              </p>         
            </div>

            <p className="text-neutral-600 text-sm mb-4">
              Would you like to see the recommended greening interventions for this location?
            </p>

            <div className="flex flex-row gap-4 items-center justify-center">
              <button
                onClick={handleClosePopup}
                className="font-roboto px-4 py-2 bg-neutral-200 text-neutral-black rounded-lg hover:bg-neutral-300 transition-all"
              >
                No Thanks
              </button>

              <button
                onClick={handleGoToGreenSolutions}
                className="font-roboto px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}