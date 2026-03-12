"use client";

import Navbar from "@/components/ui/general/layout/navbar";
import {
  MapPin,
  Trees,
  Flower,
  X,
  Cookie,
  Leaf,
  Sprout,
  Thermometer,
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

function MetricsDashboard() {
  const { selectedBarangay } = useBarangay();
  if (!selectedBarangay) return null;

  const classColor = getGreeneryClassColor(selectedBarangay.greeneryIndex || 0);
  const [textColor, bgColor] = classColor.split(" ");

  return (
    <div className="flex flex-col items-center gap-3 w-full animate-in fade-in slide-in-from-top-2 duration-500">
      <h3
        className={`w-full ${bgColor} ${textColor} text-[10px] sm:text-xs font-black rounded-xl py-1.5 px-3 text-center uppercase tracking-widest`}
      >
        {selectedBarangay.name
          ? `${selectedBarangay.name} Statistics`
          : "Regional Overview"}
      </h3>

      <div className="grid grid-cols-2 gap-2 w-full">
        <BarangayMetricItem
          icon={Leaf}
          label="Greenery"
          value={selectedBarangay.greeneryIndex ?? 0}
        />
        <BarangayMetricItem
          icon={Trees}
          label="Canopy"
          value={selectedBarangay.treeCanopy ?? 0}
        />
        <BarangayMetricItem
          icon={Sprout}
          label="NDVI"
          value={selectedBarangay.ndvi ?? 0}
        />
        <BarangayMetricItem
          icon={Thermometer}
          label="Heat"
          value={selectedBarangay.lst ?? 0}
          isTemperature
        />
      </div>
    </div>
  );
}

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

export default function ExplorePage() {
  const [selectedFeature, setSelectedFeature] =
    useState<SelectedFeature | null>(null);
  const [geoData, setGeoData] = useState<BarangayData[] | null>(null);
  const [locationSelectionMode, setLocationSelectionMode] =
    useState<LocationSelectionMode>("poi");
  const [bottomExpanded, setBottomExpanded] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState<
    "no-gps" | "out-of-bounds" | null
  >(null);

  useEffect(() => {
    if (selectedFeature || imageUrl) {
      setBottomExpanded(true);
      setIsSidebarOpen(true);
    } else {
      setIsSidebarOpen(false);
    }
  }, [selectedFeature, imageUrl]);

  const mapRef = useRef<mapboxgl.Map | null>(null);
  const removeMarkerRef = useRef<(() => void) | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

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
    setIsSidebarOpen(false);
    setBottomExpanded(false);
  }, [imageUrl]);

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

      mapRef.current.flyTo({
        center: [lng, lat],
        zoom: 16,
        speed: 1.2,
        essential: true,
      });

      if (markerRef.current) markerRef.current.remove();
      markerRef.current = new mapboxgl.Marker({ color: "#DB4848" })
        .setLngLat([lng, lat])
        .addTo(mapRef.current);

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
      setBottomExpanded(true);
      setIsSidebarOpen(true);
    } catch (err) {
      console.error("EXIF Error:", err);
      setShowWarning("no-gps");
    }
  };

  useEffect(() => {
    if (!selectedFeature?.coords || !mapRef.current) return;
    const { lng, lat } = selectedFeature.coords;
    if (lng === 0 && lat === 0) return;
    mapRef.current.flyTo({
      center: [lng, lat],
      zoom: 16,
      speed: 1.2,
      essential: true,
    });
  }, [selectedFeature]);

  const handleFeatureSelected = useCallback((f: SelectedFeature) => {
    setSelectedFeature(f);
  }, []);

  return (
    <BarangayProvider>
      <Suspense fallback={null}>
        <SearchParamSync
          geoData={geoData}
          onFeatureFound={setSelectedFeature}
        />
      </Suspense>

      <main className="h-screen w-full bg-neutral-100 font-roboto overflow-hidden relative">
        <Navbar />

        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={fileInputRef}
          onChange={handleFileUploaded}
          className="hidden"
        />

        <div className="absolute inset-0 z-0">
          <MapWrapper
            searchBoxLocation="absolute top-28 left-8 sm:w-96 z-10"
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
        </div>

        {/* sidebar overlay - desktop view */}
        <div
          className={`hidden lg:flex flex-col absolute top-42 left-8 bottom-8 w-[450px] z-20 transition-all duration-500 ease-out ${
            isSidebarOpen
              ? "translate-x-0 opacity-100"
              : "-translate-x-[120%] opacity-0 pointer-events-none"
          }`}
        >
          <div className="flex-1 bg-white/85 backdrop-blur-2xl rounded-xl shadow-2xl border border-white/50 flex flex-col overflow-hidden">
            <div className="p-6 flex items-center justify-between border-b border-neutral-100">
              <div className="flex items-center gap-4 min-w-0">
                <div className="p-3.5 bg-primary-green/10 rounded-2xl text-primary-green shadow-inner shrink-0">
                  <MapPin size={28} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-lg font-black text-neutral-900 leading-tight">
                    {selectedFeature?.name || "Target Area"}
                  </h4>
                  <p className="text-xs text-neutral-500 font-bold mt-0.5 opacity-70">
                    {selectedFeature?.address || "Analyzing location..."}
                  </p>
                </div>
              </div>

              <button
                onClick={clearSelection}
                className="p-2.5 hover:bg-neutral-100 rounded-full text-neutral-400 transition-all hover:rotate-90 hover:text-red-500"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
              <MetricsDashboard />

              <div className="space-y-5">
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] whitespace-nowrap">
                    Greening Interventions
                  </span>
                  <div className="h-px flex-1 bg-neutral-100" />
                </div>

                <div className="space-y-4">
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
          </div>
        </div>

        {!isSidebarOpen && (
          <div className="hidden lg:block absolute top-[120px] left-[50%] -translate-x-1/2 z-10 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="bg-white/90 backdrop-blur-md px-3 py-3 rounded-full shadow-xl border border-white/50 flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-green rounded-full flex items-center justify-center text-white shadow-lg shadow-green-200">
                <Leaf size={20} />
              </div>
              <div className="flex flex-col justify-center">
                <p className="font-bold text-neutral-900 leading-none">
                  Select a spot to begin
                </p>
                <p className="text-sm text-neutral-500 font-medium">
                  Identify target areas for greening solutions
                </p>
              </div>
            </div>
          </div>
        )}

        {/* image preview overlay */}
        {imageUrl && selectedFeature?.name === "Photo Location" && (
          <div className="absolute top-28 right-8 z-10 animate-in fade-in zoom-in duration-300 hidden lg:block">
            <div className="bg-white/90 backdrop-blur-md p-2 rounded-[2rem] shadow-2xl border border-white/50 group/img">
              <div className="relative w-48 h-48 rounded-[1.5rem] overflow-hidden shadow-lg">
                <Image
                  src={imageUrl}
                  alt="Uploaded"
                  fill
                  className="object-cover"
                />
                <button
                  onClick={clearSelection}
                  className="absolute top-3 right-3 p-2 bg-black/60 text-white rounded-full opacity-0 group-hover/img:opacity-100 transition-all hover:scale-110"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="text-[10px] font-black text-neutral-400 text-center mt-3 uppercase tracking-widest">
                Reference Image
              </p>
            </div>
          </div>
        )}

        {/* botom sheet - mobile view */}
        <div
          className={`fixed bottom-0 left-0 right-0 z-50 lg:hidden transition-transform duration-500 cubic-bezier(0.32, 0.72, 0, 1) ${
            bottomExpanded ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div
            className="rounded-t-2xl bg-white/95 backdrop-blur-xl border-t border-white/20 shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.15)]"
            style={{ height: "75vh" }}
          >
            <div className="flex flex-col h-full overflow-hidden">
              <div className="w-full flex items-center justify-center py-3 shrink-0">
                <div
                  className="w-12 h-1.5 bg-neutral-200/60 rounded-full cursor-pointer hover:bg-neutral-300 transition-colors"
                  onClick={() => setBottomExpanded(false)}
                />
              </div>

              <div className="flex-1 overflow-y-auto px-5 pb-10 scrollbar-hide">
                <div className="flex items-start gap-3 mb-6 relative">
                  <div className="p-2.5 bg-primary-green/10 rounded-xl text-primary-green shrink-0">
                    <MapPin size={22} />
                  </div>
                  <div className="min-w-0 pr-8">
                    <h4 className="font-black text-neutral-900 text-base leading-tight">
                      {selectedFeature?.name || "No Location"}
                    </h4>
                    <p className="text-[10px] text-neutral-500 font-bold mt-0.5 leading-snug break-words opacity-70">
                      {selectedFeature?.address || "Analyzing..."}
                    </p>
                  </div>
                  <button
                    onClick={clearSelection}
                    className="absolute top-0 right-0 p-1.5 bg-neutral-100 rounded-full text-neutral-400 active:bg-neutral-200 active:scale-95 transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-6">
                  <MetricsDashboard />

                  <div className="space-y-3 pb-6">
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest whitespace-nowrap">
                        Greening Recommendations
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
              </div>
            </div>
          </div>
        </div>

        {showWarning && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex justify-center items-center z-[100] p-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] p-10 shadow-3xl max-w-sm w-full text-center space-y-8 animate-in zoom-in-95 duration-300">
              <div className="mx-auto w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center shadow-inner">
                <X size={40} />
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl font-bold text-neutral-900 leading-tight">
                  {showWarning === "no-gps"
                    ? "Incompatible Data"
                    : "Outside Coverage"}
                </h2>
                <p className="text-neutral-500 text-sm leading-relaxed font-medium">
                  {showWarning === "no-gps"
                    ? "This photo is missing GPS coordinates. To analyze a specific site, please use a geotagged image."
                    : "The selected location is currently outside our service area for Mandaue City."}
                </p>
              </div>
              <button
                onClick={() => setShowWarning(null)}
                className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all active:scale-95 shadow-lg shadow-neutral-200"
              >
                Continue
              </button>
            </div>
          </div>
        )}
      </main>
    </BarangayProvider>
  );
}
