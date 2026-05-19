"use client";

import type { Dispatch, SetStateAction } from "react";
import { Sparkles, Sprout } from "lucide-react";
import GreenSolutionCard from "@/components/ui/general/cards/greensolution-infocard";
import type { SelectedFeature } from "@/types/metrics";
import type { VisionContext } from "@/lib/vision/context";
import { getUIRecommendations, type UIRecommendation } from "@/lib/recommendations";
import type { SavePayload } from "@/types/green_solutions";
import type { SavedSolutionRow } from "@/hooks/useSavedSolutions";
import VisionReferencePanel from "@/components/vision/VisionReferencePanel";
import VisionAnalysisCard from "./VisionAnalysisCard";

const RECOMMENDATIONS = getUIRecommendations();

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
  setRagRecommendations,
  generateError,
  isGenerating,
  generatingStep,
  handleGenerate,
  openRecommendationDetail,
  savedLocationPayload,
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
  setRagRecommendations: Dispatch<SetStateAction<UIRecommendation[] | null>>;
  generateError: string | null;
  isGenerating: boolean;
  generatingStep?: string | null;
  handleGenerate: () => void;
  openRecommendationDetail: (rec: UIRecommendation) => void;
  savedLocationPayload: Omit<
    SavePayload,
    "solutionSnapshot" | "contextSnapshot"
  > | null;
  handleToggleSave: (
    e: React.MouseEvent,
    rec: UIRecommendation,
  ) => void | Promise<void>;
  saves: SavedSolutionRow[];
}) {
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
              <span>
                Analyzing uploaded image...
              </span>
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
        <div className="flex items-center gap-4">
          <span className="whitespace-nowrap text-xs font-semibold text-neutral-400">
            Greening Recommendations
          </span>
          <div className="h-px flex-1 bg-neutral-100 dark:bg-neutral-800" />
        </div>

        {!ragRecommendations ? (
          <div className="flex flex-col items-center gap-3 py-2">
            {generateError && (
              <p className="w-full rounded-xl border border-red-100 bg-red-50 py-2 text-center text-xs font-semibold text-red-500 dark:border-red-900/30 dark:bg-red-950/20">
                {generateError}
              </p>
            )}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || selectedFeature?.isLoadingMetrics}
              className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-primary-green px-6 py-4 text-sm font-bold text-white shadow-[0_10px_25px_-5px_rgba(22,163,74,0.4)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-green-700 hover:shadow-green-300 active:scale-[0.98] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 disabled:shadow-none dark:shadow-green-900/30"
            >
              <div className="absolute inset-0 rounded-2xl bg-white/10 opacity-0 transition-opacity group-hover:opacity-100" />
              {isGenerating ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span className="tracking-tight">
                    {generatingStep || "Analyzing Research..."}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles size={18} className="animate-pulse" />
                  <span className="tracking-tight">Generate AI Solutions</span>
                </>
              )}
            </button>
            <p className="text-center text-xs font-medium text-neutral-400 opacity-60">
              Powered by research-grounded RAG Engine
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-end px-1">
              <button
                onClick={() => setRagRecommendations(null)}
                className="text-xs font-semibold text-neutral-400 transition-colors hover:text-primary-green"
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
            <button
              onClick={handleGenerate}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-200 py-3 text-[10px] font-black uppercase tracking-widest text-neutral-400 transition-all hover:border-primary-green/30 hover:bg-primary-green/5 hover:text-primary-green dark:border-neutral-800 dark:hover:border-primary-green/40"
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
              : "space-y-4 opacity-50 grayscale-[0.5] pointer-events-none"
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
  );
}
