"use client";

import {
  useEffect,
  useCallback,
  Suspense,
} from "react";
import dynamic from "next/dynamic";
import mapboxgl from "mapbox-gl";
import exifr from "exifr";
import Navbar from "@/components/ui/general/layout/navbar";
import { useBarangay } from "@/context/BarangayContext";
import type { SelectedFeature } from "@/types/metrics";
import {
  POINT_SELECTION_AREA_HECTARES,
} from "@/lib/selection-area";
import { toast } from "sonner";
import type { VisionContext } from "@/lib/vision/context";
import SideBar from "@/components/explore/SideBar";
import SearchParamSync from "@/components/explore/SearchParamSync";
import type { UIRecommendation } from "@/lib/recommendations";
import ExploreGeneratingOverlay from "./components/ExploreGeneratingOverlay";
import ExploreWarningModal from "./components/ExploreWarningModal";

// Hooks
import { useExploreViewState } from "./hooks/useExploreViewState";
import { useDetailPanelState } from "./hooks/useDetailPanelState";
import { useFeatureSelection } from "./hooks/useFeatureSelection";
import { useMetricsTracking } from "./hooks/useMetricsTracking";
import { useVisionContext } from "./hooks/useVisionContext";
import { useRecommendationGeneration } from "./hooks/useRecommendationGeneration";
import { useExploreSavedSolutions } from "./hooks/useExploreSavedSolutions";
import { useBarangayGeoData } from "./hooks/useBarangayGeoData";

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

export default function ExplorePage() {
  // ── Hooks: state ownership ──────────────────────────────────────────────
  const { geoData } = useBarangayGeoData();
  const { selectedBarangay: activeBarangayData, setSelectedBarangay } =
    useBarangay();

  const {
    activeView,
    setActiveView,
    isDetailFullscreen,
    setIsDetailFullscreen,
    handleDetailBack,
  } = useExploreViewState();

  const {
    selectedRecommendation,
    setSelectedRecommendation,
    detailCurrentTab,
    setDetailCurrentTab,
    detailChatMessages,
    setDetailChatMessages,
    detailChatInput,
    setDetailChatInput,
    isDetailChatLoading,
    setIsDetailChatLoading,
    detailTimelineView,
    setDetailTimelineView,
    resetDetailState,
  } = useDetailPanelState();

  const {
    selectedFeature,
    setSelectedFeature,
    locationSelectionMode,
    setLocationSelectionMode,
    isSidebarOpen,
    setIsSidebarOpen,
    bottomExpanded,
    setBottomExpanded,
    mapRef,
    markerRef,
    removeMarkerRef,
    clearSelectedBarangayHighlight,
  } = useFeatureSelection();

  const { trackLocationMetrics } = useMetricsTracking();

  const {
    imageUrl,
    setImageUrl,
    visionContext,
    setVisionContext,
    visionTags,
    setVisionTags,
    visionStatusMessage,
    setVisionStatusMessage,
    isVisionAnalyzing,
    setIsVisionAnalyzing,
    showWarning,
    setShowWarning,
    fileInputRef,
    hasUsableVisionContext,
    visionSupplementalLegends,
    clearVisionState,
  } = useVisionContext();

  const {
    ragRecommendations,
    setRagRecommendations,
    isGenerating,
    generateError,
    setGenerateError,
    generatingStep,
    handleGenerate,
  } = useRecommendationGeneration();

  const {
    saves,
    savedLocationPayload,
    matchingSavedSolutions,
    selectedAreaHectares,
    handleToggleSave,
  } = useExploreSavedSolutions(
    selectedFeature,
    locationSelectionMode,
    activeBarangayData,
    visionContext,
  );

  // ── Match barangay when geo data or feature changes ───────────────────────
  useEffect(() => {
    if (!selectedFeature?.barangay) {
      setSelectedBarangay(null);
      return;
    }
    if (!geoData) return;

    const matched = geoData.find(
      (b) =>
        b.name?.toLowerCase() === selectedFeature.barangay?.toLowerCase(),
    );
    if (matched) {
      const props = selectedFeature.properties ?? {};
      setSelectedBarangay({
        ...matched,
        greeneryIndex:
          typeof props.greeneryIndex === "number"
            ? props.greeneryIndex
            : matched.greeneryIndex ?? 0,
        ndvi:
          typeof props.ndvi === "number"
            ? props.ndvi
            : matched.ndvi ?? 0,
        lst:
          typeof props.temperature === "number"
            ? props.temperature
            : typeof props.lst === "number"
              ? props.lst
              : matched.lst ?? 0,
        treeCanopy:
          typeof props.treeCanopy === "number"
            ? props.treeCanopy
            : matched.treeCanopy ?? 0,
      });
    } else {
      setSelectedBarangay(null);
    }
  }, [geoData, selectedFeature, setSelectedBarangay]);

  // ── Orchestration callbacks ──────────────────────────────────────────────

  const clearSelection = useCallback(() => {
    clearSelectedBarangayHighlight(
      selectedFeature?.barangay ?? activeBarangayData?.name ?? null,
    );
    setSelectedFeature(null);
    setSelectedBarangay(null);
    setRagRecommendations(null);
    clearVisionState();
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    removeMarkerRef.current?.();
    setIsSidebarOpen(false);
    setBottomExpanded(false);
    setActiveView("LIST");
    setSelectedRecommendation(null);
    setGenerateError(null);
    setIsDetailFullscreen(false);
    resetDetailState();
  }, [
    activeBarangayData,
    clearSelectedBarangayHighlight,
    clearVisionState,
    markerRef,
    removeMarkerRef,
    resetDetailState,
    selectedFeature,
    setSelectedBarangay,
    setSelectedRecommendation,
    setRagRecommendations,
    setGenerateError,
    setIsDetailFullscreen,
    setActiveView,
    setBottomExpanded,
    setIsSidebarOpen,
    setSelectedFeature,
  ]);

  const handleFeatureSelected = useCallback(
    (feature: SelectedFeature) => {
      setSelectedFeature(feature);
      setRagRecommendations(null);
      setSelectedRecommendation(null);
      setActiveView("LIST");
      resetDetailState();
      setVisionContext(null);
      setVisionTags([]);
      setVisionStatusMessage(null);
      setIsVisionAnalyzing(false);

      if (
        !feature.isLoadingMetrics &&
        (feature.barangay || feature.properties)
      ) {
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
    [
      trackLocationMetrics,
      resetDetailState,
      setSelectedRecommendation,
      setRagRecommendations,
      setVisionContext,
      setVisionTags,
      setVisionStatusMessage,
      setIsVisionAnalyzing,
      setActiveView,
      setSelectedFeature,
    ],
  );

  const handleGenerateWithContext = useCallback(
    (forceRefresh?: boolean) => {
      void handleGenerate({
        selectedFeature: selectedFeature!,
        activeBarangayData,
        locationSelectionMode,
        visionContext,
        selectedAreaHectares,
        trackLocationMetrics,
        forceRefresh,
      });
    },
    [
      selectedFeature,
      activeBarangayData,
      locationSelectionMode,
      visionContext,
      selectedAreaHectares,
      trackLocationMetrics,
      handleGenerate,
    ],
  );

  const openRecommendationDetail = useCallback(
    (recommendation: UIRecommendation) => {
      resetDetailState();
      setSelectedRecommendation(recommendation);
      setActiveView("DETAIL");
      setIsDetailFullscreen(false);
    },
    [resetDetailState, setSelectedRecommendation, setActiveView, setIsDetailFullscreen],
  );


  const handleFileUploaded = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !mapRef.current) return;

    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setVisionContext(null);
    setVisionTags([]);
    setVisionStatusMessage(null);
    setIsVisionAnalyzing(true);

    try {
      const gps = await exifr.gps(file);
      if (!gps?.latitude || !gps?.longitude) {
        setShowWarning("no-gps");
        setIsVisionAnalyzing(false);
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
        setIsVisionAnalyzing(false);
        return;
      }

      mapRef.current.flyTo({
        center: [lng, lat],
        zoom: 16,
        speed: 1.2,
        essential: true,
      });

      if (markerRef.current) markerRef.current.remove();
      const newMarker = new mapboxgl.Marker({ color: "#DB4848" })
        .setLngLat([lng, lat])
        .addTo(mapRef.current);
      markerRef.current = newMarker;

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
        pointSelectionAreaHectares: POINT_SELECTION_AREA_HECTARES,
      });

      try {
        const formData = new FormData();
        formData.append("image", file);
        formData.append("lat", String(lat));
        formData.append("lng", String(lng));
        formData.append("barangay", String(barangay));
        const visionRes = await fetch("/api/geophotos/analyze", {
          method: "POST",
          body: formData,
        });
        const visionJson = (await visionRes.json()) as {
          success?: boolean;
          data?: {
            visionContext?: VisionContext | null;
            analysisError?: string | null;
            quickTags?: string[];
            analysisSource?: "cache" | "openai";
          };
          error?: string;
        };
        if (visionJson.success) {
          setVisionContext(visionJson.data?.visionContext ?? null);
          setVisionTags(visionJson.data?.quickTags ?? []);
          if (!visionJson.data?.visionContext) {
            setVisionStatusMessage(
              visionJson.data?.analysisError ??
                "Vision analysis was unavailable for this image.",
            );
          } else if (visionJson.data.visionContext.confidence < 0.35) {
            setVisionStatusMessage(
              `Vision confidence too low (${Math.round(
                visionJson.data.visionContext.confidence * 100,
              )}%). Falling back to metric-based recommendations.`,
            );
          } else {
            setVisionStatusMessage(
              visionJson.data.analysisSource === "cache"
                ? "Loaded cached image analysis from a previous upload."
                : null,
            );
          }
          if (visionJson.data?.analysisError) {
            toast.warning(
              "Image uploaded but vision extraction had low confidence. Using metric-only recommendations.",
            );
          }
        } else {
          setVisionContext(null);
          setVisionTags([]);
          setVisionStatusMessage(
            visionJson.error ??
              "Vision analysis request failed. Continuing with metric-based recommendations.",
          );
          toast.warning(
            "Photo uploaded but vision analysis was unavailable. Continuing with metric-based recommendations.",
          );
        }
      } catch (error) {
        console.error("Geo-photo analysis failed:", error);
        setVisionContext(null);
        setVisionTags([]);
        setVisionStatusMessage(
          error instanceof Error
            ? error.message
            : "Vision analysis failed. Continuing with metric-based recommendations.",
        );
        toast.warning(
          "Vision analysis failed. Continuing with metric-based recommendations.",
        );
      } finally {
        setIsVisionAnalyzing(false);
      }
    } catch (err) {
      console.error("EXIF Error:", err);
      setShowWarning("no-gps");
      setIsVisionAnalyzing(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
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
            searchBoxLocation="top-6 left-16 z-30 sm:left-24 lg:left-24 lg:w-[min(28rem,calc(100vw-7rem))] lg:max-w-[min(28rem,calc(100vw-7rem))]"
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
            supplementalLegends={visionSupplementalLegends}
          />
        </div>

        <SideBar
          core={{
            isOpen: isSidebarOpen,
            activeView,
            selectedFeature,
            clearSelection,
            activeBarangayData: activeBarangayData ?? null,
            locationSelectionMode,
          }}
          detail={{
            isFullscreen: isDetailFullscreen,
            setIsFullscreen: setIsDetailFullscreen,
            recommendation: selectedRecommendation,
            handleBack: handleDetailBack,
            currentTab: detailCurrentTab,
            setTab: setDetailCurrentTab,
            chatMessages: detailChatMessages,
            setChatMessages: setDetailChatMessages,
            chatInput: detailChatInput,
            setChatInput: setDetailChatInput,
            isChatLoading: isDetailChatLoading,
            setIsChatLoading: setIsDetailChatLoading,
            timelineView: detailTimelineView,
            setTimelineView: setDetailTimelineView,
          }}
          vision={{
            context: visionContext,
            tags: visionTags,
            isAnalyzing: isVisionAnalyzing,
            imageUrl,
            hasUsableContext: hasUsableVisionContext,
            statusMessage: visionStatusMessage,
          }}
          generation={{
            ragRecommendations,
            setRagRecommendations,
            error: generateError,
            isGenerating,
            step: generatingStep,
            handleGenerate: handleGenerateWithContext,
            openRecommendationDetail,
          }}
          saving={{
            saves,
            savedLocationPayload,
            handleToggleSave,
            matchingSavedSolutions,
          }}
          mobile={{
            bottomExpanded,
            setBottomExpanded,
          }}
        />

        <ExploreGeneratingOverlay
          isGenerating={isGenerating}
          generatingStep={generatingStep}
        />

        <ExploreWarningModal
          showWarning={showWarning}
          onDismiss={() => setShowWarning(null)}
        />
      </main>
    </>
  );
}
