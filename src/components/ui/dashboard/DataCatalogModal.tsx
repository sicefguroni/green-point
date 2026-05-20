"use client";

import { createPortal } from "react-dom";
import { X, Table, RefreshCw } from "lucide-react";

interface DataMetric {
  metric: string;
  source: string;
  relevance: string;
  frequency: string;
}

const dataCatalog: DataMetric[] = [
  {
    metric: "NDVI (Vegetation Index)",
    source: "GEE / Sentinel-2",
    relevance:
      "Measures vegetation health and density via near-infrared/red reflectance. Calculated as a rolling 1-year median from Sentinel-2 SR Harmonized imagery.",
    frequency: "6-hour system cache / Live (GEE)",
  },
  {
    metric: "Surface Temperature (LST)",
    source: "GEE / MODIS (with NASA POWER fallback)",
    relevance:
      "Calculates thermal radiation from surfaces. 1-year rolling median identifies heat islands and lack of canopy. Point queries fall back to NASA POWER if GEE is offline.",
    frequency: "6-hour system cache / Live (GEE)",
  },
  {
    metric: "Tree Canopy Coverage",
    source: "Blended (Tree Inventory + Sentinel-2 NDVI)",
    relevance:
      "High-fidelity canopy model. Blends local geotagged tree inventory (calculating crown area from DBH and height) with NDVI spectral estimates (discounted to 40% if no inventory, otherwise uses max value).",
    frequency: "6-hour system cache / Live (Prisma + GEE)",
  },
  {
    metric: "Tagged Trees (Ground Truth)",
    source: "Local Database (Supabase)",
    relevance:
      "Individual trees tagged and verified via field surveys. Includes species, DBH, height, and coordinates, synced from local census records.",
    frequency: "Real-time from Database",
  },
  {
    metric: "Greenery Index (Composite)",
    source: "Multi-Source Blend",
    relevance:
      "A composite environmental health grade (NDVI 35%, Normalized LST 25%, Blended Tree Canopy 25%, estimated Green Area 15%) used to prioritize greening interventions.",
    frequency: "Computed live on-demand / 6-hour cache",
  },
  {
    metric: "Flood & Storm Hazards",
    source: "Project NOAH / UP RI (Mapbox Tiles)",
    relevance:
      "Susceptibility mapping based on topography, drainage, and return-period models (5-yr, 25-yr, 100-yr flood levels, storm surge advisories 1-4). Guides nature-based solutions.",
    frequency: "Static Reference Map Layers",
  },
  {
    metric: "Air Quality (AQI)",
    source: "WAQI API / Station Sensors",
    relevance:
      "Real-time tracking of atmospheric pollutants (PM2.5, PM10, CO, NO2, SO2, O3) via local sensors. Helps measure mitigation impact of urban greenery.",
    frequency: "20-minute cached station data",
  },
];

export default function DataCatalogModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-md flex justify-center items-center z-[200] animate-in fade-in duration-300">
      <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] p-8 shadow-2xl shadow-black/10 dark:shadow-black/40 max-w-4xl w-full mx-4 border border-neutral-100 dark:border-neutral-800 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-50 dark:bg-green-500/15 text-primary-green dark:text-green-300 rounded-2xl">
              <Table size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
                Project Data Catalog
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Methodology and authoritative data sources
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full text-neutral-400 dark:text-neutral-500 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-x-auto overflow-y-auto scrollbar-hide pr-2">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white dark:bg-neutral-900 z-10">
              <tr className="border-b border-neutral-100 dark:border-neutral-800">
                <th className="py-4 px-4 text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">
                  Metric
                </th>
                <th className="py-4 px-4 text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">
                  Source
                </th>
                <th className="py-4 px-4 text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">
                  Why it Matters
                </th>
                <th className="py-4 px-4 text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">
                  Update Freq
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50 dark:divide-neutral-800">
              {dataCatalog.map((item, idx) => (
                <tr
                  key={idx}
                  className="group hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 transition-colors"
                >
                  <td className="py-5 px-4">
                    <span className="font-bold text-neutral-800 dark:text-neutral-100 text-sm">
                      {item.metric}
                    </span>
                  </td>
                  <td className="py-5 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 uppercase tracking-tighter">
                      {item.source}
                    </span>
                  </td>
                  <td className="py-5 px-4 max-w-xs">
                    <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
                      {item.relevance}
                    </p>
                  </td>
                  <td className="py-5 px-4 max-w-[140px]">
                    <div className="flex items-start gap-1.5 text-[11px] font-medium text-neutral-400 dark:text-neutral-500 group-hover:text-primary-green transition-colors">
                      <RefreshCw size={12} className="mt-0.5 shrink-0" />
                      <span className="leading-relaxed">{item.frequency}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 pt-6 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-xl text-sm font-bold hover:bg-neutral-800 dark:hover:bg-white transition-all active:scale-95 shadow-lg shadow-neutral-200 dark:shadow-black/20"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
