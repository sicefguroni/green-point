"use client"

import BarangayGreenery from "./BarangayGreenerayDetails";
import BarangayGreeneryPage from "@/app/home_dashboard/barangays_greenery/[id]/page"
import { Leaf, Sprout, Thermometer, TreeDeciduous, ChevronsDown, ChevronsUp } from "lucide-react";
import { Info } from "lucide-react";
import * as React from "react";
import { useBarangay } from "@/context/BarangayContext";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import ChoroplethMap from "./ChloropletMap"
import { getGreeneryClassColor } from "@/lib/chloroplet-colors"
import { Button } from "../button";

export default function CityGreeneryMap() {
  const [isOpen, setIsOpen] = React.useState(false)
  const { selectedBarangay } = useBarangay();
  const classColor = getGreeneryClassColor(selectedBarangay?.greeneryIndex || 0);
  const [textColor, bgColor] = classColor.split(' ');

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="flex-1 flex flex-col">
      <div className="flex flex-col gap-4 flex-1">
        <h1 className="text-neutral-black text-xl font-medium">Citywide Greenery Map</h1>
        <div className="flex flex-row  flex-1 w-full border rounded-lg">
          <div className="w-2/3 flex overflow-hidden rounded-l-lg shadow-md ">                
            <ChoroplethMap />
          </div>
          <div className="flex flex-col w-1/3 p-4 px-6 flex-1 items-center bg-white rounded-r-lg shadow-md gap-4">
            <div className="flex flex-row w-full items-center gap-2">
              <Info size={24} className="text-neutral-black/50" />
              <h3 className="text-neutral-black/50 text-md font-medium font-poppins">Barangay Environmental Metrics</h3>
            </div>
            <h1 className={`w-fit ${bgColor} text-xl font-bold rounded-sm py-1 px-4 ${textColor}`}>{selectedBarangay?.name || "Select a Barangay"}</h1>
            <hr className="border-neutral-grey w-full" />
            <div className="flex-1 w-full flex flex-col justify-evenly">
              <BarangayGreenery icon={Leaf} valueName="Greenery Index" value={selectedBarangay?.greeneryIndex} />
              <BarangayGreenery icon={Sprout} valueName="Normalized Difference Vegetation Index" value={selectedBarangay?.ndvi} />
              <BarangayGreenery icon={TreeDeciduous} valueName="Tree Canopy Cover" value={selectedBarangay?.treeCanopy} />
              <BarangayGreenery icon={Thermometer} valueName="Land Surface Temperature" value={selectedBarangay?.lst} LST={true} />
            </div>
            <CollapsibleTrigger asChild>
              <Button 
                className="w-full flex justify-center items-center gap-1 py-2 bg-white border text-md font-medium rounded-md cursor-pointer hover:bg-gray-50 transition-colors"
                style={{ 
                  borderColor: textColor === 'text-green-600' ? '#16a34a' :
                              textColor === 'text-lime-600' ? '#65a30d' :
                              textColor === 'text-yellow-600' ? '#ca8a04' :
                              textColor === 'text-red-600' ? '#dc2626' :
                              textColor === 'text-gray-600' ? '#4b5563' : '#4b5563',
                  color: textColor === 'text-green-600' ? '#16a34a' :
                         textColor === 'text-lime-600' ? '#65a30d' :
                         textColor === 'text-yellow-600' ? '#ca8a04' :
                         textColor === 'text-red-600' ? '#dc2626' :
                         textColor === 'text-gray-600' ? '#4b5563' : '#4b5563'
                }}
                disabled={!selectedBarangay}
              >
                {isOpen ? "View Less Details" : "View More Details"}
                {isOpen ? <ChevronsUp size={20} /> : <ChevronsDown size={20} />}
              </Button>
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