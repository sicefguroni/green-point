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
    metric: "NDVI (Vegetation Index)",
    source: "GEE / Sentinel-2",
    relevance:
      "Detects photosynthetic activity. Measured as a rolling 1-year median to ensure seasonal stability and cloud-free accuracy.",
    frequency: "Daily rolling median",
  },
  {
    metric: "Surface Temperature (LST)",
    source: "GEE / MODIS / Landsat",
    relevance:
      "Calculates thermal radiation from surfaces. 1-year rolling median identifies consistent heat islands and lack of urban canopy.",
    frequency: "Daily rolling median",
  },
  {
    metric: "Tree Canopy Coverage",
    source: "Blended (Inventory + NDVI)",
    relevance:
      "High-fidelity canopy model that prioritizes ground-truth tagged trees and supplements with satellite spectral data.",
    frequency: "Sync with DB updates",
  },
  {
    metric: "Tagged Trees (Ground Truth)",
    source: "City Field Inventory",
    relevance:
      "Individual trees tagged and verified via field surveys. Includes species, DBH, and precise GPS coordinates.",
    frequency: "Periodic / On-demand",
  },
  {
    metric: "Greenery Index (Composite)",
    source: "Multi-Source Algorithm",
    relevance:
      "A weighted score (NDVI 35%, LST 25%, Canopy 25%, Area 15%) used to prioritize climate-resilient greening interventions.",
    frequency: "Live (On-demand)",
  },
  {
    metric: "Flood & Storm Hazards",
    source: "Project NOAH / UP RI",
    relevance:
      "Susceptibility modeling based on topography and drainage. Guides the placement of nature-based flood solutions.",
    frequency: "Static Reference",
  },
  {
    metric: "Air Quality (AQI)",
    source: "WAQI / DENR-EMB",
    relevance:
      "Real-time tracking of atmospheric pollutants (PM2.5/PM10). Measures the mitigation impact of urban greenery.",
    frequency: "Hourly / Real-time",
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
                <th className="py-4 px-4 text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                  Metric
                </th>
                <th className="py-4 px-4 text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                  Source
                </th>
                <th className="py-4 px-4 text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                  Why it Matters
                </th>
                <th className="py-4 px-4 text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
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
                    <div className="flex items-center gap-2">
                      <Star size={12} className="text-yellow-400" />
                      <span className="font-bold text-neutral-800 dark:text-neutral-100 text-sm">
                        {item.metric}
                      </span>
                    </div>
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
                  <td className="py-5 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-400 dark:text-neutral-500 group-hover:text-primary-green transition-colors">
                      <RefreshCw size={12} />
                      {item.frequency}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 pt-6 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary-green">
            <ShieldCheck size={18} />
            <span className="text-xs font-bold uppercase tracking-widest">
              Verified Multi-source integration
            </span>
          </div>
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
