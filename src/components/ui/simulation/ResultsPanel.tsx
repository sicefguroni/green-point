import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';  
import GreenSolutionCard from "@/components/ui/general/cards/greensolution-infocard"
import { Trees } from "lucide-react"
import { Flower } from "lucide-react"
import { Cookie } from "lucide-react"

export type SimulationResultsType = {
  environmental: {
    cooling_potential: number;
    canopy_gain: number;
    stormwater_retention: number;
    pm25_removal: number;
    no2_removal: number;
  };
  giEvolution: Array<{
    year: number;
    gi_score: number;
    quantity_score: number;
    environmental_quality_score: number;
  }>;
  finalGI: {
    gi_score: number;
    gi_level: string;
  };
  recommendation: {
    strategy: string;
    priority: string;
    rationale: string;
  };
};

interface SimulationResultsProps {
  results: SimulationResultsType;
}

const SimulationResults = ({ results }: SimulationResultsProps) => {
  return (
    <div className="space-y-6">
      {/* Environmental Impact Projections */}
      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-4">Environmental Impact Projections</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-blue-700 font-medium mb-1">Cooling Potential</div>
            <div className="text-3xl font-bold text-blue-900">{results.environmental.cooling_potential}°C</div>
            <div className="text-xs text-blue-600 mt-1">Temperature reduction</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
            <div className="text-sm text-green-700 font-medium mb-1">Canopy Gain</div>
            <div className="text-3xl font-bold text-green-900">{results.environmental.canopy_gain}%</div>
            <div className="text-xs text-green-600 mt-1">Coverage increase</div>
          </div>
          <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 border border-cyan-200 rounded-lg p-4">
            <div className="text-sm text-cyan-700 font-medium mb-1">Stormwater</div>
            <div className="text-3xl font-bold text-cyan-900">{results.environmental.stormwater_retention}</div>
            <div className="text-xs text-cyan-600 mt-1">mm retained</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4">
            <div className="text-sm text-purple-700 font-medium mb-1">PM2.5 Removal</div>
            <div className="text-3xl font-bold text-purple-900">{results.environmental.pm25_removal}</div>
            <div className="text-xs text-purple-600 mt-1">µg/m³ reduction</div>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-4">
            <div className="text-sm text-orange-700 font-medium mb-1">NO2 Removal</div>
            <div className="text-3xl font-bold text-orange-900">{results.environmental.no2_removal}</div>
            <div className="text-xs text-orange-600 mt-1">µg/m³ reduction</div>
          </div>
        </div>
      </div>

      {/* Greenery Index Evolution */}
      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-4">Greenery Index Evolution</h3>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={results.giEvolution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" label={{ value: 'Year', position: 'insideBottom', offset: -5 }} />
              <YAxis label={{ value: 'Score', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="gi_score" stroke="#10b981" strokeWidth={3} name="GI Score" />
              <Line type="monotone" dataKey="quantity_score" stroke="#3b82f6" strokeWidth={2} name="Quantity Score" />
              <Line type="monotone" dataKey="environmental_quality_score" stroke="#f59e0b" strokeWidth={2} name="Environmental Quality" />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 flex items-center justify-center gap-8">
            <div className="text-center">
              <div className="text-sm text-gray-600">Final GI Score</div>
              <div className="text-2xl font-bold text-emerald-600">{results.finalGI.gi_score}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">Classification</div>
              <div className={`text-2xl font-bold ${
                results.finalGI.gi_level === 'Excellent' ? 'text-emerald-600' :
                results.finalGI.gi_level === 'High' ? 'text-green-600' :
                results.finalGI.gi_level === 'Medium' ? 'text-yellow-600' : 'text-orange-600'
              }`}>
                {results.finalGI.gi_level}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendation Summary */}
      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-4">Recommendation Summary</h3>
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
              results.recommendation.priority === 'High' ? 'bg-red-100 text-red-700' :
              results.recommendation.priority === 'Moderate' ? 'bg-yellow-100 text-yellow-700' :
              'bg-green-100 text-green-700'
            }`}>
              {results.recommendation.priority} Priority
            </div>
          </div>
          <h4 className="text-2xl font-bold text-gray-800 mt-4 mb-2">{results.recommendation.strategy}</h4>
          <p className="text-gray-700 leading-relaxed">{results.recommendation.rationale}</p>
        </div>
        <div className="flex-1">                      
          <GreenSolutionCard 
            solutionTitle="Street Trees"
            solutionDescription="Trees planted along urban streets and walkways."
            detailedDescription="Street trees are trees planted along urban streets that provide environmental, social, and economic benefits, such as improving air quality, reducing stormwater runoff, providing shade, and enhancing the aesthetic appeal of a city. They are a key component of urban planning that can increase property values, improve walkability, and create a healthier environment for residents. "
            efficiencyLevel="Highly Efficient"
            value={90}
            icon={<Trees size={40} />}
            equityIndex={0.9}
            cost={0.5}
            impact={0.78}
          />

          <GreenSolutionCard 
            solutionTitle="Roof Gardens"
            solutionDescription="Gardens grown on the rooftops of buildings."
            detailedDescription="A roof garden is a garden on the roof of a building, also known as a green roof or landscaped rooftop. They can range from small container gardens to large landscapes with trees and walkways, and they provide benefits such as temperature control, improved air quality, stormwater management, and a space for recreation and growing food. "
            efficiencyLevel="Moderately Efficient"
            value={40}
            icon={<Flower size={40} />}
            equityIndex={0.5}
            cost={0.33}
            impact={0.56}
          />

          <GreenSolutionCard 
            solutionTitle="Mixed Blue-Green Corridors"
            solutionDescription="Urban pathways that combine water-based and vegetative features."
            detailedDescription="Mixed blue-green corridors are integrated urban planning solutions that link natural land (green) and water features (blue) to create interconnected passageways that provide multiple environmental, social, and economic benefits. This approach, also known as blue-green infrastructure (BGI), is a key strategy for making cities more resilient to climate change impacts like flooding and heatwaves. "
            efficiencyLevel="Not Efficient"
            value={30}
            icon={<Cookie size={40} />}
            equityIndex={0.7}
            cost={0.15}
            impact={0.8}
          />
        </div>          
      </div>
    </div>
  );
};

export default SimulationResults;