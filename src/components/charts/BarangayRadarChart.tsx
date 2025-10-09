"use client"

import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from "recharts"
import { CHARTS_DATA_COLORS } from "@/lib/chart-colors"

export interface BarangayRadarData {
  metric: string;
  barangay: number;
  city: number;
}

interface BarangayRadarChartProps {
  data: BarangayRadarData[];
}

export default function BarangayRadarChart({ data }: BarangayRadarChartProps) {
  return (
    <div className="w-full h-full">
      <ResponsiveContainer>
        <RadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="metric" tick={{ fill: "#6b7280", fontSize: 12}} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
          <Radar
            name="Barangay"
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