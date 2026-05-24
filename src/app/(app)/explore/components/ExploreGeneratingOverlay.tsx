"use client";

import { useState, useCallback, useEffect, type MutableRefObject } from "react";
import { Sprout, Camera, Check } from "lucide-react";

interface ExploreGeneratingOverlayProps {
  isGenerating: boolean;
  generatingStep: string | null;
  onUploadRequested?: () => void;
  /** Ref that page.tsx calls after a file is actually accepted. */
  uploadAcceptedRef?: MutableRefObject<(() => void) | null>;
}

/**
 * Fullscreen overlay shown while recommendations are being generated.
 */
export default function ExploreGeneratingOverlay({
  isGenerating,
  generatingStep,
  onUploadRequested,
  uploadAcceptedRef,
}: ExploreGeneratingOverlayProps) {
  const [uploadFeedback, setUploadFeedback] = useState<"idle" | "received">("idle");

  /* ── Expose a function page.tsx calls when a file is actually accepted ── */
  useEffect(() => {
    if (!uploadAcceptedRef) return;
    uploadAcceptedRef.current = () => {
      setUploadFeedback("received");
      setTimeout(() => setUploadFeedback("idle"), 4000);
    };
    return () => {
      uploadAcceptedRef.current = null;
    };
  }, [uploadAcceptedRef]);

  const handleUploadClick = useCallback(() => {
    onUploadRequested?.();
  }, [onUploadRequested]);
  if (!isGenerating) return null;

  return (
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
          <h2 className="text-2xl font-bold text-neutral-900 tracking-tight dark:text-neutral-100">
            Generating Greening Solutions
          </h2>
          <p className="mx-auto text-neutral-500 text-sm font-medium max-w-xs min-h-[48px] flex items-center justify-center leading-relaxed dark:text-neutral-400">
            {generatingStep ||
              "Our RAG engine is retrieving scientific studies and site metrics to generate site-specific solutions."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-primary-green animate-pulse" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary-green animate-pulse delay-150" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary-green animate-pulse delay-300" />
        </div>

        {onUploadRequested && (
          <>
            <div className="w-full max-w-[8rem] h-px bg-neutral-100 dark:bg-neutral-800" />
            <button
              type="button"
              onClick={handleUploadClick}
              className={`flex items-center justify-center gap-2.5 rounded-2xl border px-5 py-2.5 text-sm font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] ${
                uploadFeedback === "received"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "border-neutral-200 bg-white text-primary-green hover:border-primary-green/40 hover:bg-primary-green/5 dark:border-neutral-700 dark:bg-neutral-950 dark:hover:border-primary-green/40"
              }`}
            >
              {uploadFeedback === "received" ? (
                <>
                  <Check size={18} />
                  <span>Photo received!</span>
                </>
              ) : (
                <>
                  <Camera size={18} />
                  <span>Upload a photo</span>
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
