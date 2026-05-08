"use client";

import { useState } from "react";
import Navbar from "@/components/ui/general/layout/navbar";
import {
  useSavedSolutions,
  type SavedSolutionRow,
} from "@/hooks/useSavedSolutions";
import {
  Bookmark,
  BookmarkX,
  ChevronDown,
  ChevronRight,
  MapPin,
  Ruler,
  Leaf,
  X,
} from "lucide-react";
import GreenSolutionCard from "@/components/ui/general/cards/greensolution-infocard";
import SidebarDetail from "@/components/ui/green_solutions/SidebarDetails";
import { createPortal } from "react-dom";
import type {
  DetailTab,
  ChatHistoryMessage,
  TimelineViewMode,
} from "@/types/green_solutions";
import type { SelectedFeature } from "@/types/metrics";
import type { UIRecommendation } from "@/lib/recommendations";

type SavedSolutionLocationMetadata = {
  areaHectares?: number | null;
  address?: string | null;
  coords?: { lat: number; lng: number } | null;
  midpoint?: { lat: number; lng: number } | null;
};

type SavedSolutionContextSnapshot = {
  ndvi?: number | null;
  greeneryIndex?: number | null;
  lst?: number | null;
  treeCanopy?: number | null;
  floodHazard?: number | null;
  stormHazard?: number | null;
  aqi?: number | null;
};

type SavedSolutionGroup = {
  label: string;
  type: string;
  meta: SavedSolutionLocationMetadata;
  saves: SavedSolutionRow[];
};

function getLocationMetadata(
  save: SavedSolutionRow,
): SavedSolutionLocationMetadata {
  return (save.locationMetadata as SavedSolutionLocationMetadata | null) ?? {};
}

function getContextSnapshot(
  save: SavedSolutionRow,
): SavedSolutionContextSnapshot {
  return (save.contextSnapshot as SavedSolutionContextSnapshot | null) ?? {};
}

function toSelectedFeature(save: SavedSolutionRow): SelectedFeature {
  const metadata = getLocationMetadata(save);
  const context = getContextSnapshot(save);
  const coords = metadata.coords ?? metadata.midpoint ?? { lat: 0, lng: 0 };
  const locationType = save.locationType.toLowerCase();

  return {
    name: save.locationName || save.locationId || "Saved Location",
    address: metadata.address ?? "",
    barangay: locationType === "barangay" ? save.locationName ?? "" : "",
    coords,
    customSelectionAreaHectares: metadata.areaHectares ?? null,
    properties: {
      ndvi: context.ndvi,
      temperature: context.lst,
      treeCanopy: context.treeCanopy,
      greeneryIndex: context.greeneryIndex,
    },
    hazards: {
      flood:
        context.floodHazard != null
          ? [{ id: "saved-flood", level: context.floodHazard }]
          : [],
      storm:
        context.stormHazard != null
          ? [{ id: "saved-storm", level: context.stormHazard }]
          : [],
      air: context.aqi != null ? [{ AQI_Level: context.aqi }] : [],
    },
  };
}

function formatCoord(n: number) {
  return n.toFixed(4);
}

function groupSaves(saves: SavedSolutionRow[]): SavedSolutionGroup[] {
  const map = new Map<string, SavedSolutionGroup>();

  for (const save of saves) {
    const locationMetadata = getLocationMetadata(save);
    const key = `${save.locationType}__${save.locationName ?? save.locationId ?? "unknown"}`;
    if (!map.has(key)) {
      map.set(key, {
        label: save.locationName ?? save.locationId ?? "Unknown",
        type: save.locationType,
        meta: {
          ...locationMetadata,
          coords: locationMetadata.coords ?? undefined,
        },
        saves: [],
      });
    }
    map.get(key)!.saves.push(save);
  }

  return Array.from(map.values());
}

function MetricBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/50 dark:bg-neutral-900/50 border border-white/50 dark:border-neutral-800 shadow-sm">
      <span className="text-[9px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
        {label}
      </span>
      <span className={`text-[10px] font-black ${color}`}>{value}</span>
    </div>
  );
}

function GroupHeader({ group }: { group: SavedSolutionGroup }) {
  const meta = group.meta;
  const type = group.type.toLowerCase();
  const context = group.saves[0] ? getContextSnapshot(group.saves[0]) : null;

  const ndvi = context?.ndvi != null ? context.ndvi.toFixed(2) : null;
  const gi =
    context?.greeneryIndex != null ? context.greeneryIndex.toFixed(2) : null;
  const lst = context?.lst != null ? `${context.lst.toFixed(1)}°C` : null;
  const canopy =
    context?.treeCanopy != null
      ? `${(context.treeCanopy * 100).toFixed(0)}%`
      : null;

  const metricsRow = (
    <div className="flex flex-wrap items-center gap-1.5">
      {ndvi && (
        <MetricBadge label="NDVI" value={ndvi} color="text-primary-green" />
      )}
      {gi && <MetricBadge label="GI" value={gi} color="text-emerald-500" />}
      {lst && <MetricBadge label="LST" value={lst} color="text-blue-500" />}
      {canopy && (
        <MetricBadge label="Canopy" value={canopy} color="text-emerald-600" />
      )}
    </div>
  );

  if (type === "barangay") {
    return (
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-2">
          <MapPin size={18} className="text-primary-green shrink-0" />
          <span className="text-sm font-bold text-neutral-800 dark:text-neutral-100 whitespace-nowrap">
            {group.label}
          </span>
        </div>
        {metricsRow}
      </div>
    );
  }

  if (type === "poi" || type === "point") {
    const coords = meta?.coords;
    const address = meta?.address;
    const subtitle = coords
      ? `${formatCoord(coords.lat)}, ${formatCoord(coords.lng)}`
      : group.label;

    return (
      <div className="flex flex-col gap-1 w-full">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-blue-500 shrink-0" />
            <span className="text-sm font-bold text-neutral-800 dark:text-neutral-100 whitespace-nowrap">
              {group.label !== subtitle ? group.label : "Pin Location"}
            </span>
          </div>
          {metricsRow}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-[26px]">
          {address && (
            <p className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 line-clamp-1">
              {address}
            </p>
          )}
          {address && (
            <div className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700 shrink-0 hidden sm:block" />
          )}
          <p className="text-[10px] text-neutral-400 font-mono tracking-tighter">
            {subtitle}
          </p>
        </div>
      </div>
    );
  }

  if (type === "custom") {
    const ha = meta?.areaHectares;
    const mid = meta?.midpoint;
    return (
      <div className="flex flex-col gap-1 w-full">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center gap-2">
            <Ruler size={18} className="text-amber-500 shrink-0" />
            <span className="text-sm font-bold text-neutral-800 dark:text-neutral-100 whitespace-nowrap">
              Custom Area{ha != null ? ` — ${ha.toFixed(2)} ha` : ""}
            </span>
          </div>
          {metricsRow}
        </div>
        {mid && (
          <p className="text-[10px] text-neutral-400 pl-[26px] font-mono tracking-tighter">
            {formatCoord(mid.lat)}, {formatCoord(mid.lng)}
          </p>
        )}
      </div>
    );
  }

  return (
    <span className="text-sm font-bold text-neutral-800 dark:text-neutral-100">
      {group.label}
    </span>
  );
}

function SavedCard({
  save,
  onDelete,
  onSelect,
}: {
  save: SavedSolutionRow;
  onDelete: (id: string) => void;
  onSelect: (save: SavedSolutionRow) => void;
}) {
  const snap = save.solutionSnapshot;

  return (
    <div className="relative">
      <GreenSolutionCard
        solutionTitle={String(snap.solutionTitle ?? "Unnamed Solution")}
        solutionDescription={String(snap.solutionDescription ?? "")}
        detailedDescription={String(snap.detailedDescription ?? "")}
        efficiencyLevel={String(snap.efficiencyLevel ?? "Moderately Efficient")}
        value={Number(snap.value ?? 50)}
        icon={<Leaf size={24} className="text-current" />}
        equityIndex={snap.equityIndex ? Number(snap.equityIndex) : undefined}
        cost={snap.cost ? Number(snap.cost) : undefined}
        impact={snap.impact ? Number(snap.impact) : undefined}
        justification={
          snap.justification ? String(snap.justification) : undefined
        }
        recommendedSpecies={
          snap.recommendedSpecies ? String(snap.recommendedSpecies) : undefined
        }
        isSaved={true}
        onToggleSave={() => onDelete(save.id)}
        onViewDetails={() => onSelect(save)}
      />
    </div>
  );
}

function SolutionGroup({
  group,
  onDelete,
  onSelect,
}: {
  group: SavedSolutionGroup;
  onDelete: (id: string) => void;
  onSelect: (save: SavedSolutionRow) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="space-y-4 bg-white/40 dark:bg-neutral-950/40 p-6 rounded-3xl border border-white/50 dark:border-neutral-800 shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 py-2 hover:opacity-80 transition-opacity"
      >
        <GroupHeader group={group} />
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-bold text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-900 px-3 py-1 rounded-full">
            {group.saves.length} Solutions
          </span>
          {open ? (
            <ChevronDown size={16} className="text-neutral-400" />
          ) : (
            <ChevronRight size={16} className="text-neutral-400" />
          )}
        </div>
      </button>

      {open && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 pt-2">
          {group.saves.map((s) => (
            <SavedCard
              key={s.id}
              save={s}
              onDelete={onDelete}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SavedSolutionsPage() {
  const { saves, isLoading, error, removeSolution } = useSavedSolutions();
  const groups = groupSaves(saves);

  const [activeSave, setActiveSave] = useState<SavedSolutionRow | null>(null);
  const [detailCurrentTab, setDetailCurrentTab] = useState<DetailTab>("INFO");
  const [detailChatMessages, setDetailChatMessages] = useState<
    ChatHistoryMessage[]
  >([]);
  const [detailChatInput, setDetailChatInput] = useState("");
  const [isDetailChatLoading, setIsDetailChatLoading] = useState(false);
  const [detailTimelineView, setDetailTimelineView] =
    useState<TimelineViewMode>("DEFAULT");

  const closeDetail = () => {
    setActiveSave(null);
    setDetailCurrentTab("INFO");
    setDetailChatMessages([]);
  };

  return (
    <main className="relative flex min-h-screen max-w-screen flex-col bg-neutral-50 dark:bg-neutral-950 font-roboto text-neutral-900 dark:text-neutral-100 transition-colors">
      <Navbar />

      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary-green/5 dark:bg-primary-green/10 rounded-full blur-[120px]" />
        <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full flex flex-col overflow-hidden px-4 md:px-10 sm:pl-28 md:pl-36 py-12 md:py-16 lg:py-20 gap-8 min-h-screen">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Bookmark size={18} className="text-primary-green" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
              Your Workspace
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-neutral-900 dark:text-neutral-50 font-poppins tracking-tight">
            Saved Solutions
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl mt-2">
            All the greening interventions you&apos;ve saved from the Explore map,
            grouped by location. Keep track of your planned strategies here.
          </p>
        </header>

        {error ? (
          <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400">
            <p className="text-sm font-semibold">{error}</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-6">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-48 rounded-3xl bg-white/40 dark:bg-neutral-900/40 border border-white/50 dark:border-neutral-800 animate-pulse"
              />
            ))}
          </div>
        ) : saves.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center rounded-3xl bg-white/40 dark:bg-neutral-900/40 border border-white/50 dark:border-neutral-800 shadow-sm">
            <div className="p-5 rounded-full bg-neutral-100 dark:bg-neutral-800 shadow-inner">
              <BookmarkX size={32} className="text-neutral-400" />
            </div>
            <div className="space-y-1">
              <p className="text-lg text-neutral-700 dark:text-neutral-300 font-bold font-poppins">
                No saved solutions yet
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm">
                Head over to the Explore map, generate some interventions, and
                use the bookmark icon to save them here.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-8 pb-10">
            {groups.map((g) => (
              <SolutionGroup
                key={`${g.type}__${g.label}`}
                group={g}
                onDelete={removeSolution}
                onSelect={setActiveSave}
              />
            ))}
          </div>
        )}
      </div>

      {activeSave &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] bg-neutral-900/60 backdrop-blur-sm p-4 md:p-6 lg:p-10 flex items-center justify-center animate-in fade-in duration-200"
            onClick={closeDetail}
          >
            <div
              className="flex h-full w-full max-w-[1440px] overflow-hidden rounded-[2rem] border border-white/50 bg-white/95 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950/95 dark:shadow-black/40 animate-in slide-in-from-bottom-4 duration-300"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex w-full flex-col overflow-hidden">
                <div className="flex items-center justify-between border-b border-neutral-100 bg-white/70 p-4 md:p-6 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-950/60">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="shrink-0 rounded-2xl bg-primary-green/10 p-3.5 text-primary-green shadow-inner dark:bg-primary-green/20 dark:text-primary-green/80">
                      <MapPin size={24} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-lg font-black leading-tight text-neutral-900 dark:text-neutral-50">
                        {activeSave.locationName ||
                          activeSave.locationId ||
                          "Saved Location"}
                      </h4>
                      <p className="mt-0.5 text-xs font-bold text-neutral-500 opacity-70 dark:text-neutral-400 capitalize">
                        {activeSave.locationType} Area Snapshot
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={closeDetail}
                    className="rounded-full p-2 text-neutral-400 transition-all hover:rotate-90 hover:bg-neutral-100 hover:text-red-500 dark:text-neutral-500 dark:hover:bg-neutral-800"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
                  <SidebarDetail
                    recommendation={
                      {
                        ...activeSave.solutionSnapshot,
                        icon: <Leaf />,
                      } as unknown as UIRecommendation
                    }
                    selectedFeature={toSelectedFeature(activeSave)}
                    selectedBarangayData={null}
                    onBack={closeDetail}
                    currentTab={detailCurrentTab}
                    onCurrentTabChange={setDetailCurrentTab}
                    chatMessages={detailChatMessages}
                    onChatMessagesChange={setDetailChatMessages}
                    chatInput={detailChatInput}
                    onChatInputChange={setDetailChatInput}
                    isChatLoading={isDetailChatLoading}
                    onChatLoadingChange={setIsDetailChatLoading}
                    timelineViewMode={detailTimelineView}
                    onTimelineViewModeChange={setDetailTimelineView}
                    isFullscreen
                    isSaved={true}
                    onToggleSave={(e) => {
                      e.stopPropagation();
                      removeSolution(activeSave.id);
                      closeDetail();
                    }}
                  />
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </main>
  );
}
