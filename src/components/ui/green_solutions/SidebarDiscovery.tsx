"use client";

import { type BarangayData } from "@/context/BarangayContext";
import { ImageIcon, Camera, MapPin, X, CircleHelp } from "lucide-react";
import GreenSolutionCard from "@/components/ui/general/cards/greensolution-infocard";
import MetricsDashboard from "@/components/ui/green_solutions/MetricsDashboard";
import { type LocationSelectionMode } from "@/types/maplayers";
import { type SelectedFeature } from "@/types/metrics";
import {
  getUIRecommendations,
  type UIRecommendation,
} from "@/lib/recommendations";

export const RECOMMENDATIONS = getUIRecommendations();

interface SidebarDiscoveryProps {
  selectedFeature: SelectedFeature | null;
  selectedBarangayData: BarangayData | null;
  locationSelectionMode: LocationSelectionMode;
  onSelectionModeChange: (mode: LocationSelectionMode) => void;
  onClearSelection: () => void;
  onUploadRequested: () => void;
  onSelectRecommendation: (rec: UIRecommendation) => void;
  compact?: boolean;
}

export default function SidebarDiscovery({
  selectedFeature,
  selectedBarangayData,
  locationSelectionMode,
  onSelectionModeChange,
  onClearSelection,
  onUploadRequested,
  onSelectRecommendation,
  compact = false,
}: SidebarDiscoveryProps) {
  return (
    <>
      {!compact && (
        <header className="space-y-2 shrink-0">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-50 tracking-tight">
            Greening Suggestions
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-lg leading-relaxed">
            Discover site-specific greening interventions to mitigate
            environmental hazards and enhance urban livability.
          </p>
        </header>
      )}

      <div
        className="shrink-0 rounded-2xl border border-neutral-200 bg-white/70 px-4 p-2 shadow-sm backdrop-blur-md 
      dark:border-neutral-800 dark:bg-neutral-950/70 dark:shadow-black/20 flex items-center justify-between"
      >
        <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">
          Selection Mode
        </span>
        <div className="flex items-center gap-2">
          {(["poi", "barangay", "custom"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => onSelectionModeChange(mode)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
                locationSelectionMode === mode
                  ? "bg-primary-green text-white shadow-md shadow-green-200/70 dark:shadow-green-950/40"
                  : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }`}
            >
              {mode === "poi"
                ? "Point of Interest"
                : mode === "barangay"
                  ? "Barangay Area"
                  : "Custom Area"}
            </button>
          ))}
          <button className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 dark:text-neutral-500 dark:hover:bg-neutral-800">
            <CircleHelp size={18} />
          </button>
        </div>
      </div>

      {locationSelectionMode === "custom" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
          Left-drag to outline a lasso area. Middle-drag to pan.
        </div>
      ) : null}

      <div className="flex-1 flex flex-col overflow-hidden min-h-0 rounded-3xl border border-neutral-200 bg-white/80 shadow-xl shadow-neutral-200/50 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950/70 dark:shadow-black/40">
        <div className="shrink-0 border-b border-neutral-100 p-6 flex items-center justify-between dark:border-neutral-800">
          <div className="flex items-center gap-4 min-w-0">
            <div className="shrink-0 rounded-2xl bg-neutral-100 p-3 text-primary-green dark:bg-neutral-900 dark:text-emerald-300">
              <MapPin size={28} />
            </div>
            <div className="min-w-0">
              <h4 className="truncate font-bold text-neutral-900 dark:text-neutral-50">
                {selectedFeature
                  ? selectedFeature.name
                  : "No Location Selected"}
              </h4>
              <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">
                {selectedFeature
                  ? selectedFeature.address
                  : "Interact with the map to start"}
              </p>
            </div>
          </div>

          {selectedFeature ? (
            <button
              onClick={onClearSelection}
              className="shrink-0 rounded-full p-2 text-neutral-400 transition-colors hover:bg-neutral-100 dark:text-neutral-500 dark:hover:bg-neutral-800"
            >
              <X size={24} />
            </button>
          ) : (
            <button
              onClick={onUploadRequested}
              className="shrink-0 flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
            >
              <Camera size={18} />
              <span>Upload</span>
            </button>
          )}
        </div>

        {selectedFeature ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
            <MetricsDashboard barangayData={selectedBarangayData} />

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-neutral-100 dark:bg-neutral-800" />
                <span className="text-xs font-semibold text-neutral-400 dark:text-neutral-500">
                  Recommendations
                </span>
                <div className="h-px flex-1 bg-neutral-100 dark:bg-neutral-800" />
              </div>

              <div className="space-y-3">
                {RECOMMENDATIONS.map((rec) => (
                  <GreenSolutionCard
                    key={rec.id}
                    solutionTitle={rec.solutionTitle}
                    solutionDescription={rec.solutionDescription}
                    efficiencyLevel={rec.efficiencyLevel}
                    value={rec.value}
                    onViewDetails={() => onSelectRecommendation(rec)}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center gap-4">
            <div className="rounded-full bg-neutral-50 p-8 text-neutral-200 dark:bg-neutral-900 dark:text-neutral-700">
              <ImageIcon size={64} />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-neutral-400 dark:text-neutral-300">
                Awaiting Input
              </p>
              <p className="text-sm text-neutral-300 dark:text-neutral-500">
                Select a point or upload a photo to generate solutions
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
