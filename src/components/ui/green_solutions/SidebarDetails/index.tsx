"use client";

import { useState } from "react";
import { ArrowLeft, Info, MessageSquare } from "lucide-react";
import { type BarangayData } from "@/context/BarangayContext";
import { type GreenRecommendation, type DetailTab } from "@/types/green_solutions";
import { type SelectedFeature } from "@/types/metrics";
import InfoTab from "./InfoTab";
import ChatTab from "./ChatTab";

interface SidebarDetailProps {
  recommendation: GreenRecommendation;
  selectedFeature: SelectedFeature;
  selectedBarangayData: BarangayData | null;
  onBack: () => void;
}

const TABS: { id: DetailTab; label: string; Icon: React.ElementType }[] = [
  { id: "INFO", label: "Technical Info", Icon: Info },
  { id: "CHAT", label: "AI Assistant", Icon: MessageSquare },
];

/**
 * Master-Detail right panel.
 * Renders a breadcrumb Back button, a tab bar, and the active tab content.
 * Designed to be the sole child in the desktop sidebar flex-col container.
 */
export default function SidebarDetail({
  recommendation,
  selectedFeature,
  selectedBarangayData,
  onBack,
}: SidebarDetailProps) {
  const [currentTab, setCurrentTab] = useState<DetailTab>("INFO");

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      {/* ── Header: breadcrumb + tab bar ── */}
      <div className="px-6 pt-5 pb-0 border-b border-neutral-100 space-y-3 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-bold text-neutral-500 hover:text-primary-green transition-colors group w-fit"
        >
          <ArrowLeft
            size={15}
            className="group-hover:-translate-x-0.5 transition-transform duration-150"
          />
          Back to Recommendations
        </button>

        {/* Recommendation title line */}
        <p className="text-xs font-bold text-neutral-400 uppercase tracking-[0.2em] truncate">
          {recommendation.solutionTitle}
        </p>

        {/* Tab bar */}
        <div className="flex items-center gap-2 pb-3">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setCurrentTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                currentTab === id
                  ? "bg-primary-green text-white shadow-md shadow-green-200"
                  : "text-neutral-500 hover:bg-neutral-100"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content area ── */}
      <div className="flex-1 overflow-hidden">
        {currentTab === "INFO" ? (
          <InfoTab
            recommendation={recommendation}
            selectedFeature={selectedFeature}
            selectedBarangayData={selectedBarangayData}
          />
        ) : (
          <ChatTab
            recommendation={recommendation}
            selectedFeature={selectedFeature}
          />
        )}
      </div>
    </div>
  );
}
