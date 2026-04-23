"use client";

import React from "react";
import { Info, ChevronUp, ChevronDown } from "lucide-react";

export type LegendType = "gradient" | "categorical";

export interface LegendStop {
  value: number | string;
  color: string;
  label?: string;
}

export interface LegendConfig {
  id: string;
  title: string;
  unit?: string;
  type: LegendType;
  stops: LegendStop[];
}

interface MapLegendProps {
  activeLegends: LegendConfig[];
  selectedLegendId: string;
  onLegendChange: (id: string) => void;
}

export default function MapLegend({
  activeLegends,
  selectedLegendId,
  onLegendChange,
}: MapLegendProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);

  if (activeLegends.length === 0) return null;

  const currentLegend =
    activeLegends.find((l) => l.id === selectedLegendId) || activeLegends[0];

  return (
    <div
      className={`transition-all duration-300 ${
        isExpanded ? "w-[260px] sm:w-[320px]" : "w-[110px]"
      }`}
    >
      <div
        className={`rounded-2xl border border-white/30 bg-white/90 shadow-2xl backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950/85 transition-all duration-300 ${
          isExpanded ? "p-4" : "p-2 px-3"
        }`}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-full flex items-center justify-between gap-2 transition-all duration-200 group ${
            isExpanded ? "mb-4" : ""
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary-green/10 transition-colors group-hover:bg-primary-green/15 dark:bg-primary-green/20 dark:group-hover:bg-primary-green/30">
              <Info
                size={14}
                className="text-primary-green transition-transform group-hover:rotate-12 dark:text-primary-green/80"
              />
            </div>
            <span className="text-xs font-bold text-neutral-700 dark:text-neutral-100">
              Legend
            </span>
          </div>
        </button>

        {isExpanded && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            {activeLegends.length > 1 && (
              <div className="flex flex-wrap gap-1.5 border-b border-neutral-100 pb-3.5 dark:border-neutral-800">
                {activeLegends.map((legend) => (
                  <button
                    key={legend.id}
                    onClick={() => onLegendChange(legend.id)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      currentLegend.id === legend.id
                        ? "bg-neutral-900 text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900"
                        : "text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    }`}
                  >
                    {legend.title}
                  </button>
                ))}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13px] font-black text-neutral-800 font-poppins dark:text-neutral-100">
                  {currentLegend.title}
                </span>
                {currentLegend.unit && (
                  <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500">
                    {currentLegend.unit}
                  </span>
                )}
              </div>

              {currentLegend.type === "gradient" ? (
                <div className="space-y-2.5">
                  <div
                    className="h-2.5 w-full rounded-full ring-1 ring-black/5 dark:ring-white/5"
                    style={{
                      background: `linear-gradient(to right, ${currentLegend.stops
                        .map((s) => s.color)
                        .join(", ")})`,
                    }}
                  />
                  <div className="flex justify-between px-0.5">
                    {currentLegend.stops.map((stop, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400"
                      >
                        {stop.label || stop.value}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {currentLegend.stops.map((stop, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div
                        className="h-3 w-3 rounded-full ring-2 ring-neutral-100 dark:ring-neutral-800 shadow-sm shrink-0"
                        style={{ backgroundColor: stop.color }}
                      />
                      <span className="text-[11px] font-medium text-neutral-600 truncate dark:text-neutral-400">
                        {stop.label || stop.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
