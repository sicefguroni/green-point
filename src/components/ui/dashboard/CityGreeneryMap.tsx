"use client";

import * as React from "react";
import {
  Leaf,
  Sprout,
  Thermometer,
  TreeDeciduous,
  ChevronsDown,
  ChevronsUp,
  Info,
} from "lucide-react";

import { useBarangay } from "@/context/BarangayContext";
import { getGreeneryClassColor } from "@/lib/chloroplet-colors";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "../button";
import BarangayGreenery from "./BarangayGreenerayDetails";
import ChoroplethMap from "./ChloropletMap";

export default function CityGreeneryMap() {
  const [isOpen, setIsOpen] = React.useState(false);
  const { selectedBarangay } = useBarangay();

  const greeneryClassColor = getGreeneryClassColor(selectedBarangay?.greeneryIndex ?? 0);
  const [textColor, bgColor] = greeneryClassColor.split(" ");

  const effectiveTextColor =
    textColor === "text-green-600"
      ? "#16a34a"
      : textColor === "text-lime-600"
        ? "#65a30d"
        : textColor === "text-yellow-600"
          ? "#ca8a04"
          : textColor === "text-red-600"
            ? "#dc2626"
            : "#4b5563";

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="flex flex-1 flex-col"
    >
      <div className="flex flex-1 flex-col gap-4">
        <h2 className="text-xl font-medium text-neutral-black">
          Citywide Greenery Map
        </h2>
        <div className="flex w-full flex-1 flex-col overflow-hidden rounded-lg border bg-white shadow-sm md:flex-row">
          <div className="h-72 w-full overflow-hidden border-b md:h-auto md:w-2/3 md:border-b-0 md:border-r">
            <ChoroplethMap />
          </div>
          <aside className="flex w-full flex-1 flex-col items-center gap-4 bg-white p-4 px-6 md:w-1/3">
            <div className="flex w-full items-center gap-2">
              <Info size={24} className="text-neutral-black/50" aria-hidden />
              <h3 className="font-poppins text-md font-medium text-neutral-black/70">
                Barangay Environmental Metrics
              </h3>
            </div>
            <h4
              className={`w-fit rounded-sm py-1 px-4 text-xl font-bold ${bgColor ?? ""} ${textColor ?? ""}`}
            >
              {selectedBarangay?.name ?? "Select a Barangay"}
            </h4>
            <hr className="w-full border-neutral-grey" />
            <div className="flex w-full flex-1 flex-col justify-evenly gap-2">
              <BarangayGreenery
                icon={Leaf}
                valueName="Greenery Index"
                value={selectedBarangay?.greeneryIndex ?? 0}
              />
              <BarangayGreenery
                icon={Sprout}
                valueName="Normalized Difference Vegetation Index"
                value={selectedBarangay?.ndvi ?? 0}
              />
              <BarangayGreenery
                icon={TreeDeciduous}
                valueName="Tree Canopy Cover"
                value={selectedBarangay?.treeCanopy ?? 0}
              />
              <BarangayGreenery
                icon={Thermometer}
                valueName="Land Surface Temperature"
                value={selectedBarangay?.lst ?? 0}
                LST
              />
            </div>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                className="flex w-full cursor-pointer items-center justify-center gap-1 rounded-md border bg-white py-2 text-md font-medium transition-colors hover:bg-gray-50"
                style={{
                  borderColor: effectiveTextColor,
                  color: effectiveTextColor,
                }}
                disabled={!selectedBarangay}
              >
                {isOpen ? "View Less Details" : "View More Details"}
                {isOpen ? <ChevronsUp size={20} /> : <ChevronsDown size={20} />}
              </Button>
            </CollapsibleTrigger>
          </aside>
        </div>
        <CollapsibleContent>
          {/* TODO: replace with a dedicated detail component instead of importing a page-level route. */}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}