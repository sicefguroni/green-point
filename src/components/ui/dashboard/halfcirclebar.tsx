"use client";

import { CircularProgressbar, buildStyles } from "react-circular-progressbar";

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
  value = 0,
  min = 0,
  max = 100,
  sizePx = 130,
  trailColor = "#E5E7EB",
}: HalfCircleBarProps) {
  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max) && max > safeMin ? max : safeMin + 1;
  const safeValue = Number.isFinite(value) ? value : 0;
  const clampedValue = Math.min(safeMax, Math.max(safeMin, safeValue));
  const range = safeMax - safeMin;
  const percentage = ((clampedValue - safeMin) / range) * 100;

  const valueColor = (percentage: number) => {
    if (percentage >= 70) {
      return "#16a34a"; // Green
    } else if (percentage >= 40) {
      return "#eab308"; // Yellow
    }
    return "#ef4444"; // Red
  };

  const valueTextColor = valueColor(percentage);
  const valuePathColor = valueColor(percentage);

  return (
    <div style={{ width: sizePx, height: sizePx / 2 }} className="select-none">
      <CircularProgressbar
        value={percentage}
        text={clampedValue.toString()}
        circleRatio={0.5}
        strokeWidth={10}
        styles={{
          ...buildStyles({
            rotation: 0.75,
            pathTransitionDuration: 0.5,
            pathColor: valuePathColor,
            trailColor,
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
