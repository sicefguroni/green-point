import { useState } from "react";
import { Download, Filter, MoreVertical, ArrowUpDown } from "lucide-react";
import ScenarioWeightingSlider from "./ScenarioWeightingSlider";

const sampleData = [
  { id: 1, barangay: "Sambag", equity: "68%", cost: "59%", impact: "52%", suggestedIntervention: ["Street Trees", "Green Walls"] },
  { id: 2, barangay: "Mandaue", equity: "29%", cost: "39%", impact: "40%", suggestedIntervention: ["Green Roofs", "Pocket Parks"] },
  { id: 3, barangay: "Consolacion", equity: "28%", cost: "19%", impact: "55%", suggestedIntervention: ["Pocket Parks", "Green Walls"] },
  { id: 4, barangay: "Minglanilla", equity: "78%", cost: "20%", impact: "42%", suggestedIntervention: ["Green Walls", "Street Trees"] },
  { id: 5, barangay: "Lahug", equity: "64%", cost: "49%", impact: "51%", suggestedIntervention: ["Pocket Parks", "Street Trees", "Green Walls"] },
];

// Method 1: Striped Table (Most Common)
export default function InterventionAnalysisTable() {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState('asc');

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      'Street Trees': 'bg-green-100 text-green-700 border-green-200',
      'Green Roofs': 'bg-emerald-100 text-emerald-700 border-emerald-200',
      'Pocket Parks': 'bg-yellow-100 text-yellow-700 border-yellow-200',
      'Green Walls': 'bg-blue-100 text-blue-700 border-blue-200'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="h-full w-full flex flex-col gap-2">
      <h1 className="text-neutral-black text-xl font-medium">Intervention Cost-Effectiveness Analysis</h1>
      <div className="h-full w-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Table Header with Actions */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-gray-800">Barangay Intervetion Leaderboard</h3>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filter
              </button>
              <button className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
        </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Rank
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Barangay Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Equity
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Cost
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('impact')}>
                <div className="flex items-center gap-1">
                  Impact
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-100">
                Suggested Intervention
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {sampleData.map((row, index) => (
              <tr key={row.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{index + 1}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{row.barangay}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {row.equity}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {row.cost}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {row.impact}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-row flex-wrap gap-2">
                    {row.suggestedIntervention.map((intervention, idx) => (
                      <span 
                        key={idx}
                        className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusColor(intervention)}`}
                      >
                        {intervention}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button className="text-primary-green hover:text-primary-green/80">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing <span className="font-medium">1-6</span> of <span className="font-medium">6</span> results
            </p>
            <div className="flex gap-2">
            <button className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50" disabled>
              Previous
            </button>
            <button className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50" disabled>
              Next
            </button>
          </div>
          </div>
        </div>
        <hr className="border-gray-200" />
        <ScenarioWeightingSlider />
      </div>
    </div>
  )
}