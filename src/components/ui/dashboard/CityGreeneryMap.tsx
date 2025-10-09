"use client"

import BarangayGreenery from "./BarangayGreenerayDetails";
import BarangayGreeneryPage from "@/app/home_dashboard/barangays_greenery/[id]/page"
import { Leaf, Sprout, Thermometer, TreeDeciduous, ChevronsDown } from "lucide-react";
import { Info } from "lucide-react";
import * as React from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

export default function CityGreeneryMap() {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex flex-col gap-4 h-fit">
        <h1 className="text-neutral-black text-xl font-medium">Citywide Greenery Map</h1>
        <div className="flex flex-row gap-4 h-full w-full">
          <div className="h-full w-2/3 flex overflow-hidden rounded-l-lg shadow-md">                
            {/* <MapboxMap /> */}
          </div>
          <div className="flex flex-col w-1/3 p-4 px-6 h-full items-center bg-white rounded-r-lg shadow-md gap-4">
            <div className="flex flex-row w-full items-center gap-2">
              <Info size={24} className="text-neutral-black/50" />
              <h3 className="text-neutral-black/50 text-md font-medium font-poppins">Barangay Environmental Metrics</h3>
            </div>
            <h1 className="w-fit bg-primary-green text-white text-xl font-medium rounded-full py-1 px-4">Barangay Mabolo</h1>
            <hr className="border-neutral-grey w-full" />
            <div className="flex-1 w-full flex flex-col justify-evenly">
              <BarangayGreenery icon={<Leaf size={20} className="text-white" />} valueName="Greenery Index" value={.52} />
              <BarangayGreenery icon={<Sprout size={20} className="text-white" />} valueName="Normalized Difference Vegetation Index" value={.42} />
              <BarangayGreenery icon={<Thermometer size={20} className="text-white" />} valueName="Land Surface Temperature" value={.72} />
              <BarangayGreenery icon={<TreeDeciduous size={20} className="text-white" />} valueName="Tree Canopy Cover" value={.48} />
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