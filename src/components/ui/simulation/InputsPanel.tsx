import { useState } from "react";
import { ChevronDown, ChevronUp, RotateCcw, Info } from 'lucide-react';
import BarangayDetailMap from "./BarangayDetailsMap";

const SimulationInputs = ({ inputs, onInputChange, onReset, baselineData }) => {
  const [expandedGroups, setExpandedGroups] = useState({
    climate: true,
    greening: true,
    budget: true,
    time: true
  });

  const toggleGroup = (group) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Input Controls */}
      <div className="lg:col-span-2 space-y-4">
        {/* Climate Change Factors */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleGroup('climate')}
            className="w-full bg-gray-50 hover:bg-gray-100 px-4 py-3 flex items-center justify-between transition-colors"
          >
            <span className="font-semibold text-gray-800">Climate Change Factors</span>
            {expandedGroups.climate ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          {expandedGroups.climate && (
            <div className="p-4 space-y-4 bg-white">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Temperature Increase Rate (°C/year): {inputs.temperature_increase_rate.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0.01"
                  max="0.1"
                  step="0.01"
                  value={inputs.temperature_increase_rate}
                  onChange={(e) => onInputChange('temperature_increase_rate', parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Flooding Severity</label>
                <select
                  value={inputs.flooding_severity}
                  onChange={(e) => onInputChange('flooding_severity', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rainfall Change Rate (%/year): {inputs.rainfall_change_rate}
                </label>
                <input
                  type="range"
                  min="-20"
                  max="30"
                  step="1"
                  value={inputs.rainfall_change_rate}
                  onChange={(e) => onInputChange('rainfall_change_rate', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* Greening Strategy */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleGroup('greening')}
            className="w-full bg-gray-50 hover:bg-gray-100 px-4 py-3 flex items-center justify-between transition-colors"
          >
            <span className="font-semibold text-gray-800">Greening Strategy</span>
            {expandedGroups.greening ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          {expandedGroups.greening && (
            <div className="p-4 space-y-4 bg-white">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Canopy Target (% increase): {inputs.canopy_target_percent}
                </label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="1"
                  value={inputs.canopy_target_percent}
                  onChange={(e) => onInputChange('canopy_target_percent', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  NDVI Target Gain: {inputs.ndvi_target.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0.05"
                  max="0.4"
                  step="0.01"
                  value={inputs.ndvi_target}
                  onChange={(e) => onInputChange('ndvi_target', parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Intervention Type</label>
                <select
                  value={inputs.intervention_type}
                  onChange={(e) => onInputChange('intervention_type', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="urban canopy">Urban Canopy</option>
                  <option value="green corridor">Green Corridor</option>
                  <option value="rain garden">Rain Garden</option>
                  <option value="mixed strategy">Mixed Strategy</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Budget Scenario */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleGroup('budget')}
            className="w-full bg-gray-50 hover:bg-gray-100 px-4 py-3 flex items-center justify-between transition-colors"
          >
            <span className="font-semibold text-gray-800">Budget Scenario</span>
            {expandedGroups.budget ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          {expandedGroups.budget && (
            <div className="p-4 space-y-4 bg-white">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Total Budget Cap (PHP)</label>
                <input
                  type="number"
                  value={inputs.total_budget_cap}
                  onChange={(e) => onInputChange('total_budget_cap', parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  step="100000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cost per sqm (PHP)</label>
                <input
                  type="number"
                  value={inputs.cost_per_sqm}
                  onChange={(e) => onInputChange('cost_per_sqm', parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  step="50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maintenance Cost Rate (%/year): {inputs.maintenance_cost_rate}
                </label>
                <input
                  type="range"
                  min="5"
                  max="20"
                  step="1"
                  value={inputs.maintenance_cost_rate}
                  onChange={(e) => onInputChange('maintenance_cost_rate', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* Time Horizon */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleGroup('time')}
            className="w-full bg-gray-50 hover:bg-gray-100 px-4 py-3 flex items-center justify-between transition-colors"
          >
            <span className="font-semibold text-gray-800">Time Horizon</span>
            {expandedGroups.time ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          {expandedGroups.time && (
            <div className="p-4 bg-white">
              <label className="block text-sm font-medium text-gray-700 mb-2">Projection Period</label>
              <select
                value={inputs.time_horizon}
                onChange={(e) => onInputChange('time_horizon', parseInt(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="1">1 Year</option>
                <option value="3">3 Years</option>
                <option value="5">5 Years</option>
                <option value="10">10 Years</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Right: Baseline Snapshot */}
      <div className="flex flex-col gap-4 lg:col-span-1">
        <BarangayDetailMap />
        <div className="border border-gray-200 rounded-lg p-4 bg-gradient-to-br from-blue-50 to-indigo-50 sticky top-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Current Baseline</h3>
            <Info className="w-5 h-5 text-gray-500" />
          </div>
          <div className="space-y-3">
            <div className="bg-white rounded-lg p-3">
              <div className="text-sm text-gray-600">NDVI</div>
              <div className="text-xl font-bold text-gray-800">{baselineData.ndvi}</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-sm text-gray-600">LST</div>
              <div className="text-xl font-bold text-gray-800">{baselineData.lst}°C</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-sm text-gray-600">Flood Exposure</div>
              <div className="text-xl font-bold text-gray-800">{baselineData.floodExposure}</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-sm text-gray-600">Greenery Index</div>
              <div className="text-xl font-bold text-gray-800">{baselineData.greeneryIndex}</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-sm text-gray-600">Canopy Cover</div>
              <div className="text-xl font-bold text-gray-800">{baselineData.canopyCover}</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-sm text-gray-600 mb-1">Current Strategy</div>
              <div className="text-sm font-medium text-gray-800">{baselineData.currentIntervention}</div>
            </div>
          </div>
          <button
            onClick={onReset}
            className="w-full mt-4 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Baseline
          </button>
        </div>
      </div>
    </div>
  );
};

export default SimulationInputs;