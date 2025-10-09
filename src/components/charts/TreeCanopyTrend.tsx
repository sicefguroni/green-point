"use client"

import { AreaChart, Area, XAxis, ResponsiveContainer } from "recharts"
import { CHARTS_DATA_COLORS } from "@/lib/chart-colors"

export interface CanopyData {
  year: string;
  canopy: number;
}

interface TreeCanopyTrendProps {
  data: CanopyData[];
  since?: string;
  changePercent?: number;
}

export default function TreeCanopyTrend({ data, since, changePercent }: TreeCanopyTrendProps) {
  return (
    <div className="w-full h-full flex flex-col justify-between">
      <div className="text-sm text-neutral-black/70 mb-1">
        🌳 Tree Canopy % (since {since ?? "start"})
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <XAxis dataKey="year" hide />
          <Area 
            type="monotone"
            dataKey="canopy"
            stroke={CHARTS_DATA_COLORS.canopy}
            fill={CHARTS_DATA_COLORS.canopy + "33"}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>

      {changePercent !== undefined && (
        <div className="text-sm text-neutral-black/70">
          <span className={changePercent > 0 ? "text-green-500" : "text-red-500"}>
            {changePercent > 0 ? "+" : ""}
            {changePercent.toFixed(2)}%
          </span>
        </div>
      )}
    </div>
  );
}