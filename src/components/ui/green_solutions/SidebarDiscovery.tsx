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

// ---------------------------------------------------------------------------
// Static recommendation catalogue
// ---------------------------------------------------------------------------
export const RECOMMENDATIONS = getUIRecommendations();

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface SidebarDiscoveryProps {
  selectedFeature: SelectedFeature | null;
  selectedBarangayData: BarangayData | null;
  locationSelectionMode: LocationSelectionMode;
  onSelectionModeChange: (mode: LocationSelectionMode) => void;
  onClearSelection: () => void;
  onUploadRequested: () => void;
  onSelectRecommendation: (rec: UIRecommendation) => void;
  /** When true the large page header is hidden (e.g. inside mobile bottom sheet) */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Component — renders as a fragment so the parent flex container owns the gap
// ---------------------------------------------------------------------------
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
      {/* Page header — hidden in compact (mobile) mode */}
      {!compact && (
        <header className="space-y-2 shrink-0">
          <h1 className="text-3xl font-bold text-neutral-900 tracking-tight">
            Greening Suggestions
          </h1>
          <p className="text-neutral-500 text-lg leading-relaxed">
            Discover site-specific greening interventions to mitigate
            environmental hazards and enhance urban livability.
          </p>
        </header>
      )}

      {/* Selection Mode Toggle */}
      <div className="shrink-0 bg-white/70 backdrop-blur-md rounded-2xl p-2 shadow-sm border border-neutral-200 flex items-center justify-between px-4">
        <span className="text-sm font-bold text-neutral-600 uppercase tracking-widest">
          Selection Mode
        </span>
        <div className="flex items-center gap-2">
          {(["poi", "barangay"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => onSelectionModeChange(mode)}
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
      <div className="flex-1 bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-neutral-200/50 border border-neutral-200 flex flex-col overflow-hidden min-h-0">
        {/* Location header row */}
        <div className="p-6 flex items-center justify-between border-b border-neutral-100 shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <div className="p-3 bg-neutral-100 rounded-2xl text-primary-green shrink-0">
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
              onClick={onClearSelection}
              className="p-2 hover:bg-neutral-100 rounded-full text-neutral-400 transition-colors shrink-0"
            >
              <X size={24} />
            </button>
          ) : (
            <button
              onClick={onUploadRequested}
              className="flex items-center gap-2 bg-neutral-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-neutral-800 transition-all shrink-0"
            >
              <Camera size={18} />
              <span>Upload</span>
            </button>
          )}
        </div>

        {/* Content */}
        {selectedFeature ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
            <MetricsDashboard barangayData={selectedBarangayData} />

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-neutral-100" />
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-[0.2em]">
                  Recommendations
                </span>
                <div className="h-px flex-1 bg-neutral-100" />
              </div>

              <div className="space-y-3">
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
                    onViewDetails={() => onSelectRecommendation(rec)}
                  />
                ))}
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
    </>
  );
}
