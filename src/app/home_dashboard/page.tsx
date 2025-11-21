"use client"

import Navbar from "@/components/ui/general/layout/navbar"
import IndicatorCard from "@/components/ui/dashboard/indicatorcard"
import { Download, Filter, MapPinned } from "lucide-react"
import InterventionAnalysisTable from "@/components/ui/dashboard/InterventionAnalysisTable"
import CityGreeneryMap from "@/components/ui/dashboard/CityGreeneryMap"

import { BarangayProvider } from "@/context/BarangayContext"
import { fetchMetricDescriptions } from "@/lib/api/get_definitions"
import { useEffect, useState } from "react"
import { MetricDescriptions } from "@/types/metrics"

export default function DashboardPage() {
  const [metricDescriptions, setMetricDescriptions] = useState<MetricDescriptions[]>([])
  
  const currentDate = new Date()
  const currentMonth = currentDate.toLocaleString("default", {
    month: "long",
    day: "numeric",
  })
  
  useEffect(() => {
    async function load() {
      const data = await fetchMetricDescriptions()
      setMetricDescriptions(data)
    }
    load()
  }, [])

  const getDesc = (name: string) => {
    return (
      metricDescriptions.find((metric) => metric.name === name)?.description ||
      ""
    )
  }

  return (
    <BarangayProvider>
      <main className="min-h-screen max-w-screen px-10 relative bg-gradient-to-br from-white to-green-100 flex flex-col">
        <Navbar />

        <div className="w-full flex flex-col overflow-hidden py-32 gap-8">
          <div className="flex flex-col gap-4">
            {/* Header info */}
            <div className="flex justify-between items-center w-full">
              <div className="flex items-center gap-3">
                <MapPinned size={28} className="text-primary-green" />
                <h1 className="text-neutral-black text-2xl">Mandaue City</h1>
                <h1 className="text-neutral-black/50 text-xl">|</h1>
                <h2 className="text-neutral-black/80 text-xl">{currentMonth}</h2>
              </div>

              <div className="flex flex-row items-center gap-2">
                <div className="bg-primary-green hover:bg-green-600 transition-colors text-sm text-white px-3 py-1.5 rounded-lg text-md flex flex-row items-center gap-2">
                  <Filter size={12} className="fill-current" />
                  Area
                </div>
                <button className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
            </div>

            {/* Metrics */}
            <div className="flex gap-4">
              <IndicatorCard
                title="Greenery Index"
                subtitle="GI (0-1 scale)"
                value={0.68}
                trendValue={0.05}
                description={getDesc("GreeneryIndex")}
              />

              <IndicatorCard
                title="Normalized Difference Vegetation Index"
                subtitle="NDVI (0-1 scale)"
                value={0.72}
                trendValue={0.03}
                description={getDesc("Normalized Difference Vegetation Index")}
              />

              <IndicatorCard
                title="Tree Canopy Cover"
                subtitle="TCC (0-1 scale)"
                value={0.65}
                trendValue={0.08}
                description={getDesc("Tree Canopy Cover")}
              />

              <IndicatorCard
                title="Land Surface Temperature"
                subtitle="LST (°C)"
                value={32}
                trendValue={1}
                LST={true}
                description={getDesc("Land Surface Temperature")}
              />
            </div>
          </div>

          {/* Map + Table */}
          <CityGreeneryMap />
          <InterventionAnalysisTable />
        </div>
      </main>
    </BarangayProvider>
  )
}
