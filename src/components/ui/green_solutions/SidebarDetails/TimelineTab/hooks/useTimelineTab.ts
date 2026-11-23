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
import {
  ensureTimelineServiceReady,
  isTimelineServiceWarm,
  markTimelineServiceCold,
  markTimelineServiceReady,
  warmTimelineService,
} from "../lib/timeline-service-warmup";
import {
  SWARM_UNAVAILABLE_CODE,
  type SwarmUnavailableBody,
} from "@/lib/timeline/swarm-errors";

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
  const [isWarmingService, setIsWarmingService] = useState(false);
  const [isRestoringDraft, setIsRestoringDraft] = useState(!restoredFromStore);
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

  // Start waking the timeline service while the user reads the tab, so the
  // first Generate click doesn't wait on (or time out during) a cold start.
  useEffect(() => {
    void warmTimelineService();
  }, []);

  // Remounts (tab switches, minimized ↔ fullscreen) already have this key's
  // state from the in-memory store, so render it immediately and revalidate
  // in the background instead of flashing the loading skeletons. The ref is
  // only cleared on key change so StrictMode's double effect stays silent.
  const silentRevalidateKeyRef = useRef<string | null>(
    restoredFromStore ? storeKey : null,
  );
  const timelineRecordRef = useRef(timelineRecord);
  timelineRecordRef.current = timelineRecord;
  // Local work that a newer server copy must never silently replace: open
  // edits, amendments to a saved timeline, or an AI draft not yet saved.
  const hasUnsavedEditsRef = useRef(false);
  hasUnsavedEditsRef.current =
    isEditMode || (timelineRecord ? isDirty : Boolean(agentThreadId));

  const conflictToastId = `timeline-conflict-${recommendationKey}`;

  const clearAgentDraft = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(agentDraftStorageKey);
    }
    setAgentThreadId(null);
    setAgentStatus("idle");
    setAgentRisks([]);
    setAgentRevisionCount(0);
    setHasRegenerated(false);
  }, [agentDraftStorageKey]);

  /** Replace local state with a server record (discarding local edits). */
  const applyServerRecord = useCallback(
    (record: ProjectTimelineRecord) => {
      if (!timelineRecordRef.current) clearAgentDraft();
      setTimelineRecord(record);
      setDraftPlan(deserializeTimelinePlan(record.currentVersion.snapshot));
      setIsEditMode(false);
      toast.dismiss(conflictToastId);
    },
    [clearAgentDraft, conflictToastId],
  );

  const fetchLatestTimelineRecord = useCallback(async () => {
    const response = await fetch(
      `/api/timelines?recommendationKey=${encodeURIComponent(recommendationKey)}`,
      { credentials: "same-origin" },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as { data: ProjectTimelineRecord };
    return payload.data;
  }, [recommendationKey]);

  useEffect(() => {
    const silent = silentRevalidateKeyRef.current === recommendationKey;
    if (!silent) silentRevalidateKeyRef.current = null;

    let ignore = false;
    const loadTimeline = async () => {
      if (!silent) setIsTimelineLoading(true);
      try {
        const response = await fetch(
          `/api/timelines?recommendationKey=${encodeURIComponent(recommendationKey)}`,
          { credentials: "same-origin" },
        );
        if (ignore) return;
        if (response.status === 404 || response.status === 401) {
          // Background check: keep what's on screen unless a saved timeline
          // was actually deleted and the user has nothing unsaved.
          if (
            silent &&
            (response.status === 401 ||
              !timelineRecordRef.current ||
              hasUnsavedEditsRef.current)
          ) {
            return;
          }
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
        if (ignore) return;
        if (silent) {
          const current = timelineRecordRef.current;
          const unchanged =
            current?.id === payload.data.id &&
            current.currentVersion.id === payload.data.currentVersion.id &&
            current.updatedAt === payload.data.updatedAt;
          if (unchanged) return;
          if (hasUnsavedEditsRef.current) {
            const latest = payload.data;
            toast.warning("A newer version of this timeline was saved elsewhere.", {
              id: conflictToastId,
              description:
                "Your unsaved changes are kept. Load the latest to discard them, or keep working — you'll be asked again before anything is overwritten.",
              duration: Infinity,
              action: {
                label: "Load latest",
                onClick: () => applyServerRecord(latest),
              },
            });
            return;
          }
          applyServerRecord(payload.data);
          return;
        }
        setTimelineRecord(payload.data);
        setDraftPlan(
          deserializeTimelinePlan(payload.data.currentVersion.snapshot),
        );
        setIsEditMode(false);
      } catch (error) {
        console.error("Failed to load timeline:", error);
        if (!silent) setTimelineRecord(null);
      } finally {
        if (!ignore && !silent) setIsTimelineLoading(false);
      }
    };
    void loadTimeline();
    return () => {
      ignore = true;
    };
  }, [applyServerRecord, conflictToastId, recommendationKey]);

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

  /**
   * POST to a timeline swarm route, first waiting for the service to wake if
   * it may be asleep, and retrying once if it was still unreachable.
   * `buildBody` runs per attempt so generate can use a fresh thread id.
   */
  const postToSwarmRoute = useCallback(
    async (
      url: string,
      buildBody: () => unknown,
      options: { retryIfMayHaveRun: boolean },
    ) => {
      const waitUntilReady = async () => {
        if (isTimelineServiceWarm()) return;
        setIsWarmingService(true);
        try {
          await ensureTimelineServiceReady();
        } finally {
          setIsWarmingService(false);
        }
      };
      const send = () =>
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(buildBody()),
        });

      await waitUntilReady();
      let response = await send();
      if (response.status === 503) {
        const body = (await response
          .clone()
          .json()
          .catch(() => ({}))) as Partial<SwarmUnavailableBody>;
        if (
          body.code === SWARM_UNAVAILABLE_CODE &&
          (!body.requestMayHaveRun || options.retryIfMayHaveRun)
        ) {
          markTimelineServiceCold();
          await waitUntilReady();
          response = await send();
        }
      }
      if (response.ok) markTimelineServiceReady();
      return response;
    },
    [],
  );

  const generateAgentTimeline = useCallback(async () => {
    if (isAgentBusy) return;
    setIsAgentBusy(true);
    setAgentAction("generate");
    try {
      // Each attempt gets its own thread so a timed-out run can't collide with the retry.
      const response = await postToSwarmRoute(
        "/api/timeline/generate",
        () => ({
          threadId: buildThreadId(recommendationKey),
          ragMetadata: buildRagMetadata(selectedRecommendation, selectedFeature),
        }),
        { retryIfMayHaveRun: true },
      );
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
    postToSwarmRoute,
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
        // Resuming a thread isn't idempotent: only retry if it never ran.
        const response = await postToSwarmRoute(
          "/api/timeline/approve",
          () => ({
            threadId: agentThreadId,
            reviewAction: action,
            reviewerNotes,
          }),
          { retryIfMayHaveRun: false },
        );
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
    [agentThreadId, isAgentBusy, applyAgentTimeline, postToSwarmRoute],
  );

  // Lets toast buttons call the latest persistTimeline (current draft, current
  // saving flag) instead of the one captured when the toast was shown.
  const persistTimelineRef = useRef<
    (options?: { baseRecord?: ProjectTimelineRecord }) => Promise<void>
  >(async () => {});

  const persistTimeline = useCallback(async (
    options?: { baseRecord?: ProjectTimelineRecord },
  ) => {
    if (isTimelineSaving) return;
    // The server version these edits build on. "Save mine anyway" passes the
    // latest record so the edits are saved on top of it.
    const baseRecord = options?.baseRecord ?? timelineRecord;
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
        changeReason: baseRecord
          ? "Manual amendment from timeline tab"
          : "Initial project timeline",
      };
      const response = baseRecord
        ? await fetch(`/api/timelines/${baseRecord.id}/versions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              snapshot: recommendationPayload.snapshot,
              changeReason: recommendationPayload.changeReason,
              expectedVersionId: baseRecord.currentVersion.id,
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
      if (response.status === 409) {
        // Amend: a newer version exists. Create: a timeline was created elsewhere.
        const latest = await fetchLatestTimelineRecord();
        if (!latest) {
          throw new Error(responseJson.error ?? "Could not save project timeline.");
        }
        toast.warning("This timeline was changed somewhere else while you were editing.", {
          id: conflictToastId,
          description:
            "Nothing was overwritten. Save yours as a new version on top (the other version stays in the history), or load the latest and discard your changes.",
          duration: Infinity,
          action: {
            label: "Save mine anyway",
            onClick: () => {
              void persistTimelineRef.current({ baseRecord: latest });
            },
          },
          cancel: {
            label: "Load latest",
            onClick: () => applyServerRecord(latest),
          },
        });
        return;
      }
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
      applyServerRecord(refreshedPayload.data);
      toast.success(
        baseRecord
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
    fetchLatestTimelineRecord,
    conflictToastId,
    applyServerRecord,
  ]);
  persistTimelineRef.current = persistTimeline;

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
    isWarmingService,
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
