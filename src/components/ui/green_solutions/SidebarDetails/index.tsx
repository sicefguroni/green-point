"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import {
  ArrowLeft,
  CalendarRange,
  Info,
  Maximize2,
  MessageSquare,
  Minimize2,
} from "lucide-react";
import { type BarangayData } from "@/context/BarangayContext";
import {
  type DetailTab,
  type ChatHistoryMessage,
  type TimelineViewMode,
} from "@/types/green_solutions";
import { type UIRecommendation } from "@/lib/recommendations";
import { type SelectedFeature } from "@/types/metrics";
import InfoTab from "./InfoTab";
import ChatTab from "./ChatTab";
import TimelineTab from "./TimelineTab";

interface SidebarDetailProps {
  recommendation: UIRecommendation;
  selectedFeature: SelectedFeature;
  selectedBarangayData: BarangayData | null;
  onBack: () => void;
  currentTab?: DetailTab;
  onCurrentTabChange?: Dispatch<SetStateAction<DetailTab>>;
  chatMessages?: ChatHistoryMessage[];
  onChatMessagesChange?: Dispatch<SetStateAction<ChatHistoryMessage[]>>;
  chatInput?: string;
  onChatInputChange?: Dispatch<SetStateAction<string>>;
  isChatLoading?: boolean;
  onChatLoadingChange?: Dispatch<SetStateAction<boolean>>;
  timelineViewMode?: TimelineViewMode;
  onTimelineViewModeChange?: Dispatch<SetStateAction<TimelineViewMode>>;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

const TABS: { id: DetailTab; label: string; Icon: React.ElementType }[] = [
  { id: "INFO", label: "Technical Info", Icon: Info },
  { id: "CHAT", label: "AI Assistant", Icon: MessageSquare },
  { id: "TIMELINE", label: "Timeline", Icon: CalendarRange },
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
  currentTab: controlledCurrentTab,
  onCurrentTabChange,
  chatMessages: controlledChatMessages,
  onChatMessagesChange,
  chatInput: controlledChatInput,
  onChatInputChange,
  isChatLoading: controlledIsChatLoading,
  onChatLoadingChange,
  timelineViewMode,
  onTimelineViewModeChange,
  isFullscreen = false,
  onToggleFullscreen,
}: SidebarDetailProps) {
  const [localCurrentTab, setLocalCurrentTab] = useState<DetailTab>("INFO");
  const [localChatHistory, setLocalChatHistory] = useState<ChatHistoryMessage[]>([]);
  const [localChatInput, setLocalChatInput] = useState("");
  const [localIsChatLoading, setLocalIsChatLoading] = useState(false);

  const currentTab = controlledCurrentTab ?? localCurrentTab;
  const setCurrentTab = onCurrentTabChange ?? setLocalCurrentTab;
  const chatHistory = controlledChatMessages ?? localChatHistory;
  const setChatHistory = onChatMessagesChange ?? setLocalChatHistory;
  const chatInput = controlledChatInput ?? localChatInput;
  const setChatInput = onChatInputChange ?? setLocalChatInput;
  const isChatLoading = controlledIsChatLoading ?? localIsChatLoading;
  const setIsChatLoading = onChatLoadingChange ?? setLocalIsChatLoading;

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      {/* ── Header: breadcrumb + tab bar ── */}
      <div className="px-6 py-5 border-b border-neutral-100 space-y-6 shrink-0 bg-white/50">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2 min-w-0">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-primary-green transition-colors group w-fit"
            >
              <ArrowLeft
                size={12}
                className="group-hover:-translate-x-0.5 transition-transform duration-150"
              />
              Back to Discovery
            </button>

            <h2 className="text-2xl font-black text-neutral-900 font-poppins tracking-tight leading-tight">
              {recommendation.solutionTitle}
            </h2>
          </div>

          {onToggleFullscreen ? (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="hidden lg:inline-flex shrink-0 rounded-full border border-neutral-200 bg-white p-2 text-neutral-500 shadow-sm transition-colors hover:border-primary-green/30 hover:text-primary-green"
              aria-label={isFullscreen ? "Exit fullscreen detail view" : "Open fullscreen detail view"}
              title={isFullscreen ? "Exit fullscreen" : "Open fullscreen"}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          ) : null}
        </div>

        {/* Tab bar */}
        <div className="flex items-center p-1 bg-neutral-100/50 rounded-2xl">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setCurrentTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                currentTab === id
                  ? "bg-white text-primary-green shadow-sm ring-1 ring-black/[0.05]"
                  : "text-neutral-400 hover:text-neutral-600"
              }`}
            >
              <Icon
                size={14}
                className={currentTab === id ? "text-primary-green" : ""}
              />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{label.split(" ")[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content area ── */}
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
        {currentTab === "INFO" ? (
          <InfoTab
            recommendation={recommendation}
            selectedFeature={selectedFeature}
            selectedBarangayData={selectedBarangayData}
          />
        ) : currentTab === "CHAT" ? (
          <ChatTab
            recommendation={recommendation}
            selectedFeature={selectedFeature}
            messages={chatHistory}
            onMessagesChange={setChatHistory}
            inputValue={chatInput}
            onInputChange={setChatInput}
            isLoading={isChatLoading}
            onLoadingChange={setIsChatLoading}
            onHistoryChange={
              controlledChatMessages === undefined ? setChatHistory : undefined
            }
            selectedBarangayData={selectedBarangayData}
            isFullscreen={isFullscreen}
          />
        ) : (
          <TimelineTab
            selectedRecommendation={recommendation}
            selectedFeature={selectedFeature}
            chatHistory={chatHistory}
            viewMode={timelineViewMode}
            onViewModeChange={onTimelineViewModeChange}
            isFullscreen={isFullscreen}
          />
        )}
      </div>
    </div>
  );
}
