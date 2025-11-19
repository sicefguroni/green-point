"use client";

import { useState, useMemo } from 'react';
import { Download, Filter, ArrowUpDown, SlidersHorizontal } from 'lucide-react';
import { getGreeneryTextColor } from '@/lib/chloroplet-colors';
import SimulationModal from '../simulation/Simulation';

import { useBarangay } from '@/context/BarangayContext';
import { useGeoData } from '@/context/geoDataStore';
// Sample data - expanded dataset
const sampleData = [
  { 
    id: 1, 
    barangay: 'Subangdaku', 
    equity: 0.84, 
    cost: 0.42, 
    impact: 0.63, 
    status: 'Good',
    recommendedIntervention: 'Green corridor development'
  },
  { 
    id: 2, 
    barangay: 'Banilad', 
    equity: 0.56, 
    cost: 0.51, 
    impact: 0.53, 
    status: 'Fair',
    recommendedIntervention: 'Rain garden installation'
  },
  { 
    id: 3, 
    barangay: 'Looc', 
    equity: 0.38, 
    cost: 0.77, 
    impact: 0.66, 
    status: 'Good',
    recommendedIntervention: 'Urban canopy enhancement'
  },
  { 
    id: 4, 
    barangay: 'Casuntingan', 
    equity: 0.49, 
    cost: 0.58, 
    impact: 0.54, 
    status: 'Fair',
    recommendedIntervention: 'Rain garden installation'
  },
  { 
    id: 5, 
    barangay: 'Pakna-an', 
    equity: 0.71, 
    cost: 0.69, 
    impact: 0.74, 
    status: 'Excellent',
    recommendedIntervention: 'Green corridor development'
  },
  { 
    id: 6, 
    barangay: 'Ibabao Estancia', 
    equity: 0.91, 
    cost: 0.33, 
    impact: 0.61, 
    status: 'Good',
    recommendedIntervention: 'Urban canopy enhancement'
  },
];

export default function InterventionAnalysisTable() {
  const [equityRange, setEquityRange] = useState([0, 1]);
  const [costRange, setCostRange] = useState([0, 1]);
  const [sortColumn, setSortColumn] = useState('equity');
  const [sortDirection, setSortDirection] = useState('desc');
  const [isSimulationOpen, setIsSimulationOpen] = useState(false);

  const { setSimulationBarangay } = useBarangay();
  const geoData = useGeoData((state) => state.geoData);

  function selectByName(name: string) {
    if (!geoData) return;

    const feature = geoData.features.find(
      (f: GeoJSON.Feature) => f.properties?.name?.toLowerCase() === name.toLowerCase()
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
  // Filter and sort data based on slider ranges
  const filteredData = useMemo(() => {
    const filtered = sampleData.filter(row => {
      const equityMatch = row.equity >= equityRange[0] && row.equity <= equityRange[1];
      const costMatch = row.cost >= costRange[0] && row.cost <= costRange[1];
      return equityMatch && costMatch;
    });

    // Sort data
    filtered.sort((a, b) => {
      const aVal = a[sortColumn as keyof typeof a];
      const bVal = b[sortColumn as keyof typeof b];
      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return filtered;
  }, [equityRange, costRange, sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getStatusColor = (status: 'Excellent' | 'Good' | 'Fair' | 'Poor') => {
    const colors = {
      'Excellent': 'bg-green-100 text-green-700 border-green-200',
      'Good': 'bg-emerald-100 text-emerald-700 border-emerald-200',
      'Fair': 'bg-yellow-100 text-yellow-700 border-yellow-200',
      'Poor': 'bg-red-100 text-red-700 border-red-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const resetFilters = () => {
    setEquityRange([0, 1]);
    setCostRange([0, 1]);
    setSortColumn('equity');
    setSortDirection('desc');
  };

  return (
    <div className="space-y-4">
      {/* Table Card */}
      <div className="h-[480px] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Table Header with Results Count */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Barangay Cost-Effectiveness Intervention Analysis</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Showing {filteredData.length} of {sampleData.length} barangays
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
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
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Barangay
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('equity')}
                >
                  <div className="flex items-center gap-1">
                    equity Index
                    <ArrowUpDown className={`w-3 h-3 ${sortColumn === 'equity' ? 'text-green-600' : ''}`} />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('cost')}
                >
                  <div className="flex items-center gap-1">
                    cost
                    <ArrowUpDown className={`w-3 h-3 ${sortColumn === 'cost' ? 'text-emerald-600' : ''}`} />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('impact')}
                >
                  <div className="flex items-center gap-1">
                    Impact
                    <ArrowUpDown className={`w-3 h-3 ${sortColumn === 'impact' ? 'text-green-600' : ''}`} />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Recommended Intervention
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredData.length > 0 ? (
                  filteredData.map((row, index) => (
                    <tr key={row.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{row.barangay}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-semibold ${getGreeneryTextColor(row.equity)}`}>{row.equity.toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-semibold ${getGreeneryTextColor(row.cost)}`}>{row.cost.toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-neutral-black">
                      {row.impact.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusColor(row.status as 'Excellent' | 'Good' | 'Fair' | 'Poor')}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">
                      <p className="text-sm font-medium">{row.recommendedIntervention}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button className=" hover:bg-primary-green/90 transition-colors duration-200 bg-primary-green text-white text-sm px-3 py-1 rounded-md cursor-pointer" onClick={() => {
                        selectByName(row.barangay);
                        setIsSimulationOpen(true);
                      }}>
                        Simulate
                      </button>
                    </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="text-gray-400">
                        <Filter className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-lg font-medium text-gray-600">No barangays match your filters</p>
                        <p className="text-sm text-gray-500 mt-1">Try adjusting the range sliders above</p>
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-800">Weighting Scenario by Equity and Cost</h3>
          </div>
          <button 
            className="text-sm text-neutral-black hover:text-neutral-black/80 font-medium transition-colors"
            onClick={resetFilters}
          >
            Reset Filters
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* equity Index Range Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Equity Index</label>
              <span className="text-sm font-semibold text-green-600">
                {equityRange[0].toFixed(2)} - {equityRange[1].toFixed(2)}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Min</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={equityRange[0]}
                    onChange={(e) => setEquityRange([parseFloat(e.target.value), equityRange[1]])}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Max</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={equityRange[1]}
                    onChange={(e) => setEquityRange([equityRange[0], parseFloat(e.target.value)])}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500"
                  />
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>0.00</span>
                <span>1.00</span>
              </div>
            </div>
          </div>

          {/* cost Range Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Cost</label>
              <span className="text-sm font-semibold text-emerald-600">
                {costRange[0].toFixed(2)} - {costRange[1].toFixed(2)}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Min</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={costRange[0]}
                    onChange={(e) => setCostRange([parseFloat(e.target.value), costRange[1]])}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Max</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={costRange[1]}
                    onChange={(e) => setCostRange([costRange[0], parseFloat(e.target.value)])}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>0.00</span>
                <span>1.00</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      { isSimulationOpen && (
        <SimulationModal isOpen={isSimulationOpen} setIsOpen={setIsSimulationOpen} />
      )}
    </div>
  );
}