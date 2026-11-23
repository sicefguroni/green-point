"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { CHARTS_DATA_COLORS } from "@/lib/chart-colors";

export interface PovertyData {
  label: string;
  value: number;
}

interface PovertyComparisonProps {
  data: PovertyData[];
}

export default function PovertyComparison({ data }: PovertyComparisonProps) {
  return (
    <div className="w-full h-full">
      <ResponsiveContainer height={180}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 10, right: 0, left: 10, bottom: 0 }}
          barCategoryGap={12}
          barGap={12}
        >
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis
            type="category"
            dataKey="label"
            width={80}
            tick={{ fill: "#6b7280", fontSize: 14 }}
          />
          <Bar
            dataKey="value"
            fill={CHARTS_DATA_COLORS.poverty}
            radius={[6, 6, 6, 6]}
            barSize={40}
          >
            <LabelList
              dataKey="value"
              position="right"
              fill="#6b7280"
              formatter={(v) => `${Number(v)}%`}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {data.length >= 2 && data[1].value > 0 ? (
        <p className="text-sm mt-6 text-gray-600">
          Barangay {data[0].label}&apos;s poverty rate is{" "}
          <strong>
            {(data[0].value / data[1].value).toFixed(1)}× the city average
          </strong>
          .
        </p>
      ) : null}
    </div>
  );
}
