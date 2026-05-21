"use client";

import { useState } from "react";
import { RotateCw, Sparkles, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import GreenSolutionCard from "@/components/ui/general/cards/greensolution-infocard";
import type { SelectedFeature } from "@/types/metrics";
import type { VisionContext } from "@/lib/vision/context";
import type { UIRecommendation } from "@/lib/recommendations";
import type { SavePayload } from "@/types/green_solutions";
import type { SavedSolutionRow } from "@/hooks/useSavedSolutions";
import VisionReferencePanel from "@/components/vision/VisionReferencePanel";
import VisionAnalysisCard from "./VisionAnalysisCard";

const DISPLAY_COUNT = 3;

export default function ExploreDesktopListInterventions({
  visionContext,
  visionTags,
  isVisionAnalyzing,
  imageUrl,
  selectedFeature,
  clearSelection,
  hasUsableVisionContext,
  visionStatusMessage,
  ragRecommendations,
  generateError,
  isGenerating,

  handleGenerate,
  handleRegenerate,
  handleClearRecommendations,
  openRecommendationDetail,
  savedLocationPayload,
  savedSolutions,
  handleToggleSave,
  saves,
}: {
  visionContext: VisionContext | null;
  visionTags: string[];
  isVisionAnalyzing: boolean;
  imageUrl: string | null;
  selectedFeature: SelectedFeature | null;
  clearSelection: () => void;
  hasUsableVisionContext: boolean;
  visionStatusMessage: string | null;
  ragRecommendations: UIRecommendation[] | null;
  generateError: string | null;
  isGenerating: boolean;
  generatingStep?: string | null;
  handleGenerate: () => void;
  handleRegenerate: () => void;
  handleClearRecommendations: () => void | Promise<void>;
  openRecommendationDetail: (rec: UIRecommendation) => void;
  savedLocationPayload: Omit<
    SavePayload,
    "solutionSnapshot" | "contextSnapshot"
  > | null;
  savedSolutions: SavedSolutionRow[];
  handleToggleSave: (
    e: React.MouseEvent,
    rec: UIRecommendation,
  ) => void | Promise<void>;
  saves: SavedSolutionRow[];
}) {
  const [showAll, setShowAll] = useState(false);

  return (
    <>
      <VisionAnalysisCard
        visionContext={visionContext}
        quickTags={visionTags}
        isAnalyzing={isVisionAnalyzing}
      />

      {imageUrl && selectedFeature?.name === "Photo Location" ? (
        <div className="flex w-full max-w-full shrink-0 justify-center">
          <VisionReferencePanel
            imageUrl={imageUrl}
            visionContext={visionContext}
            showMiniLegend
            miniLegendToRight
            size="sm"
            onClearPress={clearSelection}
            showClearOnHover={false}
          />
        </div>
      ) : null}

      <div className="space-y-5">
        <div className="rounded-xl border border-primary-green/20 bg-primary-green/5 px-3 py-2 dark:border-primary-green/30 dark:bg-primary-green/10">
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary-green dark:text-primary-green/80">
            Recommendation Context
          </p>
          {isVisionAnalyzing ? (
            <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-primary-green dark:text-primary-green/80">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-green/30 border-t-primary-green" />
              <span>Analyzing uploaded image...</span>
            </div>
          ) : (
            <p className="mt-1 text-xs font-medium text-neutral-600 dark:text-neutral-300">
              {hasUsableVisionContext
                ? "Using image analysis + location metrics for intervention ranking."
                : "Using location metrics only (image analysis unavailable or low confidence)."}
            </p>
          )}
          {!isVisionAnalyzing &&
          !hasUsableVisionContext &&
          visionStatusMessage ? (
            <p className="mt-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
              Reason: {visionStatusMessage}
            </p>
          ) : null}
          {!isVisionAnalyzing &&
          hasUsableVisionContext &&
          visionStatusMessage ? (
            <p className="mt-1 text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
              {visionStatusMessage}
            </p>
          ) : null}
        </div>

        {!ragRecommendations ? (
          <div className="flex flex-col items-center gap-3 py-2">
            {generateError && (
              <p className="w-full rounded-xl border border-red-100 bg-red-50 py-2 text-center text-xs font-semibold text-red-500 dark:border-red-900/30 dark:bg-red-950/20">
                {generateError}
              </p>
            )}
            <button
              onClick={() => handleGenerate()}
              disabled={isGenerating || selectedFeature?.isLoadingMetrics}
              className="group relative flex w-full items-center justify-center gap-3 rounded-2xl 
              bg-primary-green px-6 py-4 text-sm font-bold text-white 
              transition-all duration-300 hover:scale-[1.01] hover:bg-primary-green/90 active:scale-[0.98] 
              disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <div className="absolute inset-0 rounded-2xl bg-white/10 opacity-0 transition-opacity group-hover:opacity-100" />
              <>
                <Sparkles size={18} strokeWidth={2} className="animate-pulse" />
                <span className="tracking-tight">Generate AI Solutions</span>
              </>
            </button>
            <p className="text-center text-xs text-neutral-400">
              Powered by research-grounded RAG Engine
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-end px-1 flex-row gap-3">
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={isGenerating}
                className="flex w-full items-center justify-center gap-2 rounded-lg 
                border-1 border-neutral-200 py-2 text-[10px] font-bold uppercase
                text-neutral-400 transition-all hover:border-primary-green/30 hover:bg-primary-green/5
                 hover:text-primary-green disabled:cursor-not-allowed disabled:opacity-50
                 dark:border-neutral-800 dark:hover:border-primary-green/40"
              >
                <RotateCw size={14} className={isGenerating ? "animate-spin" : ""} />
                Regenerate
              </button>
              <button
                type="button"
                onClick={() => void handleClearRecommendations()}
                disabled={isGenerating}
                className="flex w-full items-center justify-center gap-2 rounded-lg 
                border-1 border-neutral-200 py-2 text-[10px] font-bold uppercase
                text-neutral-400 transition-all hover:border-primary-green/30 hover:bg-primary-green/5
                 hover:text-primary-green disabled:cursor-not-allowed disabled:opacity-50
                 dark:border-neutral-800 dark:hover:border-primary-green/40"
              >
                <Trash2 size={14} />
                Clear
              </button>
            </div>

            {/* Show top 3 by default, expand with "Show all" */}
            <div className="space-y-4">
              {(showAll
                ? ragRecommendations
                : ragRecommendations.slice(0, DISPLAY_COUNT)
              ).map((rec) => (
                <GreenSolutionCard
                  key={rec.id}
                  solutionTitle={rec.solutionTitle}
                  solutionDescription={rec.solutionDescription}
                  efficiencyLevel={rec.efficiencyLevel}
                  value={rec.value}
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

            {ragRecommendations.length > DISPLAY_COUNT && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="flex w-full items-center justify-center gap-2 rounded-xl 
                border border-dashed border-neutral-300 py-3 text-xs font-semibold
                text-neutral-500 transition-all hover:border-primary-green/40 hover:bg-primary-green/5
                hover:text-primary-green dark:border-neutral-700 dark:hover:border-primary-green/40"
              >
                {showAll ? (
                  <>
                    <ChevronUp size={16} />
                    Show top {DISPLAY_COUNT} solutions
                  </>
                ) : (
                  <>
                    <ChevronDown size={16} />
                    Show all {ragRecommendations.length} solutions
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {savedSolutions.length > 0 && !ragRecommendations ? (
          <div
            className="space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 
          dark:border-neutral-800 dark:bg-neutral-950"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-neutral-600">
                  SAVED SOLUTIONS
                </p>
                <p className="text-[11px] text-neutral-500 leading-tight">
                  Showing saved plans for the selected location. For more
                  details and for other places, view in the dedicated Saved
                  Solutions page
                </p>
              </div>
            </div>
            <div className="space-y-4">
              {savedSolutions.map((save) => {
                const rec =
                  save.solutionSnapshot as unknown as UIRecommendation;
                return (
                  <GreenSolutionCard
                    key={save.id}
                    solutionTitle={rec.solutionTitle}
                    solutionDescription={rec.solutionDescription}
                    efficiencyLevel={rec.efficiencyLevel}
                    value={rec.value}
                    onViewDetails={() => openRecommendationDetail(rec)}
                    isSaved={true}
                    onToggleSave={
                      savedLocationPayload
                        ? (e) => handleToggleSave(e, rec)
                        : undefined
                    }
                  />
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
