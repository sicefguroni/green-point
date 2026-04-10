"use client";

import { useState, useMemo } from "react";
import { Download, Filter, ArrowUpDown, SlidersHorizontal } from "lucide-react";
import { getGreeneryTextColor } from "@/lib/chloroplet-colors";
import SimulationModal from "../simulation/Simulation";

import { useBarangay } from "@/context/BarangayContext";
import { useGeoData } from "@/context/geoDataStore";
// Sample data - expanded dataset
// Data is now fetched dynamically from useGeoData context

type TableRow = {
  id: number;
  barangay: string;
  equity: number;
  cost: number;
  impact: number;
  status: "Excellent" | "Good" | "Fair" | "Poor";
  recommendedIntervention: string;
  source: string;
};

export default function InterventionAnalysisTable() {
  const [equityRange, setEquityRange] = useState([0, 1]);
  const [costRange, setCostRange] = useState([0, 1]);
  const [sortColumn, setSortColumn] = useState("equity");
  const [sortDirection, setSortDirection] = useState("desc");
  const [isSimulationOpen, setIsSimulationOpen] = useState(false);

  const { setSimulationBarangay } = useBarangay();
  const geoData = useGeoData((state) => state.geoData);

  function selectByName(name: string) {
    if (!geoData) return;

    const feature = geoData.features.find(
      (f: GeoJSON.Feature) =>
        f.properties?.name?.toLowerCase() === name.toLowerCase(),
    );
    if (!feature) return console.warn("Barangay not found:", name);

    setSimulationBarangay({
      name: feature.properties?.name ?? name,
      greeneryIndex: feature.properties?.greenery_index ?? 0,
      ndvi: feature.properties?.ndvi ?? 0,
      lst: feature.properties?.lst ?? 0,
      treeCanopy: feature.properties?.tree_canopy ?? 0,
      floodExposure: feature.properties?.flood_exposure ?? "unknown",
      currentIntervention: feature.properties?.current_intervention ?? "None",
    });
  }
  // Transform GeoJSON features into table rows
  const tableData = useMemo(() => {
    if (!geoData) return [];
    return geoData.features.map((f: GeoJSON.Feature, idx: number): TableRow => {
      const p = f.properties;
      if (!p || typeof p !== "object") {
        return {
          id: idx,
          barangay: `Barangay ${idx}`,
          equity: 0.5,
          cost: 0.5,
          impact: 0.25,
          status: "Fair",
          recommendedIntervention: "Urban canopy enhancement",
          source: "ESA / NASA / NOAH",
        };
      }
      const props = p as Record<string, unknown>;
      const greeneryIndex = typeof props.greenery_index === "number" ? props.greenery_index : 0.5;
      const ndvi = typeof props.ndvi === "number" ? props.ndvi : 0.5;
      const treeCanopy = typeof props.tree_canopy === "number" ? props.tree_canopy : 0.5;
      const areaKm2 = typeof props.area_km2 === "number" ? props.area_km2 : 1;
      const equity = greeneryIndex;
      const impact = ndvi * treeCanopy;
      // Realistic cost estimation based on area and current GI
      const cost = 1 - (equity * 0.4 + areaKm2 * 0.2);

      return {
        id: idx,
        barangay: typeof props.name === "string" ? props.name : `Barangay ${idx}`,
        equity,
        cost,
        impact,
        status:
          equity > 0.8
            ? "Excellent"
            : equity > 0.6
              ? "Good"
              : equity > 0.4
                ? "Fair"
                : "Poor",
        recommendedIntervention:
          typeof props.current_intervention === "string"
            ? props.current_intervention
            : "Urban canopy enhancement",
        source: "ESA / NASA / NOAH",
      };
    });
  }, [geoData]);

  // Filter and sort data based on slider ranges
  const filteredData = useMemo(() => {
    const filtered = tableData.filter((row) => {
      const equityMatch =
        row.equity >= equityRange[0] && row.equity <= equityRange[1];
      const costMatch = row.cost >= costRange[0] && row.cost <= costRange[1];
      return equityMatch && costMatch;
    });

    // Sort data
    filtered.sort((a: TableRow, b: TableRow) => {
      const aVal = a[sortColumn as keyof TableRow];
      const bVal = b[sortColumn as keyof TableRow];
      if (typeof aVal !== "number" || typeof bVal !== "number") return 0;
      return sortDirection === "asc"
        ? aVal - bVal
        : bVal - aVal;
    });

    return filtered;
  }, [tableData, equityRange, costRange, sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const getStatusColor = (status: "Excellent" | "Good" | "Fair" | "Poor") => {
    const colors = {
      Excellent: "bg-green-100 text-green-700 border-green-200",
      Good: "bg-emerald-100 text-emerald-700 border-emerald-200",
      Fair: "bg-yellow-100 text-yellow-700 border-yellow-200",
      Poor: "bg-red-100 text-red-700 border-red-200",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  const resetFilters = () => {
    setEquityRange([0, 1]);
    setCostRange([0, 1]);
    setSortColumn("equity");
    setSortDirection("desc");
  };

  return (
    <div className="space-y-4">
      {/* Table Card */}
      <div className="h-[480px] bg-white dark:bg-neutral-900 rounded-xl shadow-sm shadow-black/5 dark:shadow-black/20 border border-gray-200 dark:border-neutral-800 overflow-hidden">
        {/* Table Header with Results Count */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-neutral-100">
                Barangay Cost-Effectiveness Intervention Analysis
              </h3>
              <p className="text-sm text-gray-500 dark:text-neutral-400 mt-0.5">
                Showing {filteredData.length} of {tableData.length} barangays
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-300 uppercase tracking-widest bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded border border-neutral-200 dark:border-neutral-700">
                Source: ESA / NASA / NOAH
              </span>
              <button className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-neutral-200 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-50 dark:bg-neutral-950 border-b border-gray-200 dark:border-neutral-800 z-10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-wider">
                    Barangay
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                    onClick={() => handleSort("equity")}
                  >
                    <div className="flex items-center gap-1">
                      equity Index
                      <ArrowUpDown
                        className={`w-3 h-3 ${sortColumn === "equity" ? "text-green-600" : ""}`}
                      />
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                    onClick={() => handleSort("cost")}
                  >
                    <div className="flex items-center gap-1">
                      cost
                      <ArrowUpDown
                        className={`w-3 h-3 ${sortColumn === "cost" ? "text-emerald-600" : ""}`}
                      />
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                    onClick={() => handleSort("impact")}
                  >
                    <div className="flex items-center gap-1">
                      Impact
                      <ArrowUpDown
                        className={`w-3 h-3 ${sortColumn === "impact" ? "text-green-600" : ""}`}
                      />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-wider">
                    Recommended Intervention
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
                {filteredData.length > 0 ? (
                  filteredData.map((row, index) => (
                    <tr
                      key={row.id}
                      className={`${index % 2 === 0 ? "bg-white dark:bg-neutral-900" : "bg-gray-50 dark:bg-neutral-950"} hover:bg-blue-50 dark:hover:bg-neutral-800 transition-colors`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900 dark:text-neutral-100">
                          {row.barangay}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div
                          className={`text-sm font-semibold ${getGreeneryTextColor(row.equity)}`}
                        >
                          {row.equity.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div
                          className={`text-sm font-semibold ${getGreeneryTextColor(row.cost)}`}
                        >
                          {row.cost.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-neutral-black dark:text-neutral-200">
                        {row.impact.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusColor(row.status as "Excellent" | "Good" | "Fair" | "Poor")}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium">
                        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                          {row.recommendedIntervention}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          className=" hover:bg-primary-green/90 transition-colors duration-200 bg-primary-green text-white text-sm px-3 py-1 rounded-md cursor-pointer"
                          onClick={() => {
                            selectByName(row.barangay);
                            setIsSimulationOpen(true);
                          }}
                        >
                          Simulate
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="text-gray-400 dark:text-neutral-500">
                        <Filter className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-lg font-medium text-gray-600 dark:text-neutral-300">
                          No barangays match your filters
                        </p>
                        <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
                          Try adjusting the range sliders above
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Filter Controls Card */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm shadow-black/5 dark:shadow-black/20 border border-gray-200 dark:border-neutral-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-gray-600 dark:text-neutral-400" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-neutral-100">
              Weighting Scenario by Equity and Cost
            </h3>
          </div>
          <button
            className="text-sm text-neutral-black dark:text-neutral-200 hover:text-neutral-black/80 dark:hover:text-white font-medium transition-colors"
            onClick={resetFilters}
          >
            Reset Filters
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* equity Index Range Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-neutral-300">
                Equity Index
              </label>
              <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                {equityRange[0].toFixed(2)} - {equityRange[1].toFixed(2)}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 dark:text-neutral-500 mb-1 block">
                    Min
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={equityRange[0]}
                    onChange={(e) =>
                      setEquityRange([
                        parseFloat(e.target.value),
                        equityRange[1],
                      ])
                    }
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 dark:text-neutral-500 mb-1 block">
                    Max
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={equityRange[1]}
                    onChange={(e) =>
                      setEquityRange([
                        equityRange[0],
                        parseFloat(e.target.value),
                      ])
                    }
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500"
                  />
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-400 dark:text-neutral-500">
                <span>0.00</span>
                <span>1.00</span>
              </div>
            </div>
          </div>

          {/* cost Range Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-neutral-300">Cost</label>
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {costRange[0].toFixed(2)} - {costRange[1].toFixed(2)}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 dark:text-neutral-500 mb-1 block">
                    Min
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={costRange[0]}
                    onChange={(e) =>
                      setCostRange([parseFloat(e.target.value), costRange[1]])
                    }
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 dark:text-neutral-500 mb-1 block">
                    Max
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={costRange[1]}
                    onChange={(e) =>
                      setCostRange([costRange[0], parseFloat(e.target.value)])
                    }
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-400 dark:text-neutral-500">
                <span>0.00</span>
                <span>1.00</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isSimulationOpen && (
        <SimulationModal
          isOpen={isSimulationOpen}
          setIsOpen={setIsSimulationOpen}
        />
      )}
    </div>
  );
}
