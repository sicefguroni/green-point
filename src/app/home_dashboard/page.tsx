"use client"

import Navbar from "@/components/ui/general/layout/navbar"
import IndicatorCard from "@/components/ui/dashboard/indicatorcard"
import { Filter, MapPinned } from "lucide-react"
import InterventionAnalysisTable from "@/components/ui/dashboard/InterventionAnalysisTable"
import CityGreeneryMap from "@/components/ui/dashboard/CityGreeneryMap"

import { BarangayProvider } from "@/context/BarangayContext"

export default function DashboardPage() {
  return (
    <BarangayProvider>
      <main className="min-h-screen max-w-screen px-10 relative bg-gradient-to-br from-white to-green-100 flex flex-col">
        {/* top nav bar */}
        <Navbar />
        <div className="w-full flex flex-col overflow-hidden py-32  gap-8">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center w-full">
              <div className="flex items-center gap-3">
                <MapPinned size={28} className="text-primary-green" />
                <h1 className="text-neutral-black text-2xl">Mandaue City</h1>
                <h1 className="text-neutral-black/50 text-xl">|</h1>
                <h2 className="text-neutral-black/80 text-xl">October 10</h2>
              </div>
              <div className="bg-primary-green text-white px-3 py-2 rounded-lg text-md flex flex-row items-center gap-2">
                Area
                <Filter size={16} className="fill-current" />
              </div>
            </div> 
            <div className="flex gap-4">
              <IndicatorCard title="Greenery Index" subtitle="GI (0-1 scale)" value={.52} trendValue={0.05} />
              <IndicatorCard title="Normalized Difference Vegetation Index" subtitle="NDVI (0-1 scale)" value={.72} trendValue={0.05} />
              <IndicatorCard title="Land Surface Temperature" subtitle="LST (0-1 scale)" value={.42} trendValue={0.05} />
              <IndicatorCard title="Tree Canopy Cover" subtitle="TCC (0-1 scale)" value={.12} trendValue={0.05} />
            </div>
          </div>

          <CityGreeneryMap />
          <InterventionAnalysisTable />
        </div>  
      </main>
    </BarangayProvider>
  )
}

