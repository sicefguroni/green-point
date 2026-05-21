"use client";

import { useState, useMemo } from "react";
import Navbar from "@/components/ui/general/layout/navbar";
import {
  useSavedSolutions,
  type SavedSolutionRow,
} from "@/hooks/useSavedSolutions";
import {
  Bookmark,
  Leaf,
  BookmarkX,
  ChevronDown,
  ChevronRight,
  MapPin,
  Ruler,
  X,
  Pin,
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
import { POINT_SELECTION_AREA_HECTARES } from "@/lib/selection-area";

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
    barangay: locationType === "barangay" ? (save.locationName ?? "") : "",
    coords,
    customSelectionAreaHectares:
      locationType === "custom" ? (metadata.areaHectares ?? null) : null,
    pointSelectionAreaHectares:
      locationType === "poi"
        ? (metadata.areaHectares ?? POINT_SELECTION_AREA_HECTARES)
        : null,
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

type SavesByDate = {
  dateLabel: string;
  context: SavedSolutionContextSnapshot;
  saves: SavedSolutionRow[];
};

function groupSavesByDate(saves: SavedSolutionRow[]): SavesByDate[] {
  const sortedSaves = [...saves].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const dateGroups: { [key: string]: SavedSolutionRow[] } = {};

  for (const save of sortedSaves) {
    const dateLabel = new Date(save.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    if (!dateGroups[dateLabel]) {
      dateGroups[dateLabel] = [];
    }
    dateGroups[dateLabel].push(save);
  }

  return Object.entries(dateGroups).map(([dateLabel, groupSaves]) => {
    const context = getContextSnapshot(groupSaves[0]);
    return {
      dateLabel,
      context,
      saves: groupSaves,
    };
  });
}

function DateGroupHeader({
  dateLabel,
  context,
}: {
  dateLabel: string;
  context: SavedSolutionContextSnapshot;
}) {
  const ndvi = context.ndvi != null ? context.ndvi.toFixed(2) : null;
  const gi =
    context.greeneryIndex != null ? context.greeneryIndex.toFixed(2) : null;
  const lst = context.lst != null ? `${context.lst.toFixed(1)}°C` : null;
  const canopy =
    context.treeCanopy != null
      ? `${(context.treeCanopy * 100).toFixed(0)}%`
      : null;

  return (
    <div className="flex items-center gap-3 w-full py-1.5 font-poppins">
      <div className="shrink-0">
        <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 bg-neutral-100/80 dark:bg-neutral-900/80 px-2.5 py-1 rounded-md border border-neutral-200/50 dark:border-neutral-800 shadow-sm">
          {dateLabel}
        </span>
      </div>

      <div className="flex-1 border-b border-dashed border-neutral-200 dark:border-neutral-850" />

      <div className="flex items-center gap-3 flex-wrap shrink-0">
        {ndvi != null && (
          <div className="flex items-center gap-1 text-[10px] font-semibold text-neutral-500 dark:text-neutral-400">
            <span className="text-neutral-400 dark:text-neutral-500">NDVI</span>
            <span className="text-emerald-500">{ndvi}</span>
          </div>
        )}
        {ndvi != null && (gi != null || lst != null || canopy != null) && (
          <span className="text-neutral-200 dark:text-neutral-800 text-[10px]">
            |
          </span>
        )}

        {gi != null && (
          <div className="flex items-center gap-1 text-[10px] font-semibold text-neutral-500 dark:text-neutral-400">
            <span className="text-neutral-400 dark:text-neutral-500">GI</span>
            <span className="text-emerald-500">{gi}</span>
          </div>
        )}
        {gi != null && (lst != null || canopy != null) && (
          <span className="text-neutral-200 dark:text-neutral-800 text-[10px]">
            |
          </span>
        )}

        {lst != null && (
          <div className="flex items-center gap-1 text-[10px] font-semibold text-neutral-500 dark:text-neutral-400">
            <span className="text-neutral-400 dark:text-neutral-500">LST</span>
            <span className="text-emerald-500">{lst}</span>
          </div>
        )}
        {lst != null && canopy != null && (
          <span className="text-neutral-200 dark:text-neutral-800 text-[10px]">
            |
          </span>
        )}

        {canopy != null && (
          <div className="flex items-center gap-1 text-[10px] font-semibold text-neutral-500 dark:text-neutral-400">
            <span className="text-neutral-400 dark:text-neutral-500">
              Canopy
            </span>
            <span className="text-emerald-500">{canopy}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function GroupHeader({ group }: { group: SavedSolutionGroup }) {
  const meta = group.meta;
  const type = group.type.toLowerCase();

  if (type === "barangay") {
    return (
      <div className="flex items-center gap-2">
        <MapPin size={18} className="text-primary-green shrink-0" />
        <span className="text-base font-bold text-neutral-900 dark:text-neutral-50 tracking-tight font-poppins">
          {group.label}
        </span>
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
      <div className="flex flex-col gap-0.5 w-full text-left">
        <div className="flex items-center gap-2">
          <Pin size={16} className="text-blue-500 shrink-0 rotate-45" />
          <span className="text-base font-bold text-neutral-900 dark:text-neutral-50 tracking-tight font-poppins">
            {group.label !== subtitle ? group.label : "Pin Location"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-[26px]">
          {address && (
            <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 line-clamp-1">
              {address}
            </p>
          )}
          {address && (
            <div className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700 shrink-0" />
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
      <div className="flex flex-col gap-0.5 w-full text-left">
        <div className="flex items-center gap-2">
          <Ruler size={18} className="text-amber-500 shrink-0" />
          <span className="text-base font-bold text-neutral-900 dark:text-neutral-50 tracking-tight font-poppins">
            Custom Area{ha != null ? ` — ${ha.toFixed(2)} ha` : ""}
          </span>
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
    <span className="text-base font-bold text-neutral-900 dark:text-neutral-50 tracking-tight font-poppins">
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
        efficiencyLevel={String(snap.efficiencyLevel ?? "Moderately Efficient")}
        value={Number(snap.value ?? 50)}
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
  const dateGroups = useMemo(
    () => groupSavesByDate(group.saves),
    [group.saves],
  );

  return (
    <div className="space-y-4 bg-white/40 dark:bg-neutral-950/40 p-5 rounded-2xl border border-white/40 dark:border-neutral-900 shadow-sm transition-all duration-300 hover:border-neutral-200 dark:hover:border-neutral-800">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 py-1 hover:opacity-85 transition-opacity"
      >
        <GroupHeader group={group} />
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-bold text-neutral-400 dark:text-neutral-505 bg-neutral-100/50 dark:bg-neutral-900/50 px-3 py-1 rounded-full border border-neutral-200/30 dark:border-neutral-800/30 shadow-sm">
            {group.saves.length}{" "}
            {group.saves.length === 1 ? "Solution" : "Solutions"}
          </span>
          {open ? (
            <ChevronDown size={16} className="text-neutral-400" />
          ) : (
            <ChevronRight size={16} className="text-neutral-400" />
          )}
        </div>
      </button>

      {open && (
        <div className="space-y-5 pt-3 pl-1 sm:pl-4">
          {dateGroups.map(({ dateLabel, context, saves }) => (
            <div key={dateLabel} className="space-y-2">
              <DateGroupHeader dateLabel={dateLabel} context={context} />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {saves.map((s) => (
                  <SavedCard
                    key={s.id}
                    save={s}
                    onDelete={onDelete}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ tab }: { tab: "barangay" | "point" | "custom" }) {
  const titles = {
    barangay: "No saved barangay solutions",
    point: "No saved point solutions",
    custom: "No saved custom area solutions",
  };
  const descriptions = {
    barangay:
      "Go to the Explore map, select a barangay, generate solutions, and bookmark them to see them here.",
    point:
      "Use the Explore map to place a pin or select a point of interest, generate solutions, and bookmark them.",
    custom:
      "Draw a custom polygon on the Explore map, generate solutions, and bookmark them to keep track.",
  };
  const icons = {
    barangay: <MapPin size={32} className="text-neutral-400" />,
    point: <Pin size={32} className="text-neutral-400" />,
    custom: <Ruler size={32} className="text-neutral-400" />,
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center rounded-2xl bg-white/30 dark:bg-neutral-900/30 border border-white/50 dark:border-neutral-800 shadow-sm animate-in fade-in-50 duration-200">
      <div className="p-4 rounded-full bg-neutral-100 dark:bg-neutral-800 shadow-inner">
        {icons[tab]}
      </div>
      <div className="space-y-1 px-4">
        <p className="text-base text-neutral-750 dark:text-neutral-300 font-bold font-poppins">
          {titles[tab]}
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm">
          {descriptions[tab]}
        </p>
      </div>
    </div>
  );
}

interface TabSelectorProps {
  activeTab: "barangay" | "point" | "custom";
  setActiveTab: (tab: "barangay" | "point" | "custom") => void;
}

function TabSelector({ activeTab, setActiveTab }: TabSelectorProps) {
  return (
    <div className="flex w-full p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900/60 border border-neutral-200/50 dark:border-neutral-800 shadow-sm font-poppins shrink-0">
      <button
        onClick={() => setActiveTab("barangay")}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
          activeTab === "barangay"
            ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm"
            : "text-neutral-550 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"
        }`}
      >
        <MapPin size={14} className="text-primary-green" />
        <span>Barangay</span>
        <span
          className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-all ${
            activeTab === "barangay"
              ? "bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-450"
              : "bg-neutral-200/40 dark:bg-neutral-800/40 text-neutral-500"
          }`}
        ></span>
      </button>

      <button
        onClick={() => setActiveTab("point")}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
          activeTab === "point"
            ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm"
            : "text-neutral-550 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"
        }`}
      >
        <Pin size={14} className="text-blue-500 rotate-45" />
        <span>Point Location</span>
        <span
          className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-all ${
            activeTab === "point"
              ? "bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-450"
              : "bg-neutral-200/40 dark:bg-neutral-800/40 text-neutral-500"
          }`}
        ></span>
      </button>

      <button
        onClick={() => setActiveTab("custom")}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
          activeTab === "custom"
            ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm"
            : "text-neutral-550 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"
        }`}
      >
        <Ruler size={14} className="text-amber-500" />
        <span>Custom Area</span>
        <span
          className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-all ${
            activeTab === "custom"
              ? "bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-450"
              : "bg-neutral-200/40 dark:bg-neutral-800/40 text-neutral-500"
          }`}
        ></span>
      </button>
    </div>
  );
}

export default function SavedSolutionsPage() {
  const { saves, isLoading, error, removeSolution } = useSavedSolutions();

  const [activeTab, setActiveTab] = useState<"barangay" | "point" | "custom">(
    "barangay",
  );
  const [activeSave, setActiveSave] = useState<SavedSolutionRow | null>(null);
  const [detailCurrentTab, setDetailCurrentTab] = useState<DetailTab>("INFO");
  const [detailChatMessages, setDetailChatMessages] = useState<
    ChatHistoryMessage[]
  >([]);
  const [detailChatInput, setDetailChatInput] = useState("");
  const [isDetailChatLoading, setIsDetailChatLoading] = useState(false);
  const [detailTimelineView, setDetailTimelineView] =
    useState<TimelineViewMode>("DEFAULT");

  const groups = useMemo(() => groupSaves(saves), [saves]);

  const barangayCount = useMemo(
    () =>
      saves.filter((s) => s.locationType.toLowerCase() === "barangay").length,
    [saves],
  );
  const pointCount = useMemo(
    () =>
      saves.filter(
        (s) =>
          s.locationType.toLowerCase() === "poi" ||
          s.locationType.toLowerCase() === "point",
      ).length,
    [saves],
  );
  const customCount = useMemo(
    () => saves.filter((s) => s.locationType.toLowerCase() === "custom").length,
    [saves],
  );

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      const type = g.type.toLowerCase();
      if (activeTab === "barangay") return type === "barangay";
      if (activeTab === "point") return type === "poi" || type === "point";
      if (activeTab === "custom") return type === "custom";
      return false;
    });
  }, [groups, activeTab]);

  const closeDetail = () => {
    setActiveSave(null);
    setDetailCurrentTab("INFO");
    setDetailChatMessages([]);
  };

  return (
    <main className="relative flex min-h-screen max-w-screen flex-col bg-neutral-50 dark:bg-neutral-950 font-roboto text-neutral-900 dark:text-neutral-100 transition-colors">
      <Navbar />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary-green/5 dark:bg-primary-green/10 rounded-full blur-[120px]" />
        <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full flex flex-col overflow-hidden px-4 md:px-10 sm:pl-28 md:pl-36 py-8 md:py-12 lg:py-14 gap-6 min-h-screen">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-neutral-50 font-poppins tracking-tight">
            Saved Solutions
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl mt-1">
            All the greening interventions you&apos;ve saved from the Explore
            map, grouped by location and snapshotted by date. Keep track of your
            planned strategies here.
          </p>
        </header>

        {!isLoading && saves.length > 0 && (
          <TabSelector activeTab={activeTab} setActiveTab={setActiveTab} />
        )}

        {error ? (
          <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400">
            <p className="text-sm font-semibold">{error}</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-6">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-32 rounded-2xl bg-white/40 dark:bg-neutral-900/40 border border-white/50 dark:border-neutral-800 animate-pulse"
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
        ) : filteredGroups.length === 0 ? (
          <EmptyState tab={activeTab} />
        ) : (
          <div className="space-y-6 pb-10">
            {filteredGroups.map((g) => (
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
              className="flex h-full w-full max-w-[1440px] overflow-hidden rounded-[2rem] border 
              border-white/50 bg-white/95 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950/95 
              dark:shadow-black/40 animate-in slide-in-from-bottom-4 duration-300"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex w-full flex-col overflow-hidden">
                <div
                  className="flex items-center justify-between border-b border-neutral-100 
                bg-white/70 p-4 md:p-6 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-950/60"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="shrink-0 rounded-2xl bg-primary-green/10 p-3.5 text-primary-green shadow-inner dark:bg-primary-green/20 dark:text-primary-green/80">
                      <MapPin size={24} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-lg font-bold leading-tight text-neutral-900 dark:text-neutral-50">
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
