"use client";

import { Info } from "lucide-react";
import { useBarangay } from "@/context/BarangayContext";
import { useGeoData } from "@/context/geoDataStore";
import { Stat } from "./SimulationSharedComponents";
import {
  readFeatureName,
  geometryRings,
  featureBounds,
  ringPath,
} from "../lib/simulation-input-utils";
import type { SimulationBaselineData } from "../simulation-types";
import type { Feature, Geometry } from "geojson";

// ── BarangayDetailMap ─────────────────────────────────────────────────────

export function BarangayDetailMap() {
  const { simulationBarangay } = useBarangay();
  const geoData = useGeoData((state) => state.geoData);

  if (!simulationBarangay || !geoData) {
    return (
      <div className="flex h-48 w-full items-center justify-center rounded-xl border border-gray-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-sm text-neutral-500">
        Select a barangay first.
      </div>
    );
  }

  const targetName = simulationBarangay.name.toLowerCase();
  const feature = geoData.features.find(
    (f: Feature<Geometry | null>) => readFeatureName(f).toLowerCase() === targetName,
  ) as Feature<Geometry | null> | undefined;
  const rings = geometryRings(feature?.geometry);
  const bounds = featureBounds(rings);

  if (!feature || !bounds) {
    return (
      <div className="flex h-48 w-full items-center justify-center rounded-xl border border-gray-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-4 text-center text-sm text-neutral-500">
        Selected barangay geometry not found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-white dark:bg-neutral-900 shadow-sm">
      <div className="flex items-center justify-between border-b border-emerald-100 dark:border-emerald-500/20 px-3 py-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-neutral-100">
            {simulationBarangay.name}
          </h3>
          <p className="text-[11px] text-gray-500 dark:text-neutral-400">
            Barangay boundary preview
          </p>
        </div>
        <span className="rounded-full bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
          inline
        </span>
      </div>
      <svg
        viewBox="0 0 300 180"
        role="img"
        aria-label={`${simulationBarangay.name} boundary preview`}
        className="h-48 w-full bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/5"
      >
        <defs>
          <pattern id="simulation-map-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path
              d="M 24 0 L 0 0 0 24"
              fill="none"
              stroke="rgba(16, 185, 129, 0.12)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="300" height="180" fill="url(#simulation-map-grid)" />
        {rings.map((ring, index) => (
          <path
            key={index}
            d={ringPath(ring, bounds)}
            fill="rgba(16, 185, 129, 0.45)"
            stroke="#047857"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  );
}

// ── BaselineCard ──────────────────────────────────────────────────────────

export function BaselineCard({ baseline }: { baseline: SimulationBaselineData }) {
  return (
    <div className="border border-gray-200 dark:border-neutral-800 rounded-xl p-4 bg-emerald-50/60 dark:bg-emerald-500/5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 dark:text-neutral-100">
          Current baseline
        </h3>
        <Info className="w-4 h-4 text-gray-400 dark:text-neutral-500" />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Stat label="NDVI" value={baseline.ndvi.toFixed(3)} />
        <Stat label="LST" value={`${baseline.lst.toFixed(1)}°C`} />
        <Stat label="Canopy" value={`${baseline.canopyCover}`} />
        <Stat
          label="Greenery Index"
          value={baseline.greeneryIndex.toFixed(3)}
        />
        <Stat label="Flood" value={baseline.floodExposure} />
        <Stat
          label="Area"
          value={`${(baseline.areaHectares ?? 0).toFixed(1)} ha`}
        />
      </div>
      <div className="mt-3 text-xs text-gray-600 dark:text-neutral-400 border-t border-emerald-200/60 dark:border-emerald-500/20 pt-2">
        Current strategy:{" "}
        <strong className="text-gray-800 dark:text-neutral-100">
          {baseline.currentIntervention}
        </strong>
      </div>
    </div>
  );
}
