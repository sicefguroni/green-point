"use client";

import { createPortal } from "react-dom";
import { X, Table, ShieldCheck, RefreshCw, Star } from "lucide-react";

interface DataMetric {
  metric: string;
  source: string;
  relevance: string;
  frequency: string;
}

const dataCatalog: DataMetric[] = [
  {
    metric: "NDVI (Vegetation health)",
    source: "ESA Copernicus Sentinel-2",
    relevance:
      "Measures 'live green' density. Crucial for identifying health of urban flora and metabolic activity.",
    frequency: "Every 5 days (Satellite revisit)",
  },
  {
    metric: "LST (Surface Temp)",
    source: "NASA POWER / Landsat-8",
    relevance:
      "Identifies Urban Heat Islands. Essential for heat adaptation planning and identifying high-risk zones.",
    frequency: "Daily / 16-day cycles",
  },
  {
    metric: "Tree Canopy Cover",
    source: "Copernicus Land Monitoring / Google",
    relevance:
      "Measures actual ground shade. Direct correlation with pedestrian thermal comfort and street walkability.",
    frequency: "Annual snapshots",
  },
  {
    metric: "Flood Hazard (Susceptibility)",
    source: "Project NOAH / UP RI / MGB",
    relevance:
      "Terrain-based risk assessment. structural baseline for resilient urban development.",
    frequency: "Strategic (Every 3-5 years)",
  },
  {
    metric: "Storm Surge Inundation",
    source: "Project NOAH / PAGASA",
    relevance:
      "Coastal risk monitoring. Vital for protecting lives and maritime infrastructure in Mandaue.",
    frequency: "Static Reference (Climate models)",
  },
  {
    metric: "Air Quality (AQI)",
    source: "WAQI / AQICN / DENR-EMB",
    relevance:
      "Tracks pollutants (PM2.5, NO2). Links urban greenery with actual cardiopulmonary health outcomes.",
    frequency: "Hourly / Real-time",
  },
  {
    metric: "Socioeconomic Data",
    source: "PSA (Philippine Statistics Authority)",
    relevance:
      "Overlays poverty and population. Ensures environmental justice and equitable resource distribution.",
    frequency: "Every 3-5 Years (Census)",
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
      <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl max-w-4xl w-full mx-4 border border-neutral-100 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-50 text-primary-green rounded-2xl">
              <Table size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-900">
                Project Data Catalog
              </h2>
              <p className="text-sm text-neutral-500">
                Methodology and authoritative data sources
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-full text-neutral-400 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-x-auto overflow-y-auto scrollbar-hide pr-2">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-neutral-100">
                <th className="py-4 px-4 text-xs font-bold text-neutral-400 uppercase tracking-widest">
                  Metric
                </th>
                <th className="py-4 px-4 text-xs font-bold text-neutral-400 uppercase tracking-widest">
                  Source
                </th>
                <th className="py-4 px-4 text-xs font-bold text-neutral-400 uppercase tracking-widest">
                  Why it Matters
                </th>
                <th className="py-4 px-4 text-xs font-bold text-neutral-400 uppercase tracking-widest">
                  Update Freq
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {dataCatalog.map((item, idx) => (
                <tr
                  key={idx}
                  className="group hover:bg-neutral-50/50 transition-colors"
                >
                  <td className="py-5 px-4">
                    <div className="flex items-center gap-2">
                      <Star size={12} className="text-yellow-400" />
                      <span className="font-bold text-neutral-800 text-sm">
                        {item.metric}
                      </span>
                    </div>
                  </td>
                  <td className="py-5 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-200 uppercase tracking-tighter">
                      {item.source}
                    </span>
                  </td>
                  <td className="py-5 px-4 max-w-xs">
                    <p className="text-neutral-500 text-xs leading-relaxed">
                      {item.relevance}
                    </p>
                  </td>
                  <td className="py-5 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-400 group-hover:text-primary-green transition-colors">
                      <RefreshCw size={12} />
                      {item.frequency}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 pt-6 border-t border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary-green">
            <ShieldCheck size={18} />
            <span className="text-xs font-bold uppercase tracking-widest">
              Verified Multi-source integration
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-bold hover:bg-neutral-800 transition-all active:scale-95 shadow-lg shadow-neutral-200"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
