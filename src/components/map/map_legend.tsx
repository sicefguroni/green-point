"use client";

import React from "react";
import { Info } from "lucide-react";

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
  /** Optional footnote shown under the legend body (e.g. methodology disclaimers). */
  note?: string;
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
  const [isExpanded, setIsExpanded] = React.useState(false);

  if (activeLegends.length === 0) return null;

  const currentLegend =
    activeLegends.find((l) => l.id === selectedLegendId) || activeLegends[0];

  return (
    <div
      className={`transition-all duration-200 ${
        isExpanded
          ? "w-[248px] sm:w-[308px]"
          : "w-10 h-10 sm:w-[110px] sm:h-auto hover:scale-105 active:scale-95 cursor-pointer group"
      }`}
    >
      <div
        className={`rounded-2xl border border-white/30 bg-white/90 shadow-2xl backdrop-blur-xl 
          dark:border-neutral-800 dark:bg-neutral-950/85 transition-all duration-200 ${
            isExpanded
              ? "p-4"
              : "p-0 sm:p-2 sm:px-3 flex items-center justify-center w-full h-full"
          }`}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-full h-full flex items-center justify-center sm:justify-between gap-2 transition-all duration-200 group ${
            isExpanded ? "mb-4" : ""
          }`}
          aria-label="Map Legend"
          title="Map Legend"
        >
          <div className="flex items-center justify-center sm:justify-start gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary-green/10 transition-colors group-hover:bg-primary-green/15 dark:bg-primary-green/20 dark:group-hover:bg-primary-green/30 shrink-0">
              <Info
                size={14}
                className="text-primary-green transition-transform group-hover:rotate-12 dark:text-primary-green/80"
              />
            </div>
            <span
              className={`text-xs font-bold text-neutral-700 dark:text-neutral-100 font-roboto ${
                isExpanded ? "block" : "hidden sm:block"
              }`}
            >
              Legend
            </span>
          </div>
        </button>

        {isExpanded && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            {activeLegends.length > 1 && (
              <div className="flex flex-wrap gap-1 border-b border-neutral-100 pb-2.5 dark:border-neutral-800">
                {activeLegends.map((legend) => (
                  <button
                    key={legend.id}
                    onClick={() => onLegendChange(legend.id)}
                    className={`flex items-center justify-center rounded-lg px-2 py-1 sm:px-3 sm:py-1.5 text-center text-[11px] font-bold leading-snug transition-all ${
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
                <span className="text-[13px] font-bold text-neutral-800 font-poppins dark:text-neutral-100">
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
                <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                  {currentLegend.stops.map((stop, i) => (
                    <div key={i} className="flex items-center gap-2.5 py-0.5">
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
              {currentLegend.note ? (
                <p className="mt-3 text-[9px] leading-snug text-neutral-400 dark:text-neutral-500">
                  {currentLegend.note}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
