"use client";

import { X } from "lucide-react";

interface ExploreWarningModalProps {
  showWarning: "no-gps" | "out-of-bounds" | null;
  onDismiss: () => void;
}

/**
 * Warning modal shown when a photo lacks GPS data or is outside the
 * service area.
 */
export default function ExploreWarningModal({
  showWarning,
  onDismiss,
}: ExploreWarningModalProps) {
  if (!showWarning) return null;

  return (
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
          onClick={onDismiss}
          className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all active:scale-95 shadow-lg shadow-neutral-200"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
