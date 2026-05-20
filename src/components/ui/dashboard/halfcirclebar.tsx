"use client";

import { useSyncExternalStore } from "react";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import { formatUpTo2Decimals } from "@/lib/format-number";

function subscribeHtmlDarkClass(onStoreChange: () => void) {
  const el = document.documentElement;
  const observer = new MutationObserver(onStoreChange);
  observer.observe(el, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function getHtmlHasDarkClass() {
  return document.documentElement.classList.contains("dark");
}

function useHtmlDarkMode(): boolean {
  return useSyncExternalStore(
    subscribeHtmlDarkClass,
    getHtmlHasDarkClass,
    () => false,
  );
}

interface HalfCircleBarProps {
  // Current value of the gauge
  value: number;
  // Domain for the gauge
  min?: number;
  max?: number;
  // Visual options
  unit?: string; // e.g. "%", "km/h"
  sizePx?: number; // width in pixels; height becomes size/2
  pathColor?: string;
  trailColor?: string;
  textColor?: string;
  strokeWidth?: number;
}

export default function HalfCircleBar({
  value,
  min = 0,
  max = 1,
  sizePx = 130,
  trailColor,
  pathColor,
  textColor,
}: HalfCircleBarProps) {
  const isDarkMode = useHtmlDarkMode();
  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max) && max > safeMin ? max : safeMin + 1;
  const clampedValue = Math.min(safeMax, Math.max(safeMin, value));
  const range = safeMax - safeMin;
  const percentage = ((clampedValue - safeMin) / range) * 100;

  const arcColor = (pct: number): string => {
    if (pathColor) return pathColor;
    if (pct >= 70) return "#16a34a";
    if (pct >= 50) return "#65a30d";
    if (pct > 30) return "#e7aa25";
    return "#dc2626";
  };

  const valueTextColor = textColor ?? (isDarkMode ? "#f5f5f5" : "#171717");
  const valuePathColor = arcColor(percentage);
  const effectiveTrailColor =
    trailColor ?? (isDarkMode ? "#262626" : "#f0f0f0");

  return (
    <div style={{ width: sizePx, height: sizePx / 2 }} className="select-none">
      <CircularProgressbar
        value={percentage}
        text={formatUpTo2Decimals(clampedValue)}
        circleRatio={0.5}
        strokeWidth={10}
        styles={{
          ...buildStyles({
            rotation: 0.75,
            pathTransitionDuration: 0.5,
            pathColor: valuePathColor,
            trailColor: effectiveTrailColor,
            textColor: valueTextColor,
            strokeLinecap: "round",
          }),
          text: {
            fill: valueTextColor,
            textAnchor: "middle",
            fontSize: "24px",
            fontWeight: "bold",
            transform: "translate(0, 4px)",
          },
        }}
      />
    </div>
  );
}
