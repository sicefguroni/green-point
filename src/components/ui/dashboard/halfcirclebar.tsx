"use client"

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
  value,
  min = 0,
  max = 1,
  sizePx = 130,
  pathColor = "#4CAF50",
  trailColor = "#E5E7EB",
  textColor = "#4CAF50",
}: HalfCircleBarProps) {
  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max) && max > safeMin ? max : safeMin + 1;
  const clampedValue = Math.min(safeMax, Math.max(safeMin, value));
  const range = safeMax - safeMin;
  const percentage = ((clampedValue - safeMin) / range) * 100;

  const valueColor = (percentage: number) => {
    if (percentage >= 70) {
      return "#4CAF50";
    } else if (percentage >= 40) {
      return "#FDC700";
    } else if (percentage > 0) {
      return "#FF6467";
    }
    return "#FF6467"; // Default color for 0 or negative values
  }

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
            strokeLinecap: 'round',
          }),
          text: {
            fill: valueTextColor,
            textAnchor: 'middle',
            fontSize: '24px',
            fontWeight: 'bold',
            transform: 'translate(0, 4px)',
          },
          
        }}
      />
    </div>
  );
}

