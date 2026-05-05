import { Leaf, Sprout, Trees, Thermometer } from "lucide-react";
import BarangayMetricItem from "./BarangayMetricItem";

interface BarangayMetricsGridProps {
  greeneryIndex: number | null;
  ndvi: number | null;
  treeCanopy: number | null;
  lst: number | null;
  columns?: 1 | 2;
  className?: string;
}

export default function BarangayMetricsGrid({
  greeneryIndex,
  ndvi,
  treeCanopy,
  lst,
  columns = 2,
  className = "",
}: BarangayMetricsGridProps) {
  const gridColsClass = columns === 1 ? "grid-cols-1" : "grid-cols-2";

  return (
    <div className={`grid w-full ${gridColsClass} gap-2 ${className}`}>
      {greeneryIndex !== null && (
        <BarangayMetricItem
          icon={Leaf}
          label="Greenery Index"
          value={greeneryIndex}
          metricType="gi"
        />
      )}
      {treeCanopy !== null && (
        <BarangayMetricItem
          icon={Trees}
          label="Tree Canopy"
          value={treeCanopy}
          metricType="canopy"
        />
      )}
      {ndvi !== null && (
        <BarangayMetricItem
          icon={Sprout}
          label="NDVI"
          value={ndvi}
          metricType="ndvi"
        />
      )}
      {lst !== null && (
        <BarangayMetricItem
          icon={Thermometer}
          label="Surface Temp"
          value={lst}
          metricType="lst"
        />
      )}
    </div>
  );
}
