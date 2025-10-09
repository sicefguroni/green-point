"use client"

import Navbar from "@/components/ui/navbar"
import IndicatorCard from "@/components/ui/dashboard/indicatorcard"
import { Filter, MapPinned, Info, Leaf, Sprout, Thermometer, TreeDeciduous, ChevronsDown } from "lucide-react"
import MapboxMap from "@/components/map/mapbox_map"
import BarangayGreenery from "@/components/ui/dashboard/barangaygreenery"

export default function MapPage() {
  return (
    <main className="min-h-screen max-w-screen px-10 relative bg-gradient-to-br from-white to-green-100">
      {/* top nav bar */}
      <Navbar />
      <div className="h-full w-full flex flex-col overflow-hidden py-32 gap-6">
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

        <div className="flex flex-col gap-4 h-[500px]">
          <h1 className="text-neutral-black text-xl font-medium">Citywide Greenery Map</h1>
          <div className="flex flex-row gap-4 h-full w-full">
            <div className="h-full w-2/3 flex overflow-hidden rounded-l-lg shadow-md">                
              <MapboxMap />
            </div>
            <div className="flex flex-col w-1/3 p-4 px-6 h-full items-center bg-white rounded-r-lg shadow-md gap-4">
              <div className="flex flex-row w-full items-center gap-2">
                <Info size={24} className="text-neutral-black/50" />
                <h3 className="text-neutral-black/50 text-md font-medium font-poppins">Barangay Environmental Metrics</h3>
              </div>
              <h1 className="w-fit bg-primary-green text-white text-2xl font-medium rounded-full py-1 px-4">Barangay Sambag</h1>
              <hr className="border-neutral-grey w-full" />
              <div className="flex-1 w-full flex flex-col justify-evenly">
                <BarangayGreenery icon={<Leaf size={24} className="text-white" />} valueName="Greenery Index" value={.52} />
                <BarangayGreenery icon={<Sprout size={24} className="text-white" />} valueName="Normalized Difference Vegetation Index" value={.42} />
                <BarangayGreenery icon={<Thermometer size={24} className="text-white" />} valueName="Land Surface Temperature" value={.72} />
                <BarangayGreenery icon={<TreeDeciduous size={24} className="text-white" />} valueName="Tree Canopy Cover" value={.48} />
              </div>
              <div onClick={() => {}} className="w-full flex justify-center items-center gap-1 py-2 bg-white text-primary-green border border-primary-green text-md font-medium rounded-md cursor-pointer hover:bg-green-50 transition-colors">
                See Full Details
                <ChevronsDown size={20} className="text-primary-green" />
              </div>
            </div>
          </div>
        </div>

      </div>  
    </main>
  )
}

