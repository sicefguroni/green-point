"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  Suspense,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import dynamic from "next/dynamic";
import mapboxgl from "mapbox-gl";
import exifr from "exifr";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/ui/general/layout/navbar";
import {
  MapPin,
  Trees,
  X,
  Leaf,
  Sprout,
  Thermometer,
  Sparkles,
} from "lucide-react";
import GreenSolutionCard from "@/components/ui/general/cards/greensolution-infocard";
import { useBarangay, type BarangayData } from "@/context/BarangayContext";
import {
  enrichRecommendation,
  getUIRecommendations,
  sortUIRecommendationsByOverallRating,
  type UIRecommendation,
} from "@/lib/recommendations";
import BarangayMetricsGrid from "@/components/ui/general/metrics/BarangayMetricsGrid";
import { type LocationSelectionMode } from "@/types/maplayers";
import type { SelectedFeature } from "@/types/metrics";
import {
  type SidebarView,
  type DetailTab,
  type ChatHistoryMessage,
  type TimelineViewMode,
} from "@/types/green_solutions";
import { GreeningRecommendation } from "@/types/schema";
import SidebarDetail from "@/components/ui/green_solutions/SidebarDetails";
import { type SavePayload } from "@/types/green_solutions";
import { useSavedSolutions } from "@/hooks/useSavedSolutions";
import { fetchGreeneryIndexGeoJson } from "@/lib/data-api/client";
import { toast } from "sonner";
import * as turf from "@turf/turf";

const RECOMMENDATIONS = getUIRecommendations();

const MapWrapper = dynamic(() => import("@/components/map/map_wrapper"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50">
      <div className="flex flex-col items-center gap-2 text-neutral-400">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-green" />
        <span className="font-medium">Initializing Map...</span>
      </div>
    </div>
  ),
});

function ExploreMetricsDashboard({
  feature,
  selectionMode,
  activeBarangayData,
}: {
  feature: SelectedFeature | null;
  selectionMode: LocationSelectionMode;
  activeBarangayData?: BarangayData | null;
}) {
  const isPinMode = selectionMode === "poi";
  const isCustomMode = selectionMode === "custom";
  const props = feature?.properties;

  const ndvi = (isPinMode ? props?.ndvi : activeBarangayData?.ndvi) ?? null;
  const lst =
    (isPinMode ? props?.temperature : activeBarangayData?.lst) ?? null;
  const treeCanopy =
    (isPinMode ? props?.treeCanopy : activeBarangayData?.treeCanopy) ?? null;
  const greeneryIndex =
    (isPinMode ? props?.greeneryIndex : activeBarangayData?.greeneryIndex) ??
    null;
  const customAreaHectares = feature?.customSelectionAreaHectares ?? null;
  const hasLocationMetrics =
    greeneryIndex !== null ||
    ndvi !== null ||
    lst !== null ||
    treeCanopy !== null;

  if (feature?.isLoadingMetrics && isPinMode) {
    return (
      <div className="flex w-full flex-col items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
        <h3 className="w-full rounded-xl bg-primary-green/10 px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-primary-green sm:text-xs dark:bg-primary-green/20 dark:text-primary-green/80">
          Loading Metrics...
        </h3>
        <div className="grid w-full grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-[4.5rem] rounded-2xl bg-neutral-100 animate-pulse dark:bg-neutral-800"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!hasLocationMetrics && customAreaHectares === null) return null;

  return (
    <div className="flex w-full flex-col items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
      <h3 className="w-full rounded-xl bg-primary-green/10 px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-primary-green sm:text-xs dark:bg-primary-green/20 dark:text-primary-green/80">
        {isPinMode
          ? "Point Metrics"
          : isCustomMode
            ? "Custom Area Metrics"
            : `${feature?.barangay || "Area"} Statistics`}
      </h3>

      {customAreaHectares !== null ? (
        <div className="w-full rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-center dark:border-emerald-900/50 dark:bg-emerald-950/40">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
            Selected Area
          </p>
          <p className="mt-1 text-xl font-black text-emerald-900 dark:text-emerald-100">
            {customAreaHectares.toFixed(2)} ha
          </p>
        </div>
      ) : null}

      <BarangayMetricsGrid
        greeneryIndex={greeneryIndex}
        ndvi={ndvi}
        treeCanopy={treeCanopy}
        lst={lst}
      />
    </div>
  );
}

function maxHazardLevel(
  hazards: { id: string; level: number | null }[] | undefined,
): number | undefined {
  const levels = (hazards ?? [])
    .map((hazard) => hazard.level)
    .filter((level): level is number => typeof level === "number");

  if (levels.length === 0) {
    return undefined;
  }

  return Math.max(...levels);
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
  const [activeView, setActiveView] = useState<SidebarView>("LIST");
  const [selectedRecommendation, setSelectedRecommendation] =
    useState<UIRecommendation | null>(null);
  const [detailCurrentTab, setDetailCurrentTab] = useState<DetailTab>("INFO");
  const [detailChatMessages, setDetailChatMessages] = useState<
    ChatHistoryMessage[]
  >([]);
  const [detailChatInput, setDetailChatInput] = useState("");
  const [isDetailChatLoading, setIsDetailChatLoading] = useState(false);
  const [detailTimelineView, setDetailTimelineView] =
    useState<TimelineViewMode>("DEFAULT");
  const [isDetailFullscreen, setIsDetailFullscreen] = useState(false);

  const [ragRecommendations, setRagRecommendations] = useState<
    UIRecommendation[] | null
  >(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const { selectedBarangay: activeBarangayData, setSelectedBarangay } =
    useBarangay();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState<
    "no-gps" | "out-of-bounds" | null
  >(null);

  const { saves, saveSolution, removeSolution } = useSavedSolutions();

  const clearSelectedBarangayHighlight = useCallback(
    (barangayName: string | null | undefined) => {
      if (!barangayName || !mapRef.current) {
        return;
      }

      try {
        mapRef.current.setFeatureState(
          {
            source: "barangayBoundsSource",
            sourceLayer: "mandaue_barangay_boundaries-7byvux",
            id: barangayName,
          } as Parameters<mapboxgl.Map["setFeatureState"]>[0],
          { selected: false },
        );
      } catch (error) {
        console.error("Failed to clear barangay highlight:", error);
      }
    },
    [],
  );

  // Build the location payload for SavedTab based on current selection mode
  const savedLocationPayload = useMemo<Omit<
    SavePayload,
    "solutionSnapshot" | "contextSnapshot"
  > | null>(() => {
    if (!selectedFeature) return null;
    if (locationSelectionMode === "barangay") {
      return {
        locationType: "barangay",
        locationId: selectedFeature.barangay || null,
        locationName: selectedFeature.barangay
          ? `Brgy. ${selectedFeature.barangay}`
          : selectedFeature.name,
        locationMetadata: null,
      };
    }
    if (locationSelectionMode === "custom") {
      const geo = selectedFeature.customSelectionGeometry;
      const coords = geo?.coordinates?.[0] ?? [];
      let midLat = 0;
      let midLng = 0;
      if (coords.length) {
        coords.forEach(([lng, lat]: number[]) => {
          midLat += lat;
          midLng += lng;
        });
        midLat /= coords.length;
        midLng /= coords.length;
      }
      return {
        locationType: "custom",
        locationId: null,
        locationName: selectedFeature.customSelectionAreaHectares
          ? `${selectedFeature.customSelectionAreaHectares.toFixed(2)} ha Custom Area`
          : "Custom Area",
        locationMetadata: {
          areaHectares: selectedFeature.customSelectionAreaHectares ?? null,
          midpoint: coords.length ? { lat: midLat, lng: midLng } : null,
        },
      };
    }
    // poi / point
    return {
      locationType: "poi",
      locationId: null,
      locationName: selectedFeature.name || "Pin Location",
      locationMetadata: {
        coords: selectedFeature.coords,
        address: selectedFeature.address,
      },
    };
  }, [selectedFeature, locationSelectionMode]);

  // Build context snapshot for SavedTab
  const contextSnapshot = useMemo<Record<string, unknown> | null>(() => {
    if (!selectedFeature) return null;
    return {
      areaName: selectedFeature.barangay || selectedFeature.name,
      ndvi:
        activeBarangayData?.ndvi ?? selectedFeature.properties?.ndvi ?? null,
      lst:
        activeBarangayData?.lst ??
        selectedFeature.properties?.temperature ??
        null,
      treeCanopy:
        activeBarangayData?.treeCanopy ??
        selectedFeature.properties?.treeCanopy ??
        null,
      greeneryIndex:
        activeBarangayData?.greeneryIndex ??
        selectedFeature.properties?.greeneryIndex ??
        null,
      greeneryLevel: activeBarangayData?.greeneryLevel ?? null,
      floodHazard: maxHazardLevel(selectedFeature.hazards?.flood) ?? null,
      stormHazard: maxHazardLevel(selectedFeature.hazards?.storm) ?? null,
      aqi: selectedFeature.hazards?.air?.[0]?.AQI_Level ?? null,
      areaHectares:
        selectedFeature.customSelectionAreaHectares ??
        activeBarangayData?.areaHectares ??
        null,
    };
  }, [selectedFeature, activeBarangayData]);

  const handleToggleSave = useCallback(
    async (e: React.MouseEvent, rec: UIRecommendation) => {
      e.stopPropagation();
      if (!savedLocationPayload) return;

      const saved = saves.find(
        (s) =>
          String(s.solutionSnapshot.solutionTitle) === rec.solutionTitle &&
          s.locationType === savedLocationPayload.locationType &&
          (s.locationId === savedLocationPayload.locationId ||
            s.locationName === savedLocationPayload.locationName),
      );
      if (saved) {
        await removeSolution(saved.id);
        toast.success("Solution removed from workspace");
      } else {
        const { icon: _icon, ...snapshotRec } = rec as UIRecommendation & {
          icon?: unknown;
        };
        const success = await saveSolution({
          ...savedLocationPayload,
          solutionSnapshot: snapshotRec as unknown as Record<string, unknown>,
          contextSnapshot: contextSnapshot ?? {},
        });
        if (success) {
          toast.success("Solution saved to your workspace");
        } else {
          toast.error("Failed to save solution");
        }
      }
    },
    [
      saves,
      savedLocationPayload,
      contextSnapshot,
      saveSolution,
      removeSolution,
    ],
  );

  const resetDetailState = useCallback(() => {
    setDetailCurrentTab("INFO");
    setDetailChatMessages([]);
    setDetailChatInput("");
    setIsDetailChatLoading(false);
    setDetailTimelineView("DEFAULT");
  }, []);

  useEffect(() => {
    if (!selectedFeature?.barangay) {
      setSelectedBarangay(null);
      return;
    }

    if (!geoData) {
      return;
    }

    const matched = geoData.find(
      (barangay) =>
        barangay.name?.toLowerCase() === selectedFeature.barangay.toLowerCase(),
    );

    if (matched) {
      setSelectedBarangay({
        ...matched,
        greeneryIndex: matched.greeneryIndex ?? 0,
        ndvi: matched.ndvi ?? 0,
        lst: matched.lst ?? 0,
        treeCanopy: matched.treeCanopy ?? 0,
      });
    } else {
      setSelectedBarangay(null);
    }
  }, [geoData, selectedFeature, setSelectedBarangay]);

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
    fetchGreeneryIndexGeoJson()
      .then((data) => {
        const mapped = data.features
          .map(
            (item) =>
              ({
                name: item.properties?.name as string | undefined,
                greeneryIndex:
                  (item.properties?.greeneryIndex as number | undefined) ?? 0,
                ndvi: (item.properties?.ndvi as number | undefined) ?? 0,
                lst: (item.properties?.lst as number | undefined) ?? 0,
                treeCanopy:
                  (item.properties?.treeCanopy as number | undefined) ?? 0,
                greeneryLevel: item.properties?.level as string | undefined,
                taggedTreeCount:
                  (item.properties?.inventoryTreeCount as number | undefined) ??
                  0,
                inventoryCanopyFraction:
                  (item.properties?.inventoryCanopyFraction as
                    | number
                    | undefined) ?? 0,
                areaHectares: item.geometry
                  ? turf.area(item as GeoJSON.Feature) / 10000
                  : undefined,
                floodExposure: "",
                currentIntervention: "",
              }) as BarangayData,
          )
          .filter((b): b is BarangayData => typeof b.name === "string");
        setGeoData(mapped);
      })
      .catch((error) => {
        console.error("Failed to load barangay geo data:", error);
      });
  }, []);

  const clearSelection = useCallback(() => {
    clearSelectedBarangayHighlight(
      selectedFeature?.barangay ?? activeBarangayData?.name ?? null,
    );
    setSelectedFeature(null);
    setSelectedBarangay(null);
    setRagRecommendations(null);
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
    setActiveView("LIST");
    setSelectedRecommendation(null);
    setRagRecommendations(null);
    setGenerateError(null);
    setIsDetailFullscreen(false);
    resetDetailState();
  }, [
    activeBarangayData,
    clearSelectedBarangayHighlight,
    imageUrl,
    resetDetailState,
    selectedFeature,
    setSelectedBarangay,
  ]);

  const openRecommendationDetail = useCallback(
    (recommendation: UIRecommendation) => {
      resetDetailState();
      setSelectedRecommendation(recommendation);
      setActiveView("DETAIL");
      setIsDetailFullscreen(false);
    },
    [resetDetailState],
  );

  const handleGenerate = useCallback(async () => {
    if (!selectedFeature) return;
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/recommendations/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barangayName: selectedFeature.barangay || selectedFeature.name,
          barangayId: selectedFeature.barangay || null,
          ndvi:
            locationSelectionMode === "poi"
              ? (selectedFeature.properties?.ndvi ??
                activeBarangayData?.ndvi ??
                null)
              : (activeBarangayData?.ndvi ??
                selectedFeature.properties?.ndvi ??
                null),
          lst:
            locationSelectionMode === "poi"
              ? (selectedFeature.properties?.temperature ??
                activeBarangayData?.lst ??
                null)
              : (activeBarangayData?.lst ??
                selectedFeature.properties?.temperature ??
                null),
          treeCanopy:
            locationSelectionMode === "poi"
              ? (selectedFeature.properties?.treeCanopy ??
                activeBarangayData?.treeCanopy ??
                null)
              : (activeBarangayData?.treeCanopy ??
                selectedFeature.properties?.treeCanopy ??
                null),
          greeneryIndex:
            locationSelectionMode === "poi"
              ? (selectedFeature.properties?.greeneryIndex ??
                activeBarangayData?.greeneryIndex ??
                null)
              : (activeBarangayData?.greeneryIndex ??
                selectedFeature.properties?.greeneryIndex ??
                null),
          greeneryLevel: activeBarangayData?.greeneryLevel ?? null,
          floodHazard: maxHazardLevel(selectedFeature.hazards?.flood) ?? null,
          stormHazard: maxHazardLevel(selectedFeature.hazards?.storm) ?? null,
          aqi:
            selectedFeature.hazards?.air?.[0]?.AQI_Level != null &&
            selectedFeature.hazards.air[0].AQI_Level >= 0
              ? selectedFeature.hazards.air[0].AQI_Level
              : null,
          taggedTreeCount:
            locationSelectionMode === "poi"
              ? ((selectedFeature.properties?.nearbyTaggedTreeCount as
                  | number
                  | null
                  | undefined) ??
                activeBarangayData?.taggedTreeCount ??
                null)
              : (activeBarangayData?.taggedTreeCount ??
                (selectedFeature.properties?.inventoryTreeCount as
                  | number
                  | null
                  | undefined) ??
                null),
          inventoryCanopyFraction:
            locationSelectionMode === "poi"
              ? ((selectedFeature.properties?.inventoryCanopyFraction as
                  | number
                  | null
                  | undefined) ??
                activeBarangayData?.inventoryCanopyFraction ??
                null)
              : (activeBarangayData?.inventoryCanopyFraction ??
                (selectedFeature.properties?.inventoryCanopyFraction as
                  | number
                  | null
                  | undefined) ??
                null),
          areaHectares:
            selectedFeature.customSelectionAreaHectares ??
            activeBarangayData?.areaHectares ??
            null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        const enriched = sortUIRecommendationsByOverallRating(
          (json.data as GreeningRecommendation[]).map(enrichRecommendation),
        );
        setRagRecommendations(enriched);

        void trackLocationMetrics(
          locationSelectionMode === "poi"
            ? "POINT"
            : locationSelectionMode === "custom"
              ? "CUSTOM"
              : "BARANGAY",
          selectedFeature.barangay || selectedFeature.name,
          {
            ndvi:
              locationSelectionMode === "poi"
                ? (selectedFeature.properties?.ndvi ??
                  activeBarangayData?.ndvi ??
                  null)
                : (activeBarangayData?.ndvi ??
                  selectedFeature.properties?.ndvi ??
                  null),
            lst:
              locationSelectionMode === "poi"
                ? (selectedFeature.properties?.temperature ??
                  activeBarangayData?.lst ??
                  null)
                : (activeBarangayData?.lst ??
                  selectedFeature.properties?.temperature ??
                  null),
            treeCanopy:
              locationSelectionMode === "poi"
                ? (selectedFeature.properties?.treeCanopy ??
                  activeBarangayData?.treeCanopy ??
                  null)
                : (activeBarangayData?.treeCanopy ??
                  selectedFeature.properties?.treeCanopy ??
                  null),
            greeneryIndex:
              locationSelectionMode === "poi"
                ? (selectedFeature.properties?.greeneryIndex ??
                  activeBarangayData?.greeneryIndex ??
                  null)
                : (activeBarangayData?.greeneryIndex ??
                  selectedFeature.properties?.greeneryIndex ??
                  null),
            greeneryLevel: activeBarangayData?.greeneryLevel ?? null,
            aqi:
              selectedFeature.hazards?.air?.[0]?.AQI_Level != null &&
              selectedFeature.hazards.air[0].AQI_Level >= 0
                ? selectedFeature.hazards.air[0].AQI_Level
                : null,
          },
          selectedFeature.pointID || null,
          selectedFeature.coords,
        );
      } else {
        setGenerateError(json.error ?? "Generation failed.");
      }
    } catch {
      setGenerateError("Network error. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [selectedFeature, activeBarangayData]);

  const handleDetailBack = useCallback(() => {
    setIsDetailFullscreen(false);
    setActiveView("LIST");
  }, []);

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

  const trackLocationMetrics = useCallback(
    async (
      type: "BARANGAY" | "POINT" | "CUSTOM",
      name: string,
      metrics: {
        ndvi?: number | null;
        lst?: number | null;
        treeCanopy?: number | null;
        greeneryIndex?: number | null;
        greeneryLevel?: string | null;
        aqi?: number | null;
      },
      id?: string | null,
      coords?: { lat: number; lng: number } | null,
    ) => {
      try {
        await fetch("/api/metrics/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locationType: type,
            locationId: id,
            locationName: name,
            coordinates: coords,
            ...metrics,
          }),
        });
      } catch (err) {
        console.error("Failed to track metrics:", err);
      }
    },
    [],
  );

  const handleFeatureSelected = useCallback(
    (feature: SelectedFeature) => {
      setSelectedFeature(feature);
      setRagRecommendations(null);

      // Track metrics if it's a barangay or has metrics
      if (feature.barangay || feature.properties) {
        const props = feature.properties;
        void trackLocationMetrics(
          feature.pointID ? "POINT" : feature.barangay ? "BARANGAY" : "CUSTOM",
          feature.barangay || feature.name,
          {
            ndvi: props?.ndvi,
            lst: props?.temperature || props?.lst,
            treeCanopy: props?.treeCanopy,
            greeneryIndex: props?.greeneryIndex,
            greeneryLevel: props?.level,
            aqi: feature.hazards?.air?.[0]?.AQI_Level,
          },
          feature.pointID || null,
          feature.coords,
        );
      }
    },
    [trackLocationMetrics],
  );

  useEffect(() => {
    if (activeView === "DETAIL" && selectedRecommendation && selectedFeature) {
      return;
    }

    setIsDetailFullscreen(false);
  }, [activeView, selectedRecommendation, selectedFeature]);

  useEffect(() => {
    if (!isDetailFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isDetailFullscreen]);

  useEffect(() => {
    if (!isDetailFullscreen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDetailFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDetailFullscreen]);

  return (
    <>
      <Suspense fallback={null}>
        <SearchParamSync
          geoData={geoData}
          onFeatureFound={setSelectedFeature}
        />
      </Suspense>

      <main className="relative h-screen w-full overflow-hidden bg-background font-roboto text-foreground">
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
            searchBoxLocation="top-6 left-20 sm:left-24 lg:left-28 lg:w-96 z-30"
            onFeatureSelected={handleFeatureSelected}
            bottomExpanded={bottomExpanded}
            selectedCustomArea={
              selectedFeature?.customSelectionGeometry ?? null
            }
            onBarangaySelected={(name) => {
              const matched = geoData?.find(
                (b) => b.name.toLowerCase() === name.toLowerCase(),
              );
              if (matched) {
                setSelectedBarangay({
                  ...matched,
                  greeneryIndex: matched.greeneryIndex ?? 0,
                  ndvi: matched.ndvi ?? 0,
                  lst: matched.lst ?? 0,
                  treeCanopy: matched.treeCanopy ?? 0,
                });
              }
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
          className={`hidden lg:flex flex-col absolute top-8 left-24 bottom-8 w-[450px] z-20 transition-all duration-500 ease-out ${
            isSidebarOpen
              ? isDetailFullscreen && activeView === "DETAIL"
                ? "-translate-x-[120%] opacity-0 pointer-events-none"
                : "translate-x-0 opacity-100"
              : "-translate-x-[120%] opacity-0 pointer-events-none"
          }`}
        >
          <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-white/50 bg-white/85 shadow-2xl backdrop-blur-2xl dark:border-neutral-800/80 dark:bg-neutral-950/85 dark:shadow-black/40">
            <div className="flex items-center justify-between border-b border-neutral-100 p-6 dark:border-neutral-800 dark:bg-neutral-950/60">
              <div className="flex items-center gap-4 min-w-0">
                <div className="shrink-0 rounded-2xl bg-primary-green/10 p-3.5 text-primary-green shadow-inner dark:bg-primary-green/20 dark:text-primary-green/80">
                  <MapPin size={28} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-lg font-bold leading-tight text-neutral-900 dark:text-neutral-50">
                    {selectedFeature?.name || "Target Area"}
                  </h4>
                  <p className="mt-0.5 text-xs font-semibold text-neutral-500 opacity-70 dark:text-neutral-400">
                    {selectedFeature?.address || "Analyzing location..."}
                  </p>
                </div>
              </div>

              <button
                onClick={clearSelection}
                className="rounded-full p-2.5 text-neutral-400 transition-all hover:rotate-90 hover:bg-neutral-100 hover:text-red-500 dark:text-neutral-500 dark:hover:bg-neutral-800"
              >
                <X size={24} />
              </button>
            </div>

            <div
              className={`flex-1 flex flex-col min-h-0 ${
                activeView === "DETAIL"
                  ? ""
                  : "overflow-y-auto p-6 space-y-8 scrollbar-hide"
              }`}
            >
              {activeView === "DETAIL" &&
              selectedRecommendation &&
              selectedFeature ? (
                isDetailFullscreen ? null : (
                  <SidebarDetail
                    recommendation={selectedRecommendation}
                    selectedFeature={selectedFeature}
                    selectedBarangayData={activeBarangayData ?? null}
                    onBack={handleDetailBack}
                    currentTab={detailCurrentTab}
                    onCurrentTabChange={setDetailCurrentTab}
                    chatMessages={detailChatMessages}
                    onChatMessagesChange={setDetailChatMessages}
                    chatInput={detailChatInput}
                    onChatInputChange={setDetailChatInput}
                    isChatLoading={isDetailChatLoading}
                    onChatLoadingChange={setIsDetailChatLoading}
                    timelineViewMode={detailTimelineView}
                    onTimelineViewModeChange={setDetailTimelineView}
                    onToggleFullscreen={() => setIsDetailFullscreen(true)}
                    isSaved={saves.some(
                      (s) =>
                        String(s.solutionSnapshot.solutionTitle) ===
                          selectedRecommendation.solutionTitle &&
                        s.locationType === savedLocationPayload?.locationType &&
                        (s.locationId === savedLocationPayload?.locationId ||
                          s.locationName ===
                            savedLocationPayload?.locationName),
                    )}
                    onToggleSave={
                      savedLocationPayload
                        ? (e) => handleToggleSave(e, selectedRecommendation)
                        : undefined
                    }
                  />
                )
              ) : (
                <>
                  <ExploreMetricsDashboard
                    feature={selectedFeature}
                    selectionMode={locationSelectionMode}
                    activeBarangayData={activeBarangayData}
                  />

                  <div className="space-y-5">
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-semibold text-neutral-400 whitespace-nowrap">
                        Greening Recommendations
                      </span>
                      <div className="h-px flex-1 bg-neutral-100" />
                    </div>

                    {!ragRecommendations ? (
                      <div className="flex flex-col items-center gap-3 py-2">
                        {generateError && (
                          <p className="text-xs text-red-500 font-semibold text-center bg-red-50 w-full py-2 rounded-xl border border-red-100 dark:bg-red-950/20 dark:border-red-900/30">
                            {generateError}
                          </p>
                        )}
                        <button
                          onClick={handleGenerate}
                          disabled={
                            isGenerating || selectedFeature?.isLoadingMetrics
                          }
                          className="w-full group relative flex items-center justify-center gap-3 py-4 px-6 rounded-2xl bg-primary-green text-white font-bold text-sm shadow-[0_10px_25px_-5px_rgba(22,163,74,0.4)] hover:bg-green-700 hover:shadow-green-300 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300 disabled:opacity-70 disabled:translate-y-0 disabled:shadow-none disabled:cursor-not-allowed dark:shadow-green-900/30"
                        >
                          <div className="absolute inset-0 bg-white/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                          {isGenerating ? (
                            <>
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                              <span className="tracking-tight">
                                Analyzing Research...
                              </span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={18} className="animate-pulse" />
                              <span className="tracking-tight">
                                Generate AI Solutions
                              </span>
                            </>
                          )}
                        </button>
                        <p className="text-xs text-neutral-400 font-medium text-center opacity-60">
                          Powered by research-grounded RAG Engine
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-end px-1">
                          <button
                            onClick={() => setRagRecommendations(null)}
                            className="text-xs font-semibold text-neutral-400 hover:text-primary-green transition-colors"
                          >
                            Reset to Default
                          </button>
                        </div>
                        <div className="space-y-4">
                          {ragRecommendations.map((rec) => (
                            <GreenSolutionCard
                              key={rec.id}
                              solutionTitle={rec.solutionTitle}
                              solutionDescription={rec.solutionDescription}
                              efficiencyLevel={rec.efficiencyLevel}
                              value={rec.value}
                              icon={rec.icon}
                              equityIndex={rec.equityIndex}
                              cost={rec.cost}
                              impact={rec.impact}
                              detailedDescription={rec.detailedDescription}
                              onViewDetails={() =>
                                openRecommendationDetail(rec)
                              }
                              isSaved={saves.some(
                                (s) =>
                                  String(s.solutionSnapshot.solutionTitle) ===
                                  rec.solutionTitle,
                              )}
                              onToggleSave={
                                savedLocationPayload
                                  ? (e) => handleToggleSave(e, rec)
                                  : undefined
                              }
                            />
                          ))}
                        </div>
                        <button
                          onClick={handleGenerate}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-neutral-200 text-neutral-400 text-[10px] font-black uppercase tracking-widest hover:border-primary-green/30 hover:text-primary-green hover:bg-primary-green/5 transition-all dark:border-neutral-800 dark:hover:border-primary-green/40"
                        >
                          <Sprout size={14} />
                          Regenerate with New Data
                        </button>
                      </div>
                    )}

                    <div
                      className={
                        ragRecommendations
                          ? "hidden"
                          : "space-y-4 opacity-50 pointer-events-none grayscale-[0.5]"
                      }
                    >
                      {RECOMMENDATIONS.map((rec) => (
                        <GreenSolutionCard
                          key={rec.id}
                          solutionTitle={rec.solutionTitle}
                          solutionDescription={rec.solutionDescription}
                          efficiencyLevel={rec.efficiencyLevel}
                          value={rec.value}
                          icon={rec.icon}
                          equityIndex={rec.equityIndex}
                          cost={rec.cost}
                          impact={rec.impact}
                          detailedDescription={rec.detailedDescription}
                          onViewDetails={() => openRecommendationDetail(rec)}
                          isSaved={saves.some(
                            (s) =>
                              String(s.solutionSnapshot.solutionTitle) ===
                              rec.solutionTitle,
                          )}
                          onToggleSave={
                            savedLocationPayload
                              ? (e) => handleToggleSave(e, rec)
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* image preview overlay */}
        {imageUrl && selectedFeature?.name === "Photo Location" && (
          <div className="absolute top-28 right-8 z-10 animate-in fade-in zoom-in duration-300 hidden lg:block">
            <div className="bg-white/90 backdrop-blur-md p-2 rounded-[2rem] shadow-2xl border border-white/50 dark:bg-neutral-950/90 dark:border-neutral-800 group/img">
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
              <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 text-center mt-3 uppercase tracking-widest">
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
            className="rounded-t-2xl border-t border-white/20 bg-white/95 shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.15)] backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950/95 dark:shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.45)]"
            style={{ height: "75vh" }}
          >
            <div className="flex flex-col h-full overflow-hidden">
              <div className="w-full flex items-center justify-center py-3 shrink-0">
                <div
                  className="w-12 h-1.5 bg-neutral-200/60 rounded-full cursor-pointer hover:bg-neutral-300 transition-colors dark:bg-neutral-700 dark:hover:bg-neutral-600"
                  onClick={() => setBottomExpanded(false)}
                />
              </div>

              <div
                className={`flex-1 px-5 pb-10 scrollbar-hide flex flex-col ${
                  activeView === "DETAIL"
                    ? "overflow-hidden"
                    : "overflow-y-auto"
                }`}
              >
                <div className="relative mb-6 flex items-start gap-3 shrink-0">
                  <div className="shrink-0 rounded-xl bg-primary-green/10 p-2.5 text-primary-green dark:bg-primary-green/20 dark:text-primary-green/80">
                    <MapPin size={22} />
                  </div>
                  <div className="min-w-0 pr-8">
                    <h4 className="text-base font-black leading-tight text-neutral-900 dark:text-neutral-50">
                      {selectedFeature?.name || "No Location"}
                    </h4>
                    <p className="mt-0.5 break-words text-[10px] font-bold leading-snug text-neutral-500 opacity-70 dark:text-neutral-400">
                      {selectedFeature?.address || "Analyzing..."}
                    </p>
                  </div>
                  <button
                    onClick={clearSelection}
                    className="absolute right-0 top-0 rounded-full bg-neutral-100 p-1.5 text-neutral-400 transition-all active:scale-95 active:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-500 dark:active:bg-neutral-700"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div
                  className={`flex-1 min-h-0 ${
                    activeView === "DETAIL" ? "flex flex-col" : "space-y-6"
                  }`}
                >
                  {activeView === "DETAIL" &&
                  selectedRecommendation &&
                  selectedFeature ? (
                    isDetailFullscreen ? null : (
                      <SidebarDetail
                        recommendation={selectedRecommendation}
                        selectedFeature={selectedFeature}
                        selectedBarangayData={activeBarangayData ?? null}
                        onBack={handleDetailBack}
                        currentTab={detailCurrentTab}
                        onCurrentTabChange={setDetailCurrentTab}
                        chatMessages={detailChatMessages}
                        onChatMessagesChange={setDetailChatMessages}
                        chatInput={detailChatInput}
                        onChatInputChange={setDetailChatInput}
                        isChatLoading={isDetailChatLoading}
                        onChatLoadingChange={setIsDetailChatLoading}
                        timelineViewMode={detailTimelineView}
                        onTimelineViewModeChange={setDetailTimelineView}
                        isSaved={saves.some(
                          (s) =>
                            String(s.solutionSnapshot.solutionTitle) ===
                              selectedRecommendation.solutionTitle &&
                            s.locationType ===
                              savedLocationPayload?.locationType &&
                            (s.locationId ===
                              savedLocationPayload?.locationId ||
                              s.locationName ===
                                savedLocationPayload?.locationName),
                        )}
                        onToggleSave={
                          savedLocationPayload
                            ? (e) => handleToggleSave(e, selectedRecommendation)
                            : undefined
                        }
                      />
                    )
                  ) : (
                    <>
                      <ExploreMetricsDashboard
                        feature={selectedFeature}
                        selectionMode={locationSelectionMode}
                        activeBarangayData={activeBarangayData}
                      />

                      <div className="space-y-3 pb-6">
                        <div className="flex items-center gap-3">
                          <span className="whitespace-nowrap text-[9px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                            AI Greening Solutions
                          </span>
                          <div className="h-px flex-1 bg-neutral-100 dark:bg-neutral-800" />
                        </div>

                        {!ragRecommendations ? (
                          <div className="flex flex-col items-center gap-3 py-1">
                            <button
                              onClick={handleGenerate}
                              disabled={
                                isGenerating ||
                                selectedFeature?.isLoadingMetrics
                              }
                              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-primary-green text-white font-black text-sm shadow-lg shadow-green-100 active:scale-95 transition-all disabled:opacity-60"
                            >
                              {isGenerating ? (
                                <>
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                  Analyzing...
                                </>
                              ) : (
                                <>
                                  <Sparkles size={18} />
                                  Generate AI Solutions
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center justify-end px-1">
                              <button
                                onClick={() => setRagRecommendations(null)}
                                className="text-[9px] font-black text-neutral-400 uppercase tracking-widest"
                              >
                                Reset
                              </button>
                            </div>
                            {ragRecommendations.map((rec) => (
                              <GreenSolutionCard
                                key={rec.id}
                                solutionTitle={rec.solutionTitle}
                                solutionDescription={rec.solutionDescription}
                                efficiencyLevel={rec.efficiencyLevel}
                                value={rec.value}
                                icon={rec.icon}
                                equityIndex={rec.equityIndex}
                                cost={rec.cost}
                                impact={rec.impact}
                                detailedDescription={rec.detailedDescription}
                                justification={rec.justification}
                                recommendedSpecies={rec.recommendedSpecies}
                                onViewDetails={() =>
                                  openRecommendationDetail(rec)
                                }
                                isSaved={saves.some(
                                  (s) =>
                                    String(s.solutionSnapshot.solutionTitle) ===
                                    rec.solutionTitle,
                                )}
                                onToggleSave={
                                  savedLocationPayload
                                    ? (e) => handleToggleSave(e, rec)
                                    : undefined
                                }
                              />
                            ))}
                          </div>
                        )}

                        <div
                          className={
                            ragRecommendations
                              ? "hidden"
                              : "space-y-3 opacity-40 pointer-events-none"
                          }
                        >
                          {RECOMMENDATIONS.map((rec) => (
                            <GreenSolutionCard
                              key={rec.id}
                              solutionTitle={rec.solutionTitle}
                              solutionDescription={rec.solutionDescription}
                              efficiencyLevel={rec.efficiencyLevel}
                              value={rec.value}
                              icon={rec.icon}
                              equityIndex={rec.equityIndex}
                              cost={rec.cost}
                              impact={rec.impact}
                              detailedDescription={rec.detailedDescription}
                              onViewDetails={() =>
                                openRecommendationDetail(rec)
                              }
                              isSaved={saves.some(
                                (s) =>
                                  String(s.solutionSnapshot.solutionTitle) ===
                                    rec.solutionTitle &&
                                  s.locationType ===
                                    savedLocationPayload?.locationType &&
                                  (s.locationId ===
                                    savedLocationPayload?.locationId ||
                                    s.locationName ===
                                      savedLocationPayload?.locationName),
                              )}
                              onToggleSave={
                                savedLocationPayload
                                  ? (e) => handleToggleSave(e, rec)
                                  : undefined
                              }
                            />
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {isDetailFullscreen && selectedRecommendation && selectedFeature
          ? createPortal(
              <div
                className="hidden lg:flex fixed inset-0 z-[120] bg-neutral-900/45 backdrop-blur-sm p-6"
                onClick={() => setIsDetailFullscreen(false)}
              >
                <div
                  className="mx-auto flex h-full w-full max-w-[1440px] overflow-hidden rounded-[2rem] border border-white/50 bg-white/95 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950/95 dark:shadow-black/40"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex w-full flex-col overflow-hidden">
                    <div className="flex items-center justify-between border-b border-neutral-100 bg-white/70 p-6 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-950/60">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="shrink-0 rounded-2xl bg-primary-green/10 p-3.5 text-primary-green shadow-inner dark:bg-primary-green/20 dark:text-primary-green/80">
                          <MapPin size={28} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-lg font-black leading-tight text-neutral-900 dark:text-neutral-50">
                            {selectedFeature.name || "Target Area"}
                          </h4>
                          <p className="mt-0.5 text-xs font-bold text-neutral-500 opacity-70 dark:text-neutral-400">
                            {selectedFeature.address || "Analyzing location..."}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={clearSelection}
                        className="rounded-full p-2.5 text-neutral-400 transition-all hover:rotate-90 hover:bg-neutral-100 hover:text-red-500 dark:text-neutral-500 dark:hover:bg-neutral-800"
                      >
                        <X size={24} />
                      </button>
                    </div>

                    <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
                      <SidebarDetail
                        recommendation={selectedRecommendation}
                        selectedFeature={selectedFeature}
                        selectedBarangayData={activeBarangayData ?? null}
                        onBack={handleDetailBack}
                        currentTab={detailCurrentTab}
                        onCurrentTabChange={setDetailCurrentTab}
                        chatMessages={detailChatMessages}
                        onChatMessagesChange={setDetailChatMessages}
                        chatInput={detailChatInput}
                        onChatInputChange={setDetailChatInput}
                        isChatLoading={isDetailChatLoading}
                        onChatLoadingChange={setIsDetailChatLoading}
                        timelineViewMode={detailTimelineView}
                        onTimelineViewModeChange={setDetailTimelineView}
                        isFullscreen
                        onToggleFullscreen={() => setIsDetailFullscreen(false)}
                        isSaved={saves.some(
                          (s) =>
                            String(s.solutionSnapshot.solutionTitle) ===
                              selectedRecommendation.solutionTitle &&
                            s.locationType ===
                              savedLocationPayload?.locationType &&
                            (s.locationId ===
                              savedLocationPayload?.locationId ||
                              s.locationName ===
                                savedLocationPayload?.locationName),
                        )}
                        onToggleSave={
                          savedLocationPayload
                            ? (e) => handleToggleSave(e, selectedRecommendation)
                            : undefined
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null}

        {isGenerating && (
          <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white/60 backdrop-blur-md animate-in fade-in duration-500">
            <div className="flex flex-col items-center gap-6 p-10 bg-white rounded-[3rem] shadow-3xl border border-neutral-100 animate-in zoom-in-95 duration-500 dark:bg-neutral-900 dark:border-neutral-800">
              <div className="relative">
                <div className="h-24 w-24 animate-spin rounded-full border-[6px] border-primary-green/10 border-t-primary-green shadow-sm" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sprout
                    size={36}
                    className="text-primary-green animate-bounce"
                  />
                </div>
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-black text-neutral-900 tracking-tight dark:text-neutral-100">
                  Analyzing Local Research
                </h2>
                <p className="text-neutral-500 font-medium max-w-xs leading-relaxed dark:text-neutral-400">
                  Our RAG engine is retrieving scientific studies and site
                  metrics to generate site-specific solutions.
                </p>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-green animate-pulse" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary-green animate-pulse delay-150" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary-green animate-pulse delay-300" />
              </div>
            </div>
          </div>
        )}

        {showWarning && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex justify-center items-center z-[100] p-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl p-10 shadow-3xl max-w-sm w-full text-center space-y-8 animate-in zoom-in-95 duration-300">
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
    </>
  );
}
