"use client"

import Navbar from "@/components/ui/general/layout/navbar"
import IndicatorCard from "@/components/ui/dashboard/indicatorcard"
import { Download, Filter, MapPinned } from "lucide-react"
import dynamic from "next/dynamic"

const InterventionAnalysisTable = dynamic(
  () => import("@/components/ui/dashboard/InterventionAnalysisTable"),
  { ssr: false }
)
const CityGreeneryMap = dynamic(
  () => import("@/components/ui/dashboard/CityGreeneryMap"),
  { ssr: false }
)

import { BarangayProvider } from "@/context/BarangayContext"
import { fetchMetricDescriptions } from "@/lib/api/get_definitions"
import { useEffect, useState } from "react"
import { MetricDescriptions } from "@/types/metrics"
import { api, BarangayResult } from "@/lib/api"

interface CityAverages {
  greeneryIndex: number;
  ndvi: number;
  treeCanopy: number;
  lst: number;
}

export default function DashboardPage() {
  const [metricDescriptions, setMetricDescriptions] = useState<MetricDescriptions[]>([])
  const [cityAverages, setCityAverages] = useState<CityAverages | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
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

  useEffect(() => {
    async function loadCityData() {
      setIsLoading(true)
      try {
        const barangayData = await api.getFinalResults()
        
        if (barangayData.length > 0) {
          // Calculate averages across all barangays
          const averages = barangayData.reduce(
            (acc, curr) => ({
              greeneryIndex: acc.greeneryIndex + (curr.gi_score || 0),
              ndvi: acc.ndvi + (curr.ndvi_mean || 0),
              treeCanopy: acc.treeCanopy + (curr.canopy_cover_pct || 0),
              lst: acc.lst + (curr.mean_lst || 0),
            }),
            { greeneryIndex: 0, ndvi: 0, treeCanopy: 0, lst: 0 }
          )

          const count = barangayData.length
          // Round to 2 decimal places (1 for LST)
          setCityAverages({
            greeneryIndex: Math.round((averages.greeneryIndex / count) * 100) / 100,
            ndvi: Math.round((averages.ndvi / count) * 100) / 100,
            treeCanopy: Math.round((averages.treeCanopy / count) * 100) / 100,
            lst: Math.round((averages.lst / count) * 10) / 10,
          })
        }
      } catch (error) {
        console.error("Error loading city data:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadCityData()
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
              {isLoading ? (
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex-1 bg-white rounded-xl p-6 shadow-sm border border-gray-200 animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                      <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <IndicatorCard
                    title="Greenery Index"
                    subtitle="GI (0-1 scale)"
                    value={cityAverages?.greeneryIndex ?? 0}
                    trendValue={0.05}
                    description={getDesc("GreeneryIndex")}
                  />

                  <IndicatorCard
                    title="Normalized Difference Vegetation Index"
                    subtitle="NDVI (0-1 scale)"
                    value={cityAverages?.ndvi ?? 0}
                    trendValue={0.03}
                    description={getDesc("Normalized Difference Vegetation Index")}
                  />

                  <IndicatorCard
                    title="Tree Canopy Cover"
                    subtitle="TCC (%)"
                    value={cityAverages?.treeCanopy ?? 0}
                    trendValue={0.08}
                    description={getDesc("Tree Canopy Cover")}
                  />

                  <IndicatorCard
                    title="Land Surface Temperature"
                    subtitle="LST (°C)"
                    value={cityAverages?.lst ?? 0}
                    trendValue={1}
                    LST={true}
                    description={getDesc("Land Surface Temperature")}
                  />
                </>
              )}
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
