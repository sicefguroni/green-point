import { useEffect, useState } from 'react';
import { Leaf, Droplets, Wind, Sun, TrendingUp, Activity } from 'lucide-react';

const SimulationLoading = ({ progress }: { progress: number }) => {
  const [activeLineIndex, setActiveLineIndex] = useState(0);

  const loadingSteps = [
    { label: 'Analyzing climate parameters', icon: Sun, color: 'text-orange-500' },
    { label: 'Processing greening strategies', icon: Leaf, color: 'text-green-500' },
    { label: 'Calculating stormwater retention', icon: Droplets, color: 'text-blue-500' },
    { label: 'Modeling air quality improvements', icon: Wind, color: 'text-cyan-500' },
    { label: 'Projecting greenery index evolution', icon: TrendingUp, color: 'text-emerald-500' },
    { label: 'Generating recommendations', icon: Activity, color: 'text-purple-500' }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveLineIndex(prev => (prev + 1) % loadingSteps.length);
    }, 1500);

    return () => clearInterval(interval);
  }, [loadingSteps.length]);

  return (
    <div className="flex items-center justify-center min-h-[415px]">
      <div className="max-w-2xl w-full space-y-8">
        {/* Animated Logo/Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500 opacity-20 rounded-full animate-ping"></div>
            <div className="relative bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full p-8">
              <Activity className="w-16 h-16 text-white animate-pulse" />
            </div>
          </div>
        </div>

        {/* Loading Text */}
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-bold text-gray-800">Running Environmental Simulation</h3>
          <div className="relative h-6 overflow-hidden text-gray-600">
            {loadingSteps.map((step, index) => (
              <p
                key={step.label}
                className={`absolute w-full left-0 top-0 transition-all duration-400 ease-out ${
                  index === activeLineIndex ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
                }`}
              >
                {step.label}
              </p>
            ))}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700 font-medium">Processing</span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-green-500 transition-all duration-500 ease-out relative overflow-hidden"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-white opacity-30 animate-shimmer"></div>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default SimulationLoading;