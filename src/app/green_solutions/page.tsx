"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import mapboxgl from "mapbox-gl";
import exifr from "exifr";
import { X } from "lucide-react";

import Navbar from "@/components/ui/general/layout/navbar";
import SidebarDiscovery from "@/components/ui/green_solutions/SidebarDiscovery";
import SidebarDetail from "@/components/ui/green_solutions/SidebarDetails";
import {
  BarangayProvider,
  useBarangay,
  type BarangayData,
} from "@/context/BarangayContext";
import { type SelectedFeature } from "@/types/metrics";
import { type LocationSelectionMode } from "@/types/maplayers";
import { type SidebarView, type GreenRecommendation } from "@/types/green_solutions";

// ---------------------------------------------------------------------------
// Lazy map import avoids SSR window errors
// ---------------------------------------------------------------------------
const MapWrapper = dynamic(() => import("@/components/map/map_wrapper"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-neutral-50 rounded-xl border-2 border-dashed border-neutral-200">
      <div className="text-neutral-400 flex flex-col items-center gap-2">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-green" />
        <span className="font-medium">Initializing Map...</span>
      </div>
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Search-param → context sync (must live inside BarangayProvider + Suspense)
// ---------------------------------------------------------------------------
function SearchParamSync({
  geoData,
  onFeatureFound,
}: {
  geoData: BarangayData[] | null;
  onFeatureFound: (f: SelectedFeature) => void;
}) {
  const searchParams = useSearchParams();
  const { setSelectedBarangay } = useBarangay();

  useEffect(() => {
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    if (!lat || !lng || !geoData) return;

    const latVal = parseFloat(lat);
    const lngVal = parseFloat(lng);
    const address = decodeURIComponent(searchParams.get("address") || "");
    const name = decodeURIComponent(
      searchParams.get("name") || "Selected Location",
    );
    const barangay = decodeURIComponent(searchParams.get("barangay") || "");

    onFeatureFound({
      name,
      address,
      barangay,
      coords: { lng: lngVal, lat: latVal },
    });

    const matched = geoData.find(
      (b) => b.name?.toLowerCase() === barangay.toLowerCase(),
    );
    if (matched) {
      setSelectedBarangay?.({
        ...matched,
        greeneryIndex: matched.greeneryIndex ?? 0,
        ndvi: matched.ndvi ?? 0,
        lst: matched.lst ?? 0,
        treeCanopy: matched.treeCanopy ?? 0,
      });
    }
  }, [searchParams, geoData, setSelectedBarangay, onFeatureFound]);

  return null;
}

function SelectedBarangaySync({
  geoData,
  selectedFeature,
}: {
  geoData: BarangayData[] | null;
  selectedFeature: SelectedFeature | null;
}) {
  const { setSelectedBarangay } = useBarangay();

  useEffect(() => {
    if (!geoData || !selectedFeature?.barangay) {
      setSelectedBarangay(null);
      return;
    }

    const matched = geoData.find(
      (barangay) =>
        normalizeBarangayName(barangay.name) ===
        normalizeBarangayName(selectedFeature.barangay),
    );

    setSelectedBarangay(
      matched
        ? {
            ...matched,
            greeneryIndex: matched.greeneryIndex ?? 0,
            ndvi: matched.ndvi ?? 0,
            lst: matched.lst ?? 0,
            treeCanopy: matched.treeCanopy ?? 0,
          }
        : null,
    );
  }, [geoData, selectedFeature, setSelectedBarangay]);

  return null;
}

function normalizeBarangayName(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/^barangay\s+/, "")
    .replace(/[^a-z0-9]/g, "");
}

function findSelectedBarangay(
  geoData: BarangayData[] | null,
  selectedFeature: SelectedFeature | null,
) {
  if (!geoData || !selectedFeature?.barangay) return null;

  return (
    geoData.find(
      (barangay) =>
        normalizeBarangayName(barangay.name) ===
        normalizeBarangayName(selectedFeature.barangay),
    ) ?? null
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function GreenSolutionsPage() {
  // Sidebar state 
  const [activeView, setActiveView] = useState<SidebarView>("LIST");
  const [selectedRecommendation, setSelectedRecommendation] =
    useState<GreenRecommendation | null>(null);

  // Map / location state 
  const [selectedFeature, setSelectedFeature] = useState<SelectedFeature | null>(null);
  const [geoData, setGeoData] = useState<BarangayData[] | null>(null);
  const [locationSelectionMode, setLocationSelectionMode] =
    useState<LocationSelectionMode>("poi");
  const [bottomExpanded, setBottomExpanded] = useState(false);

  // Image upload state 
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState<
    "no-gps" | "out-of-bounds" | null
  >(null);

  // Map refs 
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const removeMarkerRef = useRef<(() => void) | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  // Auto-open mobile sheet when a feature or image is present
  useEffect(() => {
    if (selectedFeature || imageUrl) setBottomExpanded(true);
  }, [selectedFeature, imageUrl]);

  // Load barangay GeoJSON for search-param sync
  useEffect(() => {
    fetch("/geo/mandaue_barangays_gi.geojson")
      .then((res) => res.json())
      .then((data: unknown) => {
        const rows = Array.isArray(data)
          ? data
          : Array.isArray((data as { features?: unknown[] })?.features)
            ? (data as { features: { properties?: Record<string, unknown> }[] }).features.map(
                (feature) => feature.properties ?? {},
              )
            : [];

        const mapped = rows.map((row) => {
          const properties = row as Record<string, unknown>;

          return {
            name: String(properties.name ?? ""),
            greeneryIndex: Number(properties.greenery_index ?? 0),
            ndvi: Number(properties.ndvi ?? 0),
            lst: Number(properties.lst ?? 0),
            treeCanopy: Number(properties.tree_canopy ?? 0),
            floodExposure: String(properties.flood_exposure ?? "Unknown"),
            currentIntervention: String(
              properties.current_intervention ?? "Unknown",
            ),
          };
        });

        setGeoData(mapped);
      });
  }, []);

  // Handlers
  const clearSelection = useCallback(() => {
    setSelectedFeature(null);
    setActiveView("LIST");
    setSelectedRecommendation(null);
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
      setImageUrl(null);
    }
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    removeMarkerRef.current?.();
  }, [imageUrl]);

  const handleFileUploaded = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !mapRef.current) return;

    setImageUrl(URL.createObjectURL(file));

    try {
      const gps = await exifr.gps(file);
      if (!gps?.latitude || !gps?.longitude) {
        setShowWarning("no-gps");
        return;
      }

      const { latitude: lat, longitude: lng } = gps;

      const point = mapRef.current.project([lng, lat]);
      const features = mapRef.current.queryRenderedFeatures(point, {
        layers: ["barangayBounds"],
      });
      const barangay = features[0]?.properties?.name as string | undefined;

      if (!barangay) {
        setShowWarning("out-of-bounds");
        clearSelection();
        return;
      }

      mapRef.current.flyTo({ center: [lng, lat], zoom: 16, speed: 1.2, essential: true });

      if (markerRef.current) markerRef.current.remove();
      markerRef.current = new mapboxgl.Marker({ color: "#DB4848" })
        .setLngLat([lng, lat])
        .addTo(mapRef.current);

      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxgl.accessToken}`,
      );
      const data = await res.json() as { features?: { place_name: string }[] };
      const address = data.features?.[0]?.place_name ?? "Detected Photo Location";

      setSelectedFeature({ name: "Photo Location", address, coords: { lng, lat }, barangay });
      setBottomExpanded(true);
    } catch (err) {
      console.error("EXIF Error:", err);
      setShowWarning("no-gps");
    }
  };

  // Fly to newly selected feature
  useEffect(() => {
    if (!selectedFeature?.coords || !mapRef.current) return;
    const { lng, lat } = selectedFeature.coords;
    if (lng === 0 && lat === 0) return;
    mapRef.current.flyTo({ center: [lng, lat], zoom: 16, speed: 1.2, essential: true });
    setBottomExpanded(true);
  }, [selectedFeature]);

  const handleFeatureSelected = useCallback((f: SelectedFeature) => {
    setSelectedFeature(f);
    setBottomExpanded(true);
  }, []);

  const handleSelectRecommendation = useCallback((rec: GreenRecommendation) => {
    setSelectedRecommendation(rec);
    setActiveView("DETAIL");
  }, []);

  const handleBackToList = useCallback(() => {
    setActiveView("LIST");
    setSelectedRecommendation(null);
  }, []);

  const selectedBarangayData = findSelectedBarangay(geoData, selectedFeature);

  // Sidebar content (shared between desktop + mobile)
  const sidebarContent =
    activeView === "DETAIL" && selectedRecommendation && selectedFeature ? (
      <SidebarDetail
        recommendation={selectedRecommendation}
        selectedFeature={selectedFeature}
        selectedBarangayData={selectedBarangayData}
        onBack={handleBackToList}
      />
    ) : (
      <SidebarDiscovery
        selectedFeature={selectedFeature}
        selectedBarangayData={selectedBarangayData}
        locationSelectionMode={locationSelectionMode}
        onSelectionModeChange={setLocationSelectionMode}
        onClearSelection={clearSelection}
        onUploadRequested={() => fileInputRef.current?.click()}
        onSelectRecommendation={handleSelectRecommendation}
      />
    );

  return (
    <BarangayProvider>
      <Suspense fallback={null}>
        <SearchParamSync geoData={geoData} onFeatureFound={setSelectedFeature} />
      </Suspense>
      <SelectedBarangaySync
        geoData={geoData}
        selectedFeature={selectedFeature}
      />

      <main className="min-h-screen w-full bg-gradient-to-br from-white to-green-50 font-roboto overflow-x-hidden">
        <Navbar />

        {/* Hidden file input for photo upload */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={fileInputRef}
          onChange={handleFileUploaded}
          className="hidden"
        />

        <div className="grid grid-cols-1 mt-0 lg:grid-cols-2 gap-8 p-4 lg:p-8 pt-28 lg:mt-20 h-screen">

          {/* Desktop sidebar (hidden on mobile) */}
          <div className="hidden lg:flex flex-col gap-6 overflow-hidden">
            {sidebarContent}
          </div>

          {/* Map panel — stable, never re-renders during sidebar transitions */}
          <div className="fixed inset-0 z-0 lg:relative lg:rounded-[2.5rem] overflow-hidden lg:shadow-2xl lg:border-8 lg:border-white group h-screen lg:h-auto">
            <MapWrapper
              searchBoxLocation="absolute top-6 left-4 right-4 z-10"
              onFeatureSelected={handleFeatureSelected}
              bottomExpanded={bottomExpanded}
              onBarangaySelected={(name) => {
                const matched = geoData?.find(
                  (b) => b.name.toLowerCase() === name.toLowerCase(),
                );
                if (matched)
                  setSelectedFeature({
                    name: matched.name,
                    address: "Barangay Coverage",
                    barangay: matched.name,
                    coords: { lng: 0, lat: 0 },
                  });
              }}
              onMapReady={(map, remove) => {
                mapRef.current = map;
                removeMarkerRef.current = remove;
              }}
              selectionMode={locationSelectionMode}
              onUploadRequested={() => fileInputRef.current?.click()}
              onSelectionModeChange={(m) => setLocationSelectionMode(m)}
            />

            {/* Photo preview overlay */}
            {imageUrl && selectedFeature?.name === "Photo Location" && (
              <div className="absolute top-6 right-6 z-10 animate-in fade-in zoom-in duration-300">
                <div className="bg-white/90 backdrop-blur-md p-1.5 rounded-2xl shadow-xl border border-white/50 group/img">
                  <div className="relative w-40 h-40 rounded-xl overflow-hidden">
                    <Image
                      src={imageUrl}
                      alt="Uploaded"
                      fill
                      className="object-cover"
                    />
                    <button
                      onClick={clearSelection}
                      className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <p className="text-[10px] font-bold text-neutral-400 text-center mt-1.5 uppercase">
                    Reference Image
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile bottom sheet (hidden on lg+) */}
        <div
          className={`fixed bottom-0 left-0 right-0 z-50 lg:hidden transition-transform duration-300 ease-in-out ${
            bottomExpanded
              ? "translate-y-0 pointer-events-auto"
              : "translate-y-full pointer-events-none"
          }`}
        >
          <div
            className="rounded-t-3xl bg-white/95 backdrop-blur-md border border-neutral-200 shadow-2xl flex flex-col"
            style={{ height: "70vh" }}
          >
            {/* Drag handle */}
            <div className="shrink-0 pt-3 pb-1 flex justify-center">
              <div
                className="w-12 h-1.5 bg-neutral-300 rounded-full cursor-pointer"
                onClick={() => setBottomExpanded((s) => !s)}
              />
            </div>

            {/* Sheet content — sidebar swap applies here too */}
            <div className="flex-1 flex flex-col gap-4 px-4 pb-4 overflow-hidden">
              <SidebarDiscovery
                compact
                selectedFeature={selectedFeature}
                selectedBarangayData={selectedBarangayData}
                locationSelectionMode={locationSelectionMode}
                onSelectionModeChange={setLocationSelectionMode}
                onClearSelection={() => {
                  clearSelection();
                  setBottomExpanded(false);
                }}
                onUploadRequested={() => fileInputRef.current?.click()}
                onSelectRecommendation={(rec) => {
                  setSelectedRecommendation(rec);
                  setActiveView("DETAIL");
                }}
              />
            </div>
          </div>
        </div>

        {/* Warning modals */}
        {showWarning && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[100] p-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full text-center space-y-6 animate-in zoom-in-95 duration-300">
              <div className="mx-auto w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
                <X size={32} />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-neutral-900">
                  {showWarning === "no-gps" ? "No GPS Found" : "Outside Coverage"}
                </h2>
                <p className="text-neutral-500 text-sm leading-relaxed">
                  {showWarning === "no-gps"
                    ? "The uploaded photo doesn't contain geolocation data. Please use a photo taken with GPS enabled."
                    : "This location is outside the Mandaue City barangay boundaries currently supported by our framework."}
                </p>
              </div>
              <button
                onClick={() => setShowWarning(null)}
                className="w-full py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all active:scale-95"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </main>
    </BarangayProvider>
  );
}

