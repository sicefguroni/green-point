"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  CalendarDays,
  CalendarRange,
  Expand,
  Info,
  MessageSquare,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { type BarangayData } from "@/context/BarangayContext";
import {
  type DetailTab,
  type ChatHistoryMessage,
} from "@/types/green_solutions";
import { type UIRecommendation } from "@/lib/recommendations";
import { type SelectedFeature } from "@/types/metrics";
import { type TimelineRecord } from "@/types/timeline";
import InfoTab from "./InfoTab";
import ChatTab from "./ChatTab";
import TimelineTab from "./TimelineTab";

interface SidebarDetailProps {
  recommendation: UIRecommendation;
  selectedFeature: SelectedFeature;
  selectedBarangayData: BarangayData | null;
  onBack: () => void;
}

const TABS: { id: DetailTab; label: string; Icon: React.ElementType }[] = [
  { id: "INFO", label: "Technical Info", Icon: Info },
  { id: "CHAT", label: "AI Assistant", Icon: MessageSquare },
  { id: "TIMELINE", label: "Timeline", Icon: CalendarRange },
];

type DisplayMode = "sidebar" | "fullscreen";

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
  const [chatHistory, setChatHistory] = useState<ChatHistoryMessage[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTimelineGenerating, setIsTimelineGenerating] = useState(false);
  const [timelineRecord, setTimelineRecord] = useState<TimelineRecord | null>(null);

  useEffect(() => {
    setTimelineRecord(null);
    setIsTimelineGenerating(false);
  }, [recommendation.id, selectedFeature?.name, selectedFeature?.address, selectedFeature?.barangay]);

  useEffect(() => {
    if (!isFullscreen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFullscreen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen]);

  const renderTabContent = (displayMode: DisplayMode) => {
    return (
      <>
        <div className={`h-full ${currentTab === "INFO" ? "block" : "hidden"}`}>
          <InfoTab
            recommendation={recommendation}
            selectedFeature={selectedFeature}
            selectedBarangayData={selectedBarangayData}
          />
        </div>
        <div className={`h-full ${currentTab === "CHAT" ? "flex flex-col" : "hidden"}`}>
          <ChatTab
            recommendation={recommendation}
            selectedFeature={selectedFeature}
            selectedBarangayData={selectedBarangayData}
            onHistoryChange={setChatHistory}
          />
        </div>
        <div className={`h-full ${currentTab === "TIMELINE" ? "block" : "hidden"}`}>
          <TimelineTab
            selectedRecommendation={recommendation}
            selectedFeature={selectedFeature}
            selectedBarangayData={selectedBarangayData}
            chatHistory={chatHistory}
            displayMode={displayMode}
            timelineRecord={timelineRecord}
            onTimelineRecordChange={setTimelineRecord}
            onGeneratingChange={setIsTimelineGenerating}
          />
        </div>
      </>
    );
  };

  const renderShell = (displayMode: DisplayMode) => {
    const isExpanded = displayMode === "fullscreen";

    return (
      <div
        className={
          isExpanded
            ? "flex h-full min-h-0 flex-col overflow-hidden rounded-[30px] border border-white/20 bg-white shadow-2xl"
            : "flex-1 min-h-0 flex flex-col overflow-hidden"
        }
      >
        <div
          className={
            isExpanded
              ? "shrink-0 space-y-4 border-b border-neutral-100 px-6 py-5 md:px-8"
              : "shrink-0 space-y-3 border-b border-neutral-100 pb-0 sm:px-2 lg:px-6"
          }
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <button
                onClick={onBack}
                className="flex w-fit items-center gap-2 text-sm font-bold text-neutral-500 transition-colors hover:text-primary-green group"
              >
                <ArrowLeft
                  size={15}
                  className="transition-transform duration-150 group-hover:-translate-x-0.5"
                />
                Back to Recommendations
              </button>
            </div>

            <div className="hidden shrink-0 items-center gap-2 lg:flex">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFullscreen(!isExpanded)}
                className="whitespace-nowrap"
              >
                {isExpanded ? <Minimize2 size={14} /> : <Expand size={14} />}
              </Button>
            </div>
          </div>

          <div className="-mx-4 overflow-x-auto px-4 scrollbar-hide sm:mx-0 sm:px-0">
            <div className={isExpanded ? "flex min-w-max items-center gap-2" : "flex min-w-max items-center gap-2 pb-3"}>
              {TABS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setCurrentTab(id)}
                  className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all ${
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
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {renderTabContent(displayMode)}
        </div>
      </div>
    );
  };

  const fullscreenOverlay =
    isFullscreen && typeof document !== "undefined"
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[1600] hidden bg-black/55 p-4 backdrop-blur-sm lg:flex xl:p-6"
            onClick={() => setIsFullscreen(false)}
          >
            <div
              className="mx-auto flex h-full w-full max-w-[1500px]"
              onClick={(event) => event.stopPropagation()}
            >
              {renderShell("fullscreen")}
            </div>
          </div>,
          document.body,
        )
      : null;

  const generatingOverlay =
    isTimelineGenerating && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[1700] flex flex-col items-center justify-center bg-white/60 backdrop-blur-md animate-in fade-in duration-500">
            <div className="flex flex-col items-center gap-6 p-10 bg-white rounded-[3rem] shadow-3xl border border-neutral-100 animate-in zoom-in-95 duration-500">
              <div className="relative">
                <div className="h-20 w-20 animate-spin rounded-full border-[6px] border-primary-green/10 border-t-primary-green shadow-sm" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <CalendarDays size={32} className="text-primary-green animate-bounce" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-black text-neutral-900 tracking-tight">
                  Generating Timeline
                </h2>
                <p className="text-neutral-500 font-medium max-w-xs leading-relaxed">
                  Our AI is analyzing your location, environmental metrics, and greening strategy to build a phased implementation timeline.
                </p>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-green animate-pulse" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary-green animate-pulse delay-150" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary-green animate-pulse delay-300" />
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {!isFullscreen ? renderShell("sidebar") : <div className="flex-1 min-h-0" aria-hidden="true" />}
      {fullscreenOverlay}
      {generatingOverlay}
    </>
  );
}
