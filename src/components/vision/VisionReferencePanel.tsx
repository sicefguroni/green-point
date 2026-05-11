"use client";

import Image from "next/image";
import { X } from "lucide-react";
import type { VisionContext } from "@/lib/vision/context";
import {
  VISION_COLORS,
  levelToOpacity,
  permeabilityOpacity,
  soilOverlayOpacity,
  VISION_LEGEND_DISCLAIMER,
} from "@/lib/vision/visualization";

function rgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function VisionSchematicLayers({
  visionContext,
}: {
  visionContext: VisionContext;
}) {
  const v = visionContext;
  const groundA = levelToOpacity(v.groundOpenSpaceLevel);
  const buildingsA = levelToOpacity(v.buildingDensityLevel);
  const roofA = levelToOpacity(v.roofGreeningPotential);
  const verticalA = levelToOpacity(v.verticalGreeningPotential);
  const permA = permeabilityOpacity(v.permeabilityHint);
  const soilA = soilOverlayOpacity(v.soilVisibility);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      {/* Base: permeability + soil (subtle full-frame cues) */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: rgba(VISION_COLORS.permeability, permA) }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 120% 80% at 50% 100%, ${rgba(VISION_COLORS.soil, soilA * 1.4)} 0%, transparent 55%)`,
        }}
      />

      {/* Ground: lower band */}
      <div
        className="absolute inset-x-0 bottom-0 h-[38%]"
        style={{
          background: `linear-gradient(to top, ${rgba(VISION_COLORS.ground, groundA)} 0%, transparent 100%)`,
        }}
      />

      {/* Buildings: upper mass */}
      <div
        className="absolute inset-x-0 top-0 h-[58%]"
        style={{
          background: `linear-gradient(to bottom, ${rgba(VISION_COLORS.buildings, buildingsA)} 0%, transparent 95%)`,
        }}
      />

      {/* Roofline strip */}
      <div
        className="absolute inset-x-[8%] top-[32%] h-[10%]"
        style={{
          backgroundColor: rgba(VISION_COLORS.roof, roofA),
        }}
      />

      {/* Vertical facades: side strips */}
      <div
        className="absolute inset-y-0 left-0 w-[14%]"
        style={{
          background: `linear-gradient(to right, ${rgba(VISION_COLORS.vertical, verticalA)} 0%, transparent 100%)`,
        }}
      />
      <div
        className="absolute inset-y-0 right-0 w-[14%]"
        style={{
          background: `linear-gradient(to left, ${rgba(VISION_COLORS.vertical, verticalA)} 0%, transparent 100%)`,
        }}
      />
    </div>
  );
}

function VisionMiniLegend({
  visionContext,
  layout = "grid",
}: {
  visionContext: VisionContext;
  layout?: "grid" | "stack";
}) {
  const rows: { color: string; text: string }[] = [
    {
      color: VISION_COLORS.ground,
      text: `Ground · ${visionContext.groundOpenSpaceLevel}`,
    },
    {
      color: VISION_COLORS.buildings,
      text: `Buildings · ${visionContext.buildingDensityLevel}`,
    },
    {
      color: VISION_COLORS.roof,
      text: `Roof · ${visionContext.roofGreeningPotential}`,
    },
    {
      color: VISION_COLORS.vertical,
      text: `Vertical · ${visionContext.verticalGreeningPotential}`,
    },
    {
      color: VISION_COLORS.soil,
      text: `Soil · ${visionContext.soilVisibility}`,
    },
    {
      color: VISION_COLORS.permeability,
      text: `Permeability · ${visionContext.permeabilityHint}`,
    },
  ];

  const gridClass =
    layout === "stack"
      ? "grid grid-cols-1 gap-y-1"
      : "grid grid-cols-2 gap-x-2 gap-y-1";

  return (
    <div
      className={`flex min-h-0 flex-col space-y-1.5 rounded-xl border border-neutral-200/80 bg-white/90 px-2 py-2 dark:border-neutral-700 dark:bg-neutral-900/80 ${
        layout === "stack"
          ? "min-h-[15rem] min-w-0 flex-1 justify-between sm:min-h-[16rem]"
          : ""
      }`}
    >
      <p className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Scene legend
      </p>
      <div className={`min-h-0 ${gridClass} overflow-y-auto`}>
        {rows.map((row) => (
          <div key={row.text} className="flex min-w-0 items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20"
              style={{ backgroundColor: row.color }}
            />
            <span className="truncate text-[8px] font-medium text-neutral-600 dark:text-neutral-300 sm:text-[9px]">
              {row.text}
            </span>
          </div>
        ))}
      </div>
      <p className="shrink-0 text-[8px] leading-snug text-neutral-400 dark:text-neutral-500">
        {VISION_LEGEND_DISCLAIMER}
      </p>
    </div>
  );
}

export interface VisionReferencePanelProps {
  imageUrl: string;
  visionContext: VisionContext | null;
  /** When true, shows compact legend under the image (e.g. mobile or when map legend is hidden). */
  showMiniLegend?: boolean;
  /** When `showMiniLegend` is true, render legend to the right of the image instead of below. */
  miniLegendToRight?: boolean;
  /** Wide banner-style image using full horizontal space (e.g. desktop full-width column). */
  wide?: boolean;
  size?: "sm" | "md";
  onClearPress?: () => void;
  showClearOnHover?: boolean;
}

export default function VisionReferencePanel({
  imageUrl,
  visionContext,
  showMiniLegend = false,
  miniLegendToRight = false,
  wide = false,
  size = "md",
  onClearPress,
  showClearOnHover = true,
}: VisionReferencePanelProps) {
  const dim = size === "sm" ? "h-60 w-60" : "h-48 w-48";
  const roundedImg = size === "sm" ? "rounded-xl" : "rounded-[1.5rem]";

  const imageShellClass = wide
    ? "group/img relative aspect-[16/9] w-full min-h-[12rem] max-h-64 shrink-0 overflow-hidden rounded-xl shadow-lg"
    : `group/img relative ${dim} shrink-0 overflow-hidden shadow-lg ${roundedImg}`;

  const imageBlock = (
    <div className={imageShellClass}>
      <Image
        src={imageUrl}
        alt="Uploaded reference"
        fill
        className="object-cover"
        sizes={
          wide
            ? "(min-width: 1024px) 480px, 90vw"
            : size === "sm"
              ? "240px"
              : "192px"
        }
      />
      {visionContext ? <VisionSchematicLayers visionContext={visionContext} /> : null}
      {visionContext ? (
        <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
          {Math.round(visionContext.confidence * 100)}%
        </div>
      ) : null}
      {onClearPress ? (
        <button
          type="button"
          onClick={onClearPress}
          className={`absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white transition-all hover:scale-110 ${
            showClearOnHover
              ? "opacity-0 group-hover/img:opacity-100"
              : "opacity-100"
          }`}
          aria-label="Clear selection"
        >
          <X size={size === "sm" ? 14 : 16} />
        </button>
      ) : null}
    </div>
  );

  const legendBlock =
    showMiniLegend && visionContext ? (
      <VisionMiniLegend
        visionContext={visionContext}
        layout={miniLegendToRight ? "stack" : "grid"}
      />
    ) : null;

  return (
    <div
      className={`border border-white/50 bg-white/90 shadow-2xl backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/90 ${
        wide
          ? "w-full max-w-none rounded-2xl p-2 sm:p-3"
          : size === "sm"
            ? "rounded-2xl p-1.5"
            : "rounded-[2rem] p-2"
      }`}
    >
      {showMiniLegend && visionContext && miniLegendToRight ? (
        <div
          className={`flex min-h-0 w-full items-stretch ${wide ? "gap-4" : "gap-3"}`}
        >
          <div
            className={`flex min-w-0 flex-col ${wide ? "min-w-0 flex-[1.15]" : "shrink-0"}`}
          >
            {imageBlock}
            <p className="mt-2 text-center text-[10px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
              Reference image
            </p>
          </div>
          {legendBlock}
        </div>
      ) : (
        <>
          {imageBlock}
          <p className="mt-2 text-center text-[10px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
            Reference image
          </p>
          {legendBlock}
        </>
      )}
    </div>
  );
}
