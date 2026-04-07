export function getGreeneryColor(value: number): string {
  // Aligned with recalibrated GI levels (Very Low, Low, Medium, High, Very High)
  const safeValue = Math.max(0, value);
  return safeValue >= 0.75
    ? "#1a9850" // Very High
    : safeValue >= 0.55
      ? "#91cf60" // High
      : safeValue >= 0.35
        ? "#fee08b" // Medium
        : safeValue >= 0.15
          ? "#fc8d59" // Low
          : safeValue > 0
            ? "#d73027" // Very Low
            : "#f3f4f6"; // missing data
}

export function getGreeneryClassColor(value: number): string {
  const safeValue = Math.max(0, value);
  return safeValue >= 0.75
    ? "text-green-700 bg-green-100 border-green-200"
    : safeValue >= 0.55
      ? "text-emerald-700 bg-emerald-100 border-emerald-200"
      : safeValue >= 0.35
        ? "text-amber-700 bg-amber-100 border-amber-200"
        : safeValue >= 0.15
          ? "text-orange-700 bg-orange-100 border-orange-200"
          : "text-red-700 bg-red-100 border-red-200";
}

export function getGreeneryTextColor(value: number): string {
  const safeValue = Math.max(0, value);
  return safeValue >= 0.75
    ? "text-green-700"
    : safeValue >= 0.55
      ? "text-emerald-700"
      : safeValue >= 0.35
        ? "text-amber-700"
        : safeValue >= 0.15
          ? "text-orange-700"
          : "text-red-700";
}

export function getTemperatureColor(value: number): string {
  return value >= 34
    ? "text-red-700 bg-red-100 border-red-200"
    : value >= 31
      ? "text-orange-700 bg-orange-100 border-orange-200"
      : "text-amber-700 bg-amber-50 border-amber-200";
}
