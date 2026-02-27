"use client";

import Navbar from "@/components/ui/general/layout/navbar";
import {
  MapPin,
  Trees,
  Flower,
  X,
  Cookie,
  ImageIcon,
  Camera,
  Leaf,
  Sprout,
  TreeDeciduous,
  Thermometer,
  CircleHelp,
} from "lucide-react";
import GreenSolutionCard from "@/components/ui/general/cards/greensolution-infocard";
import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import mapboxgl from "mapbox-gl";
import {
  BarangayProvider,
  useBarangay,
  BarangayData,
} from "@/context/BarangayContext";
import exifr from "exifr";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { getGreeneryClassColor } from "@/lib/chloroplet-colors";
import BarangayMetricItem from "./barangaydetails";
import { type LocationSelectionMode } from "@/types/maplayers";
import { SelectedFeature } from "@/types/metrics";

/**
 * Dynamically import the map to avoid SSR issues
 */
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

/**
 * Displays metrics for the selected barangay
 */
function MetricsDashboard() {
  const { selectedBarangay } = useBarangay();
  if (!selectedBarangay) return null;

  const classColor = getGreeneryClassColor(selectedBarangay.greeneryIndex || 0);
  const [textColor, bgColor] = classColor.split(" ");

  return (
    <div className="flex flex-col items-center gap-4 w-full animate-in fade-in slide-in-from-top-4 duration-500">
      <h3
        className={`w-full ${bgColor} ${textColor} text-sm font-bold rounded-lg py-2 px-4 text-center uppercase tracking-wide`}
      >
        {selectedBarangay.name
          ? `Barangay ${selectedBarangay.name} Metrics`
          : "Regional Metrics"}
      </h3>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full">
        <BarangayMetricItem
          icon={Leaf}
          label="Greenery Index"
          value={selectedBarangay.greeneryIndex ?? 0}
        />
        <BarangayMetricItem
          icon={Sprout}
          label="NDVI"
          value={selectedBarangay.ndvi ?? 0}
        />
        <BarangayMetricItem
          icon={TreeDeciduous}
          label="Tree Canopy"
          value={selectedBarangay.treeCanopy ?? 0}
        />
        <BarangayMetricItem
          icon={Thermometer}
          label="Surface Temp"
          value={selectedBarangay.lst ?? 0}
          isTemperature
        />
      </div>
    </div>
  );
}

/**
 * Component to sync search parameters with the barangay context
 */
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

    const feature: SelectedFeature = {
      name,
      address,
      barangay,
      coords: { lng: lngVal, lat: latVal },
    };

    onFeatureFound(feature);

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

/**
 * Main Greening Solutions Page
 */
export default function GreenSolutionsPage() {
  const [selectedFeature, setSelectedFeature] =
    useState<SelectedFeature | null>(null);
  const [geoData, setGeoData] = useState<BarangayData[] | null>(null);
  const [locationSelectionMode, setLocationSelectionMode] =
    useState<LocationSelectionMode>("poi");
  const [bottomExpanded, setBottomExpanded] = useState(false);

  // Image Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState<
    "no-gps" | "out-of-bounds" | null
  >(null);

  // Derive drawer open state (auto-open when selection or image exists)
  useEffect(() => {
    if (selectedFeature || imageUrl) setBottomExpanded(true);
  }, [selectedFeature, imageUrl]);

  // Map Refs
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const removeMarkerRef = useRef<(() => void) | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  // Load GeoData for sync
  useEffect(() => {
    fetch("/geo/mandaue_barangays_gi.geojson")
      .then((res) => res.json())
      .then((data: any) => {
        const mapped =
          data.features?.map((f: any) => ({
            name: f.properties.name,
            greeneryIndex: f.properties.greenery_index,
            ndvi: f.properties.ndvi,
            lst: f.properties.lst,
            treeCanopy: f.properties.tree_canopy,
            floodExposure: f.properties.flood_exposure,
            currentIntervention: f.properties.current_intervention,
          })) || [];
        setGeoData(mapped);
      });
  }, []);

  // Cleanup marker and feature
  const clearSelection = useCallback(() => {
    setSelectedFeature(null);
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

  /**
   * Handle Photo Upload and EXIF Parsing
   */
  const handleFileUploaded = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !mapRef.current) return;

    const url = URL.createObjectURL(file);
    setImageUrl(url);

    try {
      const gps = await exifr.gps(file);
      if (!gps?.latitude || !gps?.longitude) {
        setShowWarning("no-gps");
        return;
      }

      const { latitude: lat, longitude: lng } = gps;

      // Check if within our boundaries
      const point = mapRef.current.project([lng, lat]);
      const features = mapRef.current.queryRenderedFeatures(point, {
        layers: ["barangayBounds"],
      });
      const barangay = features[0]?.properties?.name;

      if (!barangay) {
        setShowWarning("out-of-bounds");
        clearSelection();
        return;
      }

      // Smooth move to location
      mapRef.current.flyTo({
        center: [lng, lat],
        zoom: 16,
        speed: 1.2,
        essential: true,
      });

      // Add visual marker
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = new mapboxgl.Marker({ color: "#DB4848" })
        .setLngLat([lng, lat])
        .addTo(mapRef.current);

      // Resolve Address
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxgl.accessToken}`,
      );
      const data = await res.json();
      const address =
        data.features?.[0]?.place_name || "Detected Photo Location";

      setSelectedFeature({
        name: "Photo Location",
        address,
        coords: { lng, lat },
        barangay,
      });
      // expand bottom sheet when photo location is set
      setBottomExpanded(true);
    } catch (err) {
      console.error("EXIF Error:", err);
      setShowWarning("no-gps");
    }
  };

  // When a feature is selected (via map), center the map and expand sheet
  useEffect(() => {
    if (!selectedFeature?.coords || !mapRef.current) return;
    const { lng, lat } = selectedFeature.coords;
    if (lng === 0 && lat === 0) return;
    mapRef.current.flyTo({ center: [lng, lat], zoom: 16, speed: 1.2, essential: true });
    setBottomExpanded(true);
  }, [selectedFeature]);

  // Ensure bottom sheet opens when a feature is selected from the map
  const handleFeatureSelected = useCallback(
    (f: SelectedFeature) => {
      console.debug("Page: handleFeatureSelected received ->", f);
      setSelectedFeature(f);
      setBottomExpanded(true);
    },
    [],
  );

  return (
    <BarangayProvider>
      <Suspense fallback={null}>
        <SearchParamSync
          geoData={geoData}
          onFeatureFound={setSelectedFeature}
        />
      </Suspense>

      <main className="min-h-screen w-full bg-gradient-to-br from-white to-green-50 font-roboto overflow-x-hidden">
        <Navbar />

        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={fileInputRef}
          onChange={handleFileUploaded}
          className="hidden"
        />

        <div className="grid grid-cols-1 mt-0 lg:grid-cols-2 gap-8 p-4 lg:p-8 pt-28 lg:mt-20 h-screen">
          {/* Desktop Sidebar (hidden on mobile) */}
          <div className="hidden lg:flex flex-col gap-6 overflow-hidden ">
            <header className="space-y-2">
              <h1 className="text-3xl font-bold text-neutral-900 tracking-tight">
                Greening Suggestions
              </h1>
              <p className="text-neutral-500 text-lg leading-relaxed">
                Discover site-specific greening interventions to mitigate
                environmental hazards and enhance urban livability.
              </p>
            </header>

            {/* Mode Selector (desktop) */}
            <div className="bg-white/70 backdrop-blur-md rounded-2xl p-2 shadow-sm border border-neutral-200 flex items-center justify-between px-4">
              <span className="text-sm font-bold text-neutral-600 uppercase tracking-widest">
                Selection Mode
              </span>
              <div className="flex items-center gap-2">
                {(["poi", "barangay"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setLocationSelectionMode(mode)}
                    className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
                      locationSelectionMode === mode
                        ? "bg-primary-green text-white shadow-md shadow-green-200"
                        : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                    }`}
                  >
                    {mode === "poi" ? "Point of Interest" : "Barangay Area"}
                  </button>
                ))}
                <button className="p-1.5 hover:bg-neutral-100 rounded-full text-neutral-400">
                  <CircleHelp size={18} />
                </button>
              </div>
            </div>

            {/* Results Panel */}
            <div className="flex-1 bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-neutral-200/50 border border-neutral-200 flex flex-col overflow-hidden">
              <div className="p-6 flex items-center justify-between border-b border-neutral-100">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="p-3 bg-neutral-100 rounded-2xl text-primary-green">
                    <MapPin size={28} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-neutral-900 truncate">
                      {selectedFeature
                        ? selectedFeature.name
                        : "No Location Selected"}
                    </h4>
                    <p className="text-sm text-neutral-500 truncate">
                      {selectedFeature
                        ? selectedFeature.address
                        : "Interact with the map to start"}
                    </p>
                  </div>
                </div>

                {selectedFeature ? (
                  <button
                    onClick={clearSelection}
                    className="p-2 hover:bg-neutral-100 rounded-full text-neutral-400 transition-colors"
                  >
                    <X size={24} />
                  </button>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 bg-neutral-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-neutral-800 transition-all shrink-0"
                  >
                    <Camera size={18} />
                    <span>Upload</span>
                  </button>
                )}
              </div>

              {selectedFeature ? (
                <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
                  <MetricsDashboard />

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-neutral-100" />
                      <span className="text-xs font-bold text-neutral-400 uppercase tracking-[0.2em]">
                        Recommendations
                      </span>
                      <div className="h-px flex-1 bg-neutral-100" />
                    </div>

                    <div className="space-y-3">
                      <GreenSolutionCard
                        solutionTitle="Street Trees"
                        solutionDescription="Vertical greening for urban corridors."
                        efficiencyLevel="Highly Efficient"
                        value={90}
                        icon={<Trees size={40} />}
                        equityIndex={0.9}
                        cost={0.5}
                        impact={0.78}
                        detailedDescription="Strategically planted trees along urban streets provide essential shade, reduce ambient temperature, and mitigate air pollution."
                      />
                      <GreenSolutionCard
                        solutionTitle="Roof Gardens"
                        solutionDescription="Utilizing unused vertical space."
                        efficiencyLevel="Moderately Efficient"
                        value={40}
                        icon={<Flower size={40} />}
                        equityIndex={0.5}
                        cost={0.33}
                        impact={0.56}
                        detailedDescription="Rooftop vegetation helps control building temperatures while managing stormwater runoff effectively in dense areas."
                      />
                      <GreenSolutionCard
                        solutionTitle="Blue-Green Corridors"
                        solutionDescription="Integrated hydrological pathways."
                        efficiencyLevel="Not Efficient"
                        value={30}
                        icon={<Cookie size={40} />}
                        equityIndex={0.7}
                        cost={0.15}
                        impact={0.8}
                        detailedDescription="Combined water and plant systems that enhance biodiversity potential and flood resilience."
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center gap-4">
                  <div className="p-8 bg-neutral-50 rounded-full text-neutral-200">
                    <ImageIcon size={64} />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-neutral-400">Awaiting Input</p>
                    <p className="text-sm text-neutral-300">
                      Select a point or upload a photo to generate solutions
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Map Area (full-height on mobile) */}
          <div className="fixed inset-0 z-0 lg:relative lg:rounded-[2.5rem] overflow-hidden lg:shadow-2xl lg:border-8 lg:border-white group h-screen lg:h-auto">
            {/* Mobile floating controls moved to collapsible FAB in MapWrapper */}

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

            {/* Image Preview Overlay */}
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

        {/* Mobile Bottom Sheet (visible on small screens only) */}
        <div className={`fixed bottom-0 left-0 right-0 z-50 lg:hidden transition-transform duration-300 ease-in-out ${
          bottomExpanded ? "translate-y-0 pointer-events-auto" : "translate-y-full pointer-events-none"
        }`}>
          <div
            className="rounded-t-3xl bg-white/95 backdrop-blur-md border border-neutral-200 shadow-2xl"
            style={{ height: "70vh" }}
          >
            <div className="p-3 flex flex-col gap-2 h-full">
              <div className="w-full flex items-center justify-center">
                <div
                  className="w-12 h-1.5 bg-neutral-300 rounded-full cursor-pointer"
                  onClick={() => setBottomExpanded((s) => !s)}
                />
              </div>

              {!bottomExpanded ? null : (
                <div className="overflow-y-auto px-4">
                  {/* Reuse the content from the desktop results panel but trimmed for mobile */}
                  <div className="py-2">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-neutral-100 rounded-2xl text-primary-green">
                        <MapPin size={28} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-neutral-900 truncate">
                          {selectedFeature ? selectedFeature.name : "No Location Selected"}
                        </h4>
                        <p className="text-sm text-neutral-500 truncate">
                          {selectedFeature ? selectedFeature.address : "Interact with the map to start"}
                        </p>
                      </div>
                      {selectedFeature ? (
                        <button
                          onClick={() => { clearSelection(); setBottomExpanded(false); }}
                          className="p-2 hover:bg-neutral-100 rounded-full text-neutral-400 transition-colors ml-auto"
                        >
                          <X size={24} />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {selectedFeature ? (
                    <div className="space-y-4 pb-8">
                      <MetricsDashboard />
                      <div className="space-y-3">
                        <GreenSolutionCard
                          solutionTitle="Street Trees"
                          solutionDescription="Vertical greening for urban corridors."
                          efficiencyLevel="Highly Efficient"
                          value={90}
                          icon={<Trees size={40} />}
                          equityIndex={0.9}
                          cost={0.5}
                          impact={0.78}
                          detailedDescription="Strategically planted trees along urban streets provide essential shade, reduce ambient temperature, and mitigate air pollution."
                        />
                        <GreenSolutionCard
                          solutionTitle="Roof Gardens"
                          solutionDescription="Utilizing unused vertical space."
                          efficiencyLevel="Moderately Efficient"
                          value={40}
                          icon={<Flower size={40} />}
                          equityIndex={0.5}
                          cost={0.33}
                          impact={0.56}
                          detailedDescription="Rooftop vegetation helps control building temperatures while managing stormwater runoff effectively in dense areas."
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-neutral-400">
                      <p className="font-bold">Awaiting Input</p>
                      <p className="text-sm">Select a point or upload a photo to generate solutions</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Warning Modals */}
        {showWarning && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[100] p-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full text-center space-y-6 animate-in zoom-in-95 duration-300">
              <div className="mx-auto w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
                <X size={32} />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-neutral-900">
                  {showWarning === "no-gps"
                    ? "No GPS Found"
                    : "Outside Coverage"}
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
