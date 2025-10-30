"use client"

import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from "recharts"
import { CHARTS_DATA_COLORS } from "@/lib/chart-colors"
import { useMemo } from "react"
import { useBarangay } from "@/context/BarangayContext";

export interface BarangayRadarData {
  metric: string;
  barangay: number;
  city: number;
}

interface BarangayRadarChartProps {
  data: BarangayRadarData[];
}

export default function BarangayRadarChart({ data }: BarangayRadarChartProps) {
  const { selectedBarangay } = useBarangay();

  const clamp01 = (value: number) => {
    if (Number.isNaN(value)) return 0;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
  };

  const normalizedData = useMemo(() => {
    return data.map(d => ({
      ...d,
      barangay: clamp01(d.barangay),
      city: clamp01(d.city),
    }));
  }, [data]);

  return (
    <div className="w-full h-full">
      <ResponsiveContainer>
        <RadarChart data={normalizedData}>
          <PolarGrid />
          <PolarAngleAxis dataKey="metric" tick={{ fill: "#6b7280", fontSize: 12}} />
          <PolarRadiusAxis 
            angle={90} 
            domain={[0, 1]} 
            tick={{ fill: "#6b7280", fontSize: 12}}
            tickCount={5}
            tickFormatter={(v) => (typeof v === 'number' ? v.toFixed(2) : String(v))}
          />
          <Tooltip 
            formatter={(value: unknown, name: string) => {
              if (typeof value === 'number') return [value.toFixed(2), name];
              return [String(value), name];
            }}
            labelFormatter={(label) => String(label)}
          />
          <Radar
            name={selectedBarangay?.name}
            dataKey="barangay"
            stroke={CHARTS_DATA_COLORS.barangay}
            fill={CHARTS_DATA_COLORS.barangay}
            fillOpacity={0.4}
          />
          <Radar
            name="City"
            dataKey="city"
            stroke={CHARTS_DATA_COLORS.city}
            fill={CHARTS_DATA_COLORS.city}
            fillOpacity={0.4}
          />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}