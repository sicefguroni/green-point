"use client";

import { useState, useCallback, useEffect } from "react";
import type { SidebarView } from "@/types/green_solutions";

/**
 * Manages the explore sidebar's view routing (LIST / METRICS / DETAIL)
 * and the detail panel fullscreen toggle.
 */
export function useExploreViewState() {
  const [activeView, setActiveView] = useState<SidebarView>("LIST");
  const [isDetailFullscreen, setIsDetailFullscreen] = useState(false);

  const handleDetailBack = useCallback(() => {
    setIsDetailFullscreen(false);
    setActiveView("LIST");
  }, []);

  // Lock body scroll when detail panel is fullscreen
  useEffect(() => {
    if (!isDetailFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isDetailFullscreen]);

  // Escape key exits fullscreen
  useEffect(() => {
    if (!isDetailFullscreen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDetailFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDetailFullscreen]);

  // Auto-exit fullscreen when leaving DETAIL view
  useEffect(() => {
    if (activeView !== "DETAIL") {
      setIsDetailFullscreen(false);
    }
  }, [activeView]);

  return {
    activeView,
    setActiveView,
    isDetailFullscreen,
    setIsDetailFullscreen,
    handleDetailBack,
  } as const;
}
