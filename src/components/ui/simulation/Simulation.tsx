import { useState } from 'react';
import { ArrowLeft, Download, GitCompare, X, Play } from 'lucide-react';
import SimulationInputs from './InputsPanel';
import SimulationResults from './ResultsPanel';
import { useBarangay } from '@/context/BarangayContext';
import SimulationLoading from './Loading';

const SimulationModal = ( { isOpen, setIsOpen }: { isOpen: boolean, setIsOpen: (isOpen: boolean) => void } ) => {
  const [stage, setStage] = useState('setup');
  const { simulationBarangay } = useBarangay();
  const [loadingProgress, setLoadingProgress] = useState(0);

  const baselineData = {
    ndvi: simulationBarangay?.ndvi ?? 0.42,
    lst: simulationBarangay?.lst ?? 32.5,
    floodExposure: simulationBarangay?.floodExposure ?? 'Medium',
    greeneryIndex: simulationBarangay?.greeneryIndex ?? 0.58,
    canopyCover: simulationBarangay?.treeCanopy ?? 28,
    currentIntervention: simulationBarangay?.currentIntervention ?? 'Urban Canopy Enhancement'
  };

  const [inputs, setInputs] = useState({
    temperature_increase_rate: 0.03,
    flooding_severity: 'medium',
    rainfall_change_rate: 5,
    canopy_target_percent: 15,
    ndvi_target: 0.15,
    intervention_type: 'mixed strategy',
    total_budget_cap: 5000000,
    cost_per_sqm: 850,
    maintenance_cost_rate: 8,
    time_horizon: 5
  });

  const [results, setResults] = useState(null);

  const closeModal = () => {
    setIsOpen(false);
    setStage('setup');
  };

  const handleInputChange = <K extends keyof typeof inputs>(key: K, value: typeof inputs[K]) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  };

  const resetInputs = () => {
    setInputs({
      temperature_increase_rate: 0.03,
      flooding_severity: 'medium',
      rainfall_change_rate: 5,
      canopy_target_percent: 15,
      ndvi_target: 0.15,
      intervention_type: 'mixed strategy',
      total_budget_cap: 5000000,
      cost_per_sqm: 850,
      maintenance_cost_rate: 8,
      time_horizon: 5
    });
  };

  const runSimulation = () => {
    // Start loading state
    setStage('loading');
    setLoadingProgress(0);

    // Simulate progressive loading
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        // Non-linear progress for more realistic feel
        const increment = prev < 30 ? 5 : prev < 70 ? 3 : 2;
        return Math.min(prev + increment, 100);
      });
    }, 200);

    // Calculate results after loading animation
    setTimeout(() => {
      const timeSteps = inputs.time_horizon;
      const canopyGain = inputs.canopy_target_percent * 0.85;
      const ndviGain = inputs.ndvi_target * 0.9;
      
      const cooling = canopyGain * 0.12 + ndviGain * 2.5;
      const stormwater = canopyGain * 12 + (inputs.intervention_type === 'rain garden' ? 50 : 0);
      const pm25 = canopyGain * 0.8 + ndviGain * 15;
      const no2 = canopyGain * 0.4 + ndviGain * 8;

      const giEvolution = [];
      for (let i = 0; i <= timeSteps; i++) {
        const progress = i / timeSteps;
        const quantityScore = baselineData.ndvi + (ndviGain * progress);
        const envQualityScore = 0.62 + (0.18 * progress) - (inputs.temperature_increase_rate * i * 0.5);
        const giScore = (quantityScore * 0.6 + envQualityScore * 0.4);
        
        giEvolution.push({
          year: i,
          gi_score: parseFloat(giScore.toFixed(3)),
          quantity_score: parseFloat(quantityScore.toFixed(3)),
          environmental_quality_score: parseFloat(envQualityScore.toFixed(3))
        });
      }

      const finalGI = giEvolution[giEvolution.length - 1].gi_score;
      let giLevel = 'Low';
      if (finalGI >= 0.75) giLevel = 'Excellent';
      else if (finalGI >= 0.60) giLevel = 'High';
      else if (finalGI >= 0.40) giLevel = 'Medium';

      let recommendation = 'Mixed Strategy with Urban Canopy Focus';
      let priority = 'Moderate';
      let rationale = 'Balanced approach addressing both immediate cooling needs and long-term resilience.';

      if (inputs.flooding_severity === 'high' && inputs.rainfall_change_rate > 10) {
        recommendation = 'Rain Garden Network with Green Corridors';
        priority = 'High';
        rationale = 'High flood risk requires prioritized stormwater management infrastructure combined with green corridors for water flow management.';
      } else if (cooling > 3 && inputs.total_budget_cap > 4000000) {
        recommendation = 'Intensive Urban Canopy Enhancement';
        priority = 'High';
        rationale = 'Strong cooling potential with adequate budget justifies focused canopy expansion to maximize temperature reduction benefits.';
      } else if (inputs.total_budget_cap < 3000000) {
        recommendation = 'Phased Green Corridor Development';
        priority = 'Moderate';
        rationale = 'Budget constraints suggest phased implementation focusing on cost-effective green corridors that provide multiple benefits.';
      }

      setResults({
        environmental: {
          cooling_potential: parseFloat(cooling.toFixed(2)),
          canopy_gain: parseFloat(canopyGain.toFixed(1)),
          stormwater_retention: parseFloat(stormwater.toFixed(1)),
          pm25_removal: parseFloat(pm25.toFixed(2)),
          no2_removal: parseFloat(no2.toFixed(2))
        },
        giEvolution,
        finalGI: {
          gi_score: parseFloat(finalGI.toFixed(3)),
          gi_level: giLevel
        },
        recommendation: {
          strategy: recommendation,
          priority,
          rationale
        }
      });

      clearInterval(progressInterval);
      setStage('results');
    }, 6000); // 4 second loading duration
  };

  const exportReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      inputs,
      baseline: baselineData,
      results
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `simulation-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Environmental Scenario Simulation</h2>
            <p className="text-emerald-100 mt-1">
              {stage === 'setup' ? 'Configure simulation parameters' : 'Projected outcomes and recommendations'}
            </p>
          </div>
          <button
            onClick={closeModal}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {stage === 'setup' ? (
            <SimulationInputs
              inputs={inputs}
              onInputChange={handleInputChange}
              onReset={resetInputs}
              baselineData={baselineData}
            />
          ) : (
            stage === 'loading' ? (
              <SimulationLoading progress={loadingProgress} />
            ) : (
              <SimulationResults results={results} />
            )
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 flex items-center justify-between">
          {stage === 'setup' ? (
            <>
              <div className="text-sm text-gray-600">
                Configure parameters and click Run to see projections
              </div>
              <button
                onClick={runSimulation}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
              >
                <Play className="w-5 h-5" />
                Run Simulation
              </button>
            </>
          ) : stage === 'results' ? 
          (
            <>
              <button
                onClick={() => setStage('setup')}
                className="border border-gray-300 hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Inputs
              </button>
              <div className="flex gap-3">
                <button
                  onClick={exportReport}
                  className="border border-gray-300 bg-primary-green/15 hover:bg-primary-green/10 text-gray-700 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export Report
                </button>
          
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default SimulationModal;