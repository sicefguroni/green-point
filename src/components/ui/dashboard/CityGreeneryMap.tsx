"use client"

import BarangayGreenery from "./BarangayGreenerayDetails";
import BarangayGreeneryPage from "@/app/home_dashboard/barangays_greenery/[id]/page"
import { Leaf, Sprout, Thermometer, TreeDeciduous, ChevronsDown } from "lucide-react";
import { Info } from "lucide-react";
import * as React from "react";
import { useBarangay } from "@/context/BarangayContext";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import ChoroplethMap from "./ChloropletMap"
import { getGreeneryColor } from "@/lib/chloroplet-colors"

export default function CityGreeneryMap() {
  const [isOpen, setIsOpen] = React.useState(false)
  const { selectedBarangay } = useBarangay();

  console.log(selectedBarangay)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="flex-1 flex flex-col">
      <div className="flex flex-col gap-4 flex-1">
        <h1 className="text-neutral-black text-xl font-medium">Citywide Greenery Map</h1>
        <div className="flex flex-row gap-4 flex-1 w-full">
          <div className="w-2/3 flex overflow-hidden rounded-l-lg shadow-md">                
            <ChoroplethMap
              colorScale={getGreeneryColor}
              valueKey="greenery_index"
              geoJsonUrl="/geo/mandaue_barangays_gi.geojson"
            />
          </div>
          <div className="flex flex-col w-1/3 p-4 px-6 flex-1 items-center bg-white rounded-r-lg shadow-md gap-4">
            <div className="flex flex-row w-full items-center gap-2">
              <Info size={24} className="text-neutral-black/50" />
              <h3 className="text-neutral-black/50 text-md font-medium font-poppins">Barangay Environmental Metrics</h3>
            </div>
            <h1 className="w-fit bg-primary-green text-white text-xl font-medium rounded-sm py-1 px-4">{selectedBarangay?.name || "Select a Barangay"}</h1>
            <hr className="border-neutral-grey w-full" />
            <div className="flex-1 w-full flex flex-col justify-evenly">
              <BarangayGreenery icon={<Leaf size={20} className="text-white" />} valueName="Greenery Index" value={selectedBarangay?.greeneryIndex} />
              <BarangayGreenery icon={<Sprout size={20} className="text-white" />} valueName="Normalized Difference Vegetation Index" value={selectedBarangay?.ndvi} />
              <BarangayGreenery icon={<Thermometer size={20} className="text-white" />} valueName="Land Surface Temperature" value={selectedBarangay?.lst} />
              <BarangayGreenery icon={<TreeDeciduous size={20} className="text-white" />} valueName="Tree Canopy Cover" value={selectedBarangay?.treeCanopy} />
            </div>
            <CollapsibleTrigger asChild>
              <div className="w-full flex justify-center items-center gap-1 py-2 bg-white text-primary-green border border-primary-green text-md font-medium rounded-md cursor-pointer hover:bg-green-50 transition-colors">
                View More Details
                <ChevronsDown size={20} className="text-primary-green" />
              </div>
            </CollapsibleTrigger>
          </div>
        </div>
        <CollapsibleContent>
            <BarangayGreeneryPage params={{ id: "mabolo" }} />
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}