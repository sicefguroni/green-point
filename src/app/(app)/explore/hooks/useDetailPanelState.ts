"use client";

import { useState, useCallback } from "react";
import type {
  DetailTab,
  ChatHistoryMessage,
  TimelineViewMode,
} from "@/types/green_solutions";
import type { UIRecommendation } from "@/lib/recommendations";

/**
 * Manages all state for the explore detail panel — the right sidebar view
 * that shows recommendation details (info, chat, timeline tabs).
 */
export function useDetailPanelState() {
  const [selectedRecommendation, setSelectedRecommendation] =
    useState<UIRecommendation | null>(null);

  const [detailCurrentTab, setDetailCurrentTab] = useState<DetailTab>("INFO");
  const [detailChatMessages, setDetailChatMessages] = useState<
    ChatHistoryMessage[]
  >([]);
  const [detailChatInput, setDetailChatInput] = useState("");
  const [isDetailChatLoading, setIsDetailChatLoading] = useState(false);

  const [detailTimelineView, setDetailTimelineView] =
    useState<TimelineViewMode>("DEFAULT");

  const resetDetailState = useCallback(() => {
    setDetailCurrentTab("INFO");
    setDetailChatMessages([]);
    setDetailChatInput("");
    setIsDetailChatLoading(false);
    setDetailTimelineView("DEFAULT");
  }, []);

  const viewRecommendation = useCallback(
    (recommendation: UIRecommendation) => {
      resetDetailState();
      setSelectedRecommendation(recommendation);
    },
    [resetDetailState],
  );

  return {
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
    viewRecommendation,
  } as const;
}
