import { useState } from "react";
import { ChevronDown, ChevronUp, RotateCcw, Info } from 'lucide-react';
import BarangayDetailMap from "./BarangayDetailsMap";

type SimulationInputsType = {
  temperature_increase_rate: number;
  flooding_severity: string;
  rainfall_change_rate: number;
  canopy_target_percent: number;
  ndvi_target: number;
  intervention_type: string;
  total_budget_cap: number;
  cost_per_sqm: number;
  maintenance_cost_rate: number;
  time_horizon: number;
};

type BaselineDataType = {
  ndvi: number;
  lst: number;
  floodExposure: string;
  greeneryIndex: number;
  canopyCover: number;
  currentIntervention: string;
};

interface SimulationInputsProps {
  inputs: SimulationInputsType;
  onInputChange: (key: string, value: string | number) => void;
  onReset: () => void;
  baselineData: BaselineDataType;
}

const SimulationInputs = ({ inputs, onInputChange, onReset, baselineData }: SimulationInputsProps) => {
  const [expandedGroups, setExpandedGroups] = useState({
    climate: true,
    greening: true,
    budget: true,
    time: true
  });

  const toggleGroup = (group: keyof typeof expandedGroups) => {
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
            className="w-full bg-primary-green/15 hover:bg-primary-green/10 px-4 py-3 flex items-center justify-between transition-colors"
          >
            <span className="font-semibold text-gray-800">Climate Change Factors</span>
            {expandedGroups.climate ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          <div
            className={`overflow-hidden transition-all duration-300 ease-out ${
              expandedGroups.climate ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="p-4 space-y-4 bg-white">
              <div>
                <p className="text-sm text-gray-700">
                  These settings help you imagine future climate conditions in this barangay. Adjust them to see how rising heat, flooding, or rainfall could impact greening solutions over time.
                </p>
                <hr className="my-4 border-gray-200" />
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Temperature Increase Rate (°C/year): {inputs.temperature_increase_rate.toFixed(2)}
                </label>
                <p className="text-sm text-gray-500 mb-2">Estimated yearly rise in temperature.</p>
                <input
                  type="range"
                  min="0.01"
                  max="0.1"
                  step="0.01"
                  value={inputs.temperature_increase_rate}
                  onChange={(e) => onInputChange('temperature_increase_rate', parseFloat(e.target.value))}
                  className="w-full"
                  style={{ accentColor: '#0f9d58' }}   // pick any brand color
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Flooding Severity</label>
                <p className="text-sm text-gray-500 mb-2">Predicted flood risk level.</p>
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
                <p className="text-sm text-gray-500 mb-2">Expected % change in rainfall per year.</p>
                <input
                  type="range"
                  min="-20"
                  max="30"
                  step="1"
                  value={inputs.rainfall_change_rate}
                  onChange={(e) => onInputChange('rainfall_change_rate', parseInt(e.target.value))}
                  className="w-full"
                  style={{ accentColor: '#0f9d58' }} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Greening Strategy */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleGroup('greening')}
            className="w-full bg-primary-green/15 hover:bg-primary-green/10 px-4 py-3 flex items-center justify-between transition-colors"
          >
            <span className="font-semibold text-gray-800">Greening Strategy</span>
            {expandedGroups.greening ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          <div
            className={`overflow-hidden transition-all duration-300 ease-out ${
              expandedGroups.greening ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="p-4 space-y-4 bg-white">
              <div>
                <p className="text-sm text-gray-700">
                  This section defines the greening strategy. Choose what kind of green intervention you want and how much improvement you aim to achieve.                
                </p>
                <hr className="my-4 border-gray-200" />
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Canopy Target (% increase): {inputs.canopy_target_percent}
                </label>
                <p className="text-sm text-gray-500 mb-2">Target % increase in tree cover.</p>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="1"
                  value={inputs.canopy_target_percent}
                  onChange={(e) => onInputChange('canopy_target_percent', parseInt(e.target.value))}
                  className="w-full"
                  style={{ accentColor: '#0f9d58' }} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  NDVI Target Gain: {inputs.ndvi_target.toFixed(2)}
                </label>
                <p className="text-sm text-gray-500 mb-2">Desired gain in vegetation health (NDVI).</p>
                <input
                  type="range"
                  min="0.05"
                  max="0.4"
                  step="0.01"
                  value={inputs.ndvi_target}
                  onChange={(e) => onInputChange('ndvi_target', parseFloat(e.target.value))}
                  className="w-full"
                  style={{ accentColor: '#0f9d58' }} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Intervention Type</label>
                <p className="text-sm text-gray-500 mb-2">Choose the type of greening solution.</p>
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
          </div>
        </div>

        {/* Budget Scenario */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleGroup('budget')}
            className="w-full bg-primary-green/15 hover:bg-primary-green/10 px-4 py-3 flex items-center justify-between transition-colors"
          >
            <span className="font-semibold text-gray-800">Budget Scenario</span>
            {expandedGroups.budget ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          <div
            className={`overflow-hidden transition-all duration-300 ease-out ${
              expandedGroups.budget ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="p-4 space-y-4 bg-white">
              <div>
              <p className="text-sm text-gray-700">
              Here you can estimate how much the intervention will cost, not just to implement, but also to maintain over time.                </p>
                <hr className="my-4 border-gray-200" />
                <label className="block text-sm font-medium text-gray-700 mb-2">Total Budget Cap (PHP)</label>
                <p className="text-sm text-gray-500 mb-2">Maximum available project budget.</p>
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
                <p className="text-sm text-gray-500 mb-2">Cost to green each square meter.</p>
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
                <p className="text-sm text-gray-500 my-2">Annual maintenance cost (%).</p>
                </label>
                <input
                  type="range"
                  min="5"
                  max="20"
                  step="1"
                  value={inputs.maintenance_cost_rate}
                  onChange={(e) => onInputChange('maintenance_cost_rate', parseInt(e.target.value))}
                  className="w-full"
                  style={{ accentColor: '#0f9d58' }} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Time Horizon */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleGroup('time')}
            className="w-full bg-primary-green/15 hover:bg-primary-green/10 px-4 py-3 flex items-center justify-between transition-colors"
          >
            <span className="font-semibold text-gray-800">Time Horizon</span>
            {expandedGroups.time ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          <div
            className={`overflow-hidden transition-all duration-300 ease-out ${
              expandedGroups.time ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="p-4 bg-white">
              <p className="text-sm text-gray-700">
              Select how many years you want to simulate. Longer timelines help reveal whether the results are short-term or truly sustainable.                </p>
                <hr className="my-4 border-gray-200" />
              <label className="block text-sm font-medium text-gray-700 mb-2">Projection Period</label>
              <p className="text-sm text-gray-500 mb-2">Number of years to run the simulation.</p>
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
          </div>
        </div>
      </div>

      {/* Right: Baseline Snapshot */}
      <div className="flex flex-col gap-4 lg:col-span-1">
        <BarangayDetailMap />
        <div className="border border-gray-200 rounded-lg p-4 bg-primary-green/15 sticky top-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Current Baseline</h3>
            <Info className="w-5 h-5 text-gray-500" />
          </div>
          <div className="space-y-3">
            <div className="bg-white rounded-lg p-3">
              <div className="text-sm text-gray-600">NDVI</div>
              <div className="text-xl font-bold text-gray-800 text-center">{baselineData.ndvi}</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-sm text-gray-600">LST</div>
              <div className="text-xl font-bold text-gray-800 text-center">{baselineData.lst}°C</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-sm text-gray-600">Flood Exposure</div>
              <div className="text-xl font-bold text-gray-800 text-center">{baselineData.floodExposure}</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-sm text-gray-600">Greenery Index</div>
              <div className="text-xl font-bold text-gray-800 text-center">{baselineData.greeneryIndex}</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-sm text-gray-600">Canopy Cover</div>
              <div className="text-xl font-bold text-gray-800 text-center">{baselineData.canopyCover}</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-sm text-gray-600 mb-1">Current Strategy</div>
              <div className="text-sm font-medium text-gray-800 text-center">{baselineData.currentIntervention}</div>
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