"use client"

import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts"
import { CHARTS_DATA_COLORS } from "@/lib/chart-colors"

export interface NDVILSTData {
  month: string;
  NDVI: number;
  LST: number;
}

interface NDVILSTChartProps {
  data: NDVILSTData[];
}

export default function NDVILSTChart({ data }: NDVILSTChartProps) {

  return (
    <div className="w-full h-full">      
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 40, left: 0, bottom: 0}}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" />
          <YAxis yAxisId="left" domain={[0, 1]} tick={{ fill: CHARTS_DATA_COLORS.ndvi}} />
          <YAxis yAxisId="right" orientation="right" tick={{ fill: CHARTS_DATA_COLORS.lst}} />
          <Tooltip />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="NDVI"
            stroke={CHARTS_DATA_COLORS.ndvi}
            strokeWidth={3}
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="LST"
            stroke={CHARTS_DATA_COLORS.lst}
            strokeWidth={3}
            dot={false}
          />
          <Legend />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}