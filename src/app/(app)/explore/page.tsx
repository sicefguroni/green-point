"use client";

import {
  useEffect,
  useCallback,
  useRef,
  useState,
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

  /* ── No-GPS photo → manual pin placement ── */
  const pendingManualPinRef = useRef<{ file: File; url: string } | null>(null);
  const [isAwaitingManualPin, setIsAwaitingManualPin] = useState(false);

  /* ── Ref for overlay to expose upload-accepted callback ── */
  const uploadAcceptedRef = useRef<(() => void) | null>(null);

  /* ── Guards stale feature_selection callbacks from overwriting a photo upload ── */
  const photoModeRef = useRef(false);

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
    visionProgress,
    setVisionProgress,
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
    photoModeRef.current = false;
    clearSelectedBarangayHighlight(
      selectedFeature?.barangay ?? activeBarangayData?.name ?? null,
    );
    setSelectedFeature(null);
    setSelectedBarangay(null);
    setRagRecommendations(null);
    clearVisionState();
    pendingManualPinRef.current = null;
    setIsAwaitingManualPin(false);
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
    setIsAwaitingManualPin,
  ]);

  /* ── Shared: continue photo upload with validated coordinates ── */
  /*     Called from handleFileUploaded (GPS found) OR from                  */
  /*     handleFeatureSelected (manual pin after no-GPS).                   */
  const continuePhotoUpload = useCallback(
    async (lat: number, lng: number, barangay: string, file: File) => {
      if (!mapRef.current) return;
      if (!photoModeRef.current) return; // cancelled while loading

      /* ── Set feature immediately with skeleton ── */
      setSelectedFeature({
        name: "Photo Location",
        address: "Detected Photo Location",
        coords: { lng, lat },
        barangay,
        pointSelectionAreaHectares: POINT_SELECTION_AREA_HECTARES,
        isLoadingMetrics: true,
      });

      setVisionProgress("Navigating to photo location…");

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

      /* ── Geocode in background for a proper address ── */
      let address = "Detected Photo Location";
      try {
        const geocodeRes = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxgl.accessToken}`,
        );
        const geocodeData = await geocodeRes.json();
        address =
          geocodeData.features?.[0]?.place_name || "Detected Photo Location";
      } catch { /* non-fatal */ }

      setSelectedFeature((prev) =>
        prev ? { ...prev, address } : null,
      );

      setVisionProgress("Fetching environmental data & running vision analysis…");

      /* ── Fire point-metrics + vision in parallel ── */
      const [pointMetrics, visionResult] = await Promise.all([
        (async () => {
          try {
            const mRes = await fetch(
              `/api/data?resource=point&lat=${lat}&lng=${lng}`,
            );
            const mObj = await mRes.json();
            if (mObj.ok && mObj.data?.success && mObj.data.metrics) {
              return mObj.data.metrics as Record<string, unknown>;
            }
          } catch { /* non-fatal */ }
          return null;
        })(),
        (async () => {
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
            return (await visionRes.json()) as {
              success?: boolean;
              data?: {
                visionContext?: VisionContext | null;
                analysisError?: string | null;
                quickTags?: string[];
                analysisSource?: "cache" | "openai";
              };
              error?: string;
            };
          } catch (error) {
            console.error("Geo-photo analysis failed:", error);
            return null;
          }
        })(),
      ]);

      setVisionProgress("Processing results…");

      /* ── Update feature with real point-level metrics ── */
      if (pointMetrics) {
        setSelectedFeature((prev) =>
          prev
            ? {
                ...prev,
                properties: {
                  ...prev.properties,
                  ndvi: (pointMetrics.ndvi as number) ?? prev.properties?.ndvi,
                  temperature:
                    (pointMetrics.lst as number) ?? prev.properties?.temperature,
                  treeCanopy:
                    (pointMetrics.treeCanopy as number) ??
                    prev.properties?.treeCanopy,
                  greeneryIndex:
                    (pointMetrics.greeneryIndex as number) ??
                    prev.properties?.greeneryIndex,
                  nearbyTaggedTreeCount:
                    (pointMetrics.nearbyTaggedTreeCount as number) ?? 0,
                  inventoryCanopyFraction:
                    (pointMetrics.inventoryCanopyFraction as number) ?? 0,
                },
                isLoadingMetrics: false,
              }
            : null,
        );
      } else {
        setSelectedFeature((prev) =>
          prev ? { ...prev, isLoadingMetrics: false } : null,
        );
      }

      /* ── Apply vision result ── */
      if (visionResult) {
        if (visionResult.success) {
          setVisionContext(visionResult.data?.visionContext ?? null);
          setVisionTags(visionResult.data?.quickTags ?? []);
          if (!visionResult.data?.visionContext) {
            setVisionStatusMessage(
              visionResult.data?.analysisError ??
                "Vision analysis was unavailable for this image.",
            );
          } else if (visionResult.data.visionContext.confidence < 0.35) {
            setVisionStatusMessage(
              `Vision confidence too low (${Math.round(
                visionResult.data.visionContext.confidence * 100,
              )}%). Falling back to metric-based recommendations.`,
            );
          } else {
            setVisionStatusMessage(
              visionResult.data.analysisSource === "cache"
                ? "Loaded cached image analysis from a previous upload."
                : null,
            );
          }
          if (visionResult.data?.analysisError) {
            toast.warning(
              "Image uploaded but vision extraction had low confidence. Using metric-only recommendations.",
            );
          }
        } else {
          setVisionContext(null);
          setVisionTags([]);
          setVisionStatusMessage(
            visionResult.error ??
              "Vision analysis request failed. Continuing with metric-based recommendations.",
          );
          toast.warning(
            "Photo uploaded but vision analysis was unavailable. Continuing with metric-based recommendations.",
          );
        }
      } else {
        setVisionContext(null);
        setVisionTags([]);
        setVisionStatusMessage(
          "Vision analysis request failed. Continuing with metric-based recommendations.",
        );
        toast.warning(
          "Photo uploaded but vision analysis was unavailable. Continuing with metric-based recommendations.",
        );
      }

      /* ── Done analyzing ── */
      setIsVisionAnalyzing(false);
      setVisionProgress(null);
      photoModeRef.current = false;
    },
    [
      setSelectedFeature,
      markerRef,
      mapRef,
      setVisionContext,
      setVisionTags,
      setVisionStatusMessage,
      setIsVisionAnalyzing,
      setVisionProgress,
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

  const handleRegenerate = useCallback(() => {
    handleGenerateWithContext(true);
  }, [handleGenerateWithContext]);

  const handleClearRecommendations = useCallback(async () => {
    setRagRecommendations(null);
    setGenerateError(null);
    setSelectedRecommendation(null);
    if (activeView === "DETAIL") {
      setActiveView("LIST");
    }

    if (selectedFeature) {
      try {
        await fetch("/api/recommendations/generate", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            barangayName: selectedFeature.barangay || selectedFeature.name,
            barangayId: selectedFeature.barangay || null,
            locationSelectionMode,
            coords: selectedFeature.coords,
            customSelectionGeometry: selectedFeature.customSelectionGeometry,
          }),
        });
      } catch {
        toast.error("Could not clear server cache. Try regenerating.");
      }
    }
  }, [
    selectedFeature,
    locationSelectionMode,
    activeView,
    setRagRecommendations,
    setGenerateError,
    setSelectedRecommendation,
    setActiveView,
  ]);

  /* ── Helper: clear old recommendations / detail state when switching to a photo ── */
  const clearRecommendationsState = useCallback(() => {
    setRagRecommendations(null);
    resetDetailState();
    setActiveView("LIST");
    setSelectedRecommendation(null);
    setGenerateError(null);
  }, [
    setRagRecommendations,
    resetDetailState,
    setActiveView,
    setSelectedRecommendation,
    setGenerateError,
  ]);

  const handleFeatureSelected = useCallback(
    (feature: SelectedFeature) => {
      /* ── Intercept: manual pin after no-GPS photo upload ── */
      if (pendingManualPinRef.current) {
        const pending = pendingManualPinRef.current;
        pendingManualPinRef.current = null;
        setIsAwaitingManualPin(false);

        const coords = feature.coords;
        const barangay = feature.barangay || "";
        if (coords?.lat && coords?.lng && barangay) {
          clearRecommendationsState();
          setIsVisionAnalyzing(true);
          void continuePhotoUpload(
            coords.lat,
            coords.lng,
            barangay,
            pending.file,
          );
          return;
        }
        // Malformed feature — fall through to normal selection
      }

      /* ── Gate: All stale feature_selection callbacks during photo upload ── */
      if (photoModeRef.current) return;

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
      clearRecommendationsState,
      setSelectedRecommendation,
      setRagRecommendations,
      setVisionContext,
      setVisionTags,
      setVisionStatusMessage,
      setIsVisionAnalyzing,
      setActiveView,
      setSelectedFeature,
      continuePhotoUpload,
      setIsAwaitingManualPin,
    ],
  );

  const handleFileUploaded = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !mapRef.current) return;

    /* ── Reset file input so re-uploading the same image works ── */
    e.target.value = "";

    /* ── Mark photo mode so stale selection callbacks don't overwrite ── */
    photoModeRef.current = true;

    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setVisionContext(null);
    setVisionTags([]);
    setVisionStatusMessage(null);
    setVisionProgress("Extracting GPS from photo…");

    /* ── Notify overlay that file was actually accepted ── */
    uploadAcceptedRef.current?.();
    /* ── Confirm upload accepted (critical during overlay, helpful always) ── */
    toast.success("Photo received — switching to photo location.");

    try {
      const gps = await exifr.gps(file);

      /* ── No GPS? Let the user tap the map to set the location ── */
      if (!gps?.latitude || !gps?.longitude) {
        pendingManualPinRef.current = { file, url };
        setIsAwaitingManualPin(true);
        setLocationSelectionMode("poi");
        setVisionProgress(null);
        clearRecommendationsState();
        /* Show sidebar with photo preview + "Tap on map" prompt */
        setSelectedFeature({
          name: "Photo Location",
          address: "Tap on the map to place this photo",
          coords: { lng: 0, lat: 0 },
          barangay: "",
          isLoadingMetrics: false,
        });
        return;
      }

      /* ── User cancelled (X button) while GPS was loading? ── */
      if (!photoModeRef.current) return;

      setIsVisionAnalyzing(true);

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

      /* ── Switch to the photo location immediately ── */
      clearRecommendationsState();

      await continuePhotoUpload(lat, lng, barangay, file);
    } catch (err) {
      console.error("EXIF Error:", err);
      /* ── User cancelled while GPS was loading? ── */
      if (!photoModeRef.current) return;
      /* Couldn't read EXIF at all — let user place pin manually */
      if (!pendingManualPinRef.current) {
        pendingManualPinRef.current = { file, url };
        setIsAwaitingManualPin(true);
        setLocationSelectionMode("poi");
        clearRecommendationsState();
        setSelectedFeature({
          name: "Photo Location",
          address: "Tap on the map to place this photo",
          coords: { lng: 0, lat: 0 },
          barangay: "",
          isLoadingMetrics: false,
        });
      }
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
            isAwaitingManualPin,
            progress: visionProgress,
          }}
          generation={{
            ragRecommendations,
            error: generateError,
            isGenerating,
            step: generatingStep,
            handleGenerate: handleGenerateWithContext,
            handleRegenerate,
            handleClearRecommendations,
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
          onUploadRequested={() => fileInputRef.current?.click()}
          uploadAcceptedRef={uploadAcceptedRef}
        />

        <ExploreWarningModal
          showWarning={showWarning}
          onDismiss={() => setShowWarning(null)}
        />
      </main>
    </>
  );
}
