"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  buildTimelinePlan,
  deserializeTimelinePlan,
  serializeTimelinePlan,
} from "@/lib/timeline/plan";
import { isDraftStale } from "@/lib/timeline/draft";
import type { UIRecommendation } from "@/lib/recommendations";
import type { SelectedFeature } from "@/types/metrics";
import type { ChatHistoryMessage } from "@/types/green_solutions";
import type { TimelinePlan, TimelinePhase } from "../types";
import type {
  CreateProjectTimelineRequest,
  ProjectTimelineRecord,
} from "@/types/timeline";
import type {
  AgentTimelineBridgeResponse,
  AgentTimelineStatus,
} from "@/types/agent-timeline";
// ── In-memory store: preserves timeline state when toggling between
//    minimized sidebar and fullscreen portal (which are separate React
//    component instances). The store is keyed by recommendationKey and
//    outlives any single useTimelineTab instance.
interface TimelineTabStoreValue {
  draftPlan: TimelinePlan;
  agentThreadId: string | null;
  agentStatus: AgentTimelineStatus | "idle";
  agentRisks: string[];
  agentRevisionCount: number;
  hasRegenerated: boolean;
  timelineRecord: ProjectTimelineRecord | null;
  isEditMode: boolean;
  selectedPhaseId: string | null;
  selectedTaskId: string | null;
}

const timelineTabStore = new Map<string, TimelineTabStoreValue>();

import {
  type ViewMode,
  buildThreadId,
  buildRagMetadata,
  buildRegenerationNotes,
  computeDurationDays,
  computeRecommendationKey,
  computeBaseFileName,
  computeBaselineSnapshot,
  computeAgentDraftStorageKey,
  exportNodeAsPdf,
} from "../lib/timeline-tab-utils";

export function useTimelineTab(
  selectedRecommendation: UIRecommendation,
  selectedFeature?: SelectedFeature,
  chatHistory: ChatHistoryMessage[] = [],
  controlledViewMode?: ViewMode,
  onViewModeChange?: (mode: ViewMode) => void,
  onTimelineReadyChange?: (ready: boolean) => void,
  onExportContextChange?: (context: {
    plan: TimelinePlan;
    risks: string[];
  } | null) => void,
  isFullscreen?: boolean,
) {
  const recommendationKey = useMemo(
    () => computeRecommendationKey(selectedRecommendation, selectedFeature),
    [selectedFeature, selectedRecommendation],
  );

  // ── In-memory store recovery (synchronous, survives component instance
  //    swaps like minimized ↔ fullscreen toggles).
  const storeKey = recommendationKey;
  const storedValue = useRef<TimelineTabStoreValue | undefined>(
    timelineTabStore.get(storeKey),
  );
  const restoredFromStore = storedValue.current !== undefined;

  const [localViewMode, setLocalViewMode] = useState<ViewMode>("DEFAULT");
  const [isExporting, setIsExporting] = useState(false);
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);
  const [isTimelineSaving, setIsTimelineSaving] = useState(false);
  const [timelineRecord, setTimelineRecord] =
    useState<ProjectTimelineRecord | null>(
      () => storedValue.current?.timelineRecord ?? null,
    );
  const [agentThreadId, setAgentThreadId] = useState<string | null>(
    () => storedValue.current?.agentThreadId ?? null,
  );
  const [agentStatus, setAgentStatus] = useState<AgentTimelineStatus | "idle">(
    () => storedValue.current?.agentStatus ?? "idle",
  );
  const [agentRisks, setAgentRisks] = useState<string[]>(
    () => storedValue.current?.agentRisks ?? [],
  );
  const [agentRevisionCount, setAgentRevisionCount] = useState(
    () => storedValue.current?.agentRevisionCount ?? 0,
  );
  const [hasRegenerated, setHasRegenerated] = useState(
    () => storedValue.current?.hasRegenerated ?? false,
  );
  const [isAgentBusy, setIsAgentBusy] = useState(false);
  const [isRestoringDraft, setIsRestoringDraft] = useState(true);
  const [agentAction, setAgentAction] = useState<
    "generate" | "regenerate" | "approve" | null
  >(null);
  const [draftPlan, setDraftPlan] = useState<TimelinePlan>(() =>
    storedValue.current?.draftPlan ??
    buildTimelinePlan(selectedRecommendation, chatHistory, selectedFeature),
  );
  const [isEditMode, setIsEditMode] = useState(
    () => storedValue.current?.isEditMode ?? false,
  );
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(
    () => storedValue.current?.selectedPhaseId ?? null,
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    () => storedValue.current?.selectedTaskId ?? null,
  );
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [opensUpward, setOpensUpward] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);

  const viewMode = controlledViewMode ?? localViewMode;
  const setViewMode: (mode: ViewMode) => void =
    onViewModeChange ?? setLocalViewMode;

  const generatedPlan = useMemo(
    () =>
      buildTimelinePlan(selectedRecommendation, chatHistory, selectedFeature),
    [selectedRecommendation, chatHistory, selectedFeature],
  );

  const generatedPlanRef = useRef(generatedPlan);
  generatedPlanRef.current = generatedPlan;

  const agentThreadIdRef = useRef(agentThreadId);
  agentThreadIdRef.current = agentThreadId;

  const agentDraftStorageKey = useMemo(
    () => computeAgentDraftStorageKey(recommendationKey),
    [recommendationKey],
  );

  const baselineSnapshot = useMemo(
    () => computeBaselineSnapshot(timelineRecord, generatedPlan),
    [generatedPlan, timelineRecord],
  );

  const draftSnapshot = useMemo(
    () => JSON.stringify(serializeTimelinePlan(draftPlan)),
    [draftPlan],
  );

  const isDirty = baselineSnapshot !== draftSnapshot;
  const hasTimelineDraft = Boolean(timelineRecord) || Boolean(agentThreadId);
  const showEmptyState = !hasTimelineDraft && !isRestoringDraft;
  const canRegenerate = Boolean(agentThreadId) && !timelineRecord;
  const showRevisionBadge = hasRegenerated;
  const showAgentLoadingOverlay =
    agentAction === "generate" ||
    agentAction === "regenerate" ||
    agentAction === "approve";
  const showTimelineLoadingOverlay =
    showAgentLoadingOverlay || (isRestoringDraft && !hasTimelineDraft);
  const durationDays = useMemo(
    () => computeDurationDays(draftPlan),
    [draftPlan],
  );
  const baseFileName = useMemo(
    () => computeBaseFileName(selectedRecommendation),
    [selectedRecommendation],
  );

  const selectedPhase = useMemo(
    () =>
      draftPlan.phases.find((phase) => phase.id === selectedPhaseId) ?? null,
    [draftPlan, selectedPhaseId],
  );

  // --- Effects ---

  useEffect(() => {
    onTimelineReadyChange?.(hasTimelineDraft);
  }, [hasTimelineDraft, onTimelineReadyChange]);

  useEffect(() => {
    if (!hasTimelineDraft) {
      onExportContextChange?.(null);
      return;
    }
    onExportContextChange?.({ plan: draftPlan, risks: agentRisks });
  }, [agentRisks, draftPlan, hasTimelineDraft, onExportContextChange]);

  useEffect(() => {
    if (!isViewMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!viewMenuRef.current?.contains(event.target as Node)) {
        setIsViewMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsViewMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isViewMenuOpen]);

  useEffect(() => {
    if (!isViewMenuOpen || !viewMenuRef.current) return;
    const viewportSpacing = 16;
    const estimatedMenuHeight = 188;
    const menuBounds = viewMenuRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - menuBounds.bottom;
    const spaceAbove = menuBounds.top;
    setOpensUpward(
      spaceBelow < estimatedMenuHeight + viewportSpacing &&
        spaceAbove > spaceBelow,
    );
  }, [isViewMenuOpen]);

  useEffect(() => {
    if (isFullscreen) setIsViewMenuOpen(false);
  }, [isFullscreen]);

  useEffect(() => {
    let ignore = false;
    const loadTimeline = async () => {
      setIsTimelineLoading(true);
      try {
        const response = await fetch(
          `/api/timelines?recommendationKey=${encodeURIComponent(recommendationKey)}`,
          { credentials: "same-origin" },
        );
        if (ignore) return;
        if (response.status === 404 || response.status === 401) {
          setTimelineRecord(null);
          setIsEditMode(false);
          return;
        }
        if (!response.ok) {
          throw new Error(`Failed to load timeline (${response.status})`);
        }
        const payload = (await response.json()) as {
          data: ProjectTimelineRecord;
        };
        setTimelineRecord(payload.data);
        setDraftPlan(
          deserializeTimelinePlan(payload.data.currentVersion.snapshot),
        );
        setIsEditMode(false);
      } catch (error) {
        console.error("Failed to load timeline:", error);
        setTimelineRecord(null);
      } finally {
        if (!ignore) setIsTimelineLoading(false);
      }
    };
    void loadTimeline();
    return () => {
      ignore = true;
    };
  }, [recommendationKey]);

  // Save latest state to the store ref on every render so the cleanup
  // effect below captures current values.
  const storeValuesRef = useRef<TimelineTabStoreValue>({
    draftPlan,
    agentThreadId,
    agentStatus,
    agentRisks,
    agentRevisionCount,
    hasRegenerated,
    timelineRecord,
    isEditMode,
    selectedPhaseId,
    selectedTaskId,
  });
  storeValuesRef.current = {
    draftPlan,
    agentThreadId,
    agentStatus,
    agentRisks,
    agentRevisionCount,
    hasRegenerated,
    timelineRecord,
    isEditMode,
    selectedPhaseId,
    selectedTaskId,
  };

  // Store state on unmount so a sibling instance (fullscreen ↔ minimized
  // toggle) can recover it synchronously via initial-state updaters above.
  useEffect(() => {
    // Clear previous entry so we don't accumulate stale data.
    return () => {
      timelineTabStore.set(storeKey, storeValuesRef.current);
    };
  }, [storeKey]);

  // ── Restore from sessionStorage on fresh mount (page reload) ──────────
  useEffect(() => {
    // Already restored from the in-memory store — skip sessionStorage.
    if (restoredFromStore) {
      setIsRestoringDraft(false);
      return;
    }
    setIsRestoringDraft(true);
    if (timelineRecord) {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(agentDraftStorageKey);
      }
      setAgentThreadId(null);
      setAgentStatus("idle");
      setAgentRisks([]);
      setAgentRevisionCount(0);
      setHasRegenerated(false);
      setIsRestoringDraft(false);
      return;
    }
    if (typeof window === "undefined") {
      setIsRestoringDraft(false);
      return;
    }
    const raw = sessionStorage.getItem(agentDraftStorageKey);
    if (!raw) {
      setAgentThreadId(null);
      setAgentStatus("idle");
      setAgentRisks([]);
      setAgentRevisionCount(0);
      setHasRegenerated(false);
      setIsRestoringDraft(false);
      return;
    }
    try {
      const restored = JSON.parse(raw) as {
        threadId?: string;
        status?: AgentTimelineStatus;
        pendingRisks?: string[];
        revisionCount?: number;
        hasRegenerated?: boolean;
        savedAt?: number;
        uiSnapshot?: ReturnType<typeof serializeTimelinePlan>;
      };
      const baselineSnap = serializeTimelinePlan(generatedPlanRef.current);
      if (
        isDraftStale({
          baselineGeneratedAt: baselineSnap.generatedAt,
          draftSavedAt: restored.savedAt,
          draftGeneratedAt: restored.uiSnapshot?.generatedAt,
        })
      ) {
        sessionStorage.removeItem(agentDraftStorageKey);
        setAgentThreadId(null);
        setAgentStatus("idle");
        setAgentRisks([]);
        setAgentRevisionCount(0);
        setHasRegenerated(false);
        setDraftPlan(deserializeTimelinePlan(baselineSnap));
        setIsRestoringDraft(false);
        return;
      }
      if (restored.uiSnapshot) {
        setDraftPlan(deserializeTimelinePlan(restored.uiSnapshot));
      }
      setAgentThreadId(restored.threadId ?? null);
      setAgentStatus(restored.status ?? "awaiting_human_review");
      setAgentRisks(restored.pendingRisks ?? []);
      setAgentRevisionCount(restored.revisionCount ?? 0);
      setHasRegenerated(Boolean(restored.hasRegenerated));
    } catch {
      sessionStorage.removeItem(agentDraftStorageKey);
      setAgentThreadId(null);
      setAgentStatus("idle");
      setAgentRisks([]);
      setAgentRevisionCount(0);
      setHasRegenerated(false);
    } finally {
      setIsRestoringDraft(false);
    }
  }, [agentDraftStorageKey, timelineRecord, restoredFromStore]);

  useEffect(() => {
    if (!agentThreadId || timelineRecord) return;
    if (typeof window === "undefined") return;
    const payload = {
      threadId: agentThreadId,
      status: agentStatus === "idle" ? "awaiting_human_review" : agentStatus,
      pendingRisks: agentRisks,
      revisionCount: agentRevisionCount,
      hasRegenerated,
      savedAt: Date.now(),
      uiSnapshot: serializeTimelinePlan(draftPlan),
    };
    sessionStorage.setItem(agentDraftStorageKey, JSON.stringify(payload));
  }, [
    agentDraftStorageKey,
    agentRisks,
    agentStatus,
    agentThreadId,
    agentRevisionCount,
    draftPlan,
    hasRegenerated,
    timelineRecord,
  ]);

  // Track previous timelineRecord to detect transitions for store cleanup.
  const prevTimelineRecordRef = useRef(timelineRecord);

  // Remove the store entry once the timeline is persisted (so a fresh
  // mount re-fetches from the server instead of using possibly-stale data).
  useEffect(() => {
    if (timelineRecord && !prevTimelineRecordRef.current) {
      timelineTabStore.delete(storeKey);
    }
    prevTimelineRecordRef.current = timelineRecord;
  }, [storeKey, timelineRecord]);

  // --- Handlers ---

  const handleOpenPhase = useCallback(
    (phaseId: string, taskId?: string) => {
      setSelectedPhaseId(phaseId);
      setSelectedTaskId(taskId ?? null);
    },
    [],
  );

  const handleClosePhaseModal = useCallback(() => {
    setSelectedPhaseId(null);
    setSelectedTaskId(null);
  }, []);

  const handleSavePhase = useCallback(
    (updatedPhase: TimelinePhase) => {
      setDraftPlan((currentPlan) => ({
        ...currentPlan,
        phases: currentPlan.phases.map((phase) =>
          phase.id === updatedPhase.id ? updatedPhase : phase,
        ),
      }));
    },
    [],
  );

  const resetDraftPlan = useCallback(() => {
    if (timelineRecord) {
      setDraftPlan(
        deserializeTimelinePlan(timelineRecord.currentVersion.snapshot),
      );
    } else {
      setDraftPlan(
        deserializeTimelinePlan(serializeTimelinePlan(generatedPlan)),
      );
    }
    setIsEditMode(false);
  }, [generatedPlan, timelineRecord]);

  const applyAgentTimeline = useCallback(
    (payload: AgentTimelineBridgeResponse) => {
      setDraftPlan(deserializeTimelinePlan(payload.uiSnapshot));
      setAgentStatus(payload.status);
      setAgentRisks(payload.pendingRisks);
      setAgentRevisionCount(payload.revisionCount);
      setIsEditMode(false);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          agentDraftStorageKey,
          JSON.stringify({
            threadId: payload.threadId,
            status: payload.status,
            pendingRisks: payload.pendingRisks,
            revisionCount: payload.revisionCount,
            hasRegenerated,
            savedAt: Date.now(),
            uiSnapshot: payload.uiSnapshot,
          }),
        );
      }
    },
    [agentDraftStorageKey, hasRegenerated],
  );

  const generateAgentTimeline = useCallback(async () => {
    if (isAgentBusy) return;
    setIsAgentBusy(true);
    setAgentAction("generate");
    try {
      const threadId = buildThreadId(recommendationKey);
      const response = await fetch("/api/timeline/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          threadId,
          ragMetadata: buildRagMetadata(selectedRecommendation, selectedFeature),
        }),
      });
      if (response.status === 401) {
        toast.error("Sign in first to generate an AI timeline.");
        return;
      }
      const responseJson = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        data?: AgentTimelineBridgeResponse;
        error?: string;
      };
      if (!response.ok || !responseJson.success || !responseJson.data) {
        throw new Error(responseJson.error ?? "AI timeline generation failed.");
      }
      setAgentThreadId(responseJson.data.threadId);
      applyAgentTimeline(responseJson.data);
      toast.success("AI timeline generated.");
    } catch (error) {
      console.error("AI timeline generation failed:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "AI timeline generation failed.",
      );
    } finally {
      setAgentAction(null);
      setIsAgentBusy(false);
    }
  }, [
    isAgentBusy,
    recommendationKey,
    selectedRecommendation,
    selectedFeature,
    applyAgentTimeline,
  ]);

  const reviewAgentTimeline = useCallback(
    async (action: "approve" | "regenerate", reviewerNotes?: string) => {
      if (!agentThreadId) {
        toast.error("Generate a timeline before approving or regenerating.");
        return;
      }
      if (isAgentBusy) return;
      setIsAgentBusy(true);
      setAgentAction(action);
      try {
        const response = await fetch("/api/timeline/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            threadId: agentThreadId,
            reviewAction: action,
            reviewerNotes,
          }),
        });
        if (response.status === 401) {
          toast.error("Sign in first to approve or regenerate.");
          return;
        }
        const responseJson = (await response.json().catch(() => ({}))) as {
          success?: boolean;
          data?: AgentTimelineBridgeResponse;
          error?: string;
        };
        if (!response.ok || !responseJson.success || !responseJson.data) {
          throw new Error(responseJson.error ?? "AI timeline review failed.");
        }
        applyAgentTimeline(responseJson.data);
        if (action === "approve") {
          toast.success("AI timeline approved.");
        } else {
          setHasRegenerated(true);
          toast.success("AI timeline regenerated.");
        }
      } catch (error) {
        console.error("AI timeline review failed:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : "AI timeline review failed.",
        );
      } finally {
        setAgentAction(null);
        setIsAgentBusy(false);
      }
    },
    [agentThreadId, isAgentBusy, applyAgentTimeline],
  );

  const persistTimeline = useCallback(async () => {
    if (isTimelineSaving) return;
    setIsTimelineSaving(true);
    try {
      const recommendationPayload: CreateProjectTimelineRequest = {
        recommendationKey,
        recommendation: {
          id: selectedRecommendation.id,
          recommendationKey,
          title: selectedRecommendation.solutionTitle,
          description: selectedRecommendation.solutionDescription,
          interventionType: selectedRecommendation.interventionType,
          source: selectedRecommendation.source,
          relevancy: selectedRecommendation.relevancy,
          efficiencyScore: selectedRecommendation.value,
          estimatedCost:
            selectedRecommendation.costEstimate?.totalEstimate ??
            selectedRecommendation.cost ??
            null,
          costUnit:
            selectedRecommendation.costEstimate?.currencyUnit ??
            selectedRecommendation.costUnit ??
            null,
          equityIndex: selectedRecommendation.equityIndex,
          priority: selectedRecommendation.priority,
          hasBudget: selectedRecommendation.hasBudget,
        },
        snapshot: serializeTimelinePlan(draftPlan),
        changeReason: timelineRecord
          ? "Manual amendment from timeline tab"
          : "Initial project timeline",
      };
      const response = timelineRecord
        ? await fetch(`/api/timelines/${timelineRecord.id}/versions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              snapshot: recommendationPayload.snapshot,
              changeReason: recommendationPayload.changeReason,
            }),
          })
        : await fetch("/api/timelines", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify(recommendationPayload),
          });
      if (response.status === 401) {
        toast.error("Sign in first to save or amend project timelines.");
        return;
      }
      const responseJson = (await response.json().catch(() => ({}))) as {
        data?: ProjectTimelineRecord;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(responseJson.error ?? "Could not save project timeline.");
      }
      const refreshed = await fetch(
        `/api/timelines?recommendationKey=${encodeURIComponent(recommendationKey)}`,
        { credentials: "same-origin" },
      );
      if (!refreshed.ok) {
        throw new Error("Timeline saved, but refresh failed.");
      }
      const refreshedPayload = (await refreshed.json()) as {
        data: ProjectTimelineRecord;
      };
      setTimelineRecord(refreshedPayload.data);
      setDraftPlan(
        deserializeTimelinePlan(refreshedPayload.data.currentVersion.snapshot),
      );
      setIsEditMode(false);
      toast.success(
        timelineRecord
          ? "Timeline amendment saved."
          : "Project timeline created.",
      );
    } catch (error) {
      console.error("Failed to persist timeline:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save project timeline.",
      );
    } finally {
      setIsTimelineSaving(false);
    }
  }, [
    isTimelineSaving,
    recommendationKey,
    selectedRecommendation,
    draftPlan,
    timelineRecord,
  ]);

  const handlePrimaryTimelineAction = useCallback(async () => {
    if (!hasTimelineDraft) {
      await generateAgentTimeline();
      return;
    }
    if (agentThreadId && agentStatus === "awaiting_human_review") {
      await reviewAgentTimeline("approve");
    }
    await persistTimeline();
  }, [
    hasTimelineDraft,
    agentThreadId,
    agentStatus,
    generateAgentTimeline,
    reviewAgentTimeline,
    persistTimeline,
  ]);

  const handleResetAction = useCallback(async () => {
    if (canRegenerate) {
      await reviewAgentTimeline("regenerate", buildRegenerationNotes(draftPlan));
      return;
    }
    resetDraftPlan();
  }, [canRegenerate, reviewAgentTimeline, draftPlan, resetDraftPlan]);

  const exportCurrentView = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await exportNodeAsPdf(viewRef.current, viewMode, baseFileName);
      toast.success("Exported timeline view.");
    } catch (error) {
      console.error("Timeline export failed:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Timeline export failed. Please try again.",
      );
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, viewMode, baseFileName]);

  return {
    viewMode,
    isExporting,
    isTimelineLoading,
    isTimelineSaving,
    timelineRecord,
    agentThreadId,
    agentStatus,
    agentRisks,
    hasRegenerated,
    isAgentBusy,
    isRestoringDraft,
    draftPlan,
    isEditMode,
    selectedPhase,
    selectedTaskId,
    isViewMenuOpen,
    opensUpward,
    isDirty,
    hasTimelineDraft,
    showEmptyState,
    canRegenerate,
    showRevisionBadge,
    showTimelineLoadingOverlay,
    durationDays,
    baseFileName,
    viewMenuRef,
    viewRef,
    setViewMode,
    setIsViewMenuOpen,
    setIsEditMode,
    handleOpenPhase,
    handleClosePhaseModal,
    handleSavePhase,
    handlePrimaryTimelineAction,
    handleResetAction,
    generateAgentTimeline,
    exportCurrentView,
  };
}
