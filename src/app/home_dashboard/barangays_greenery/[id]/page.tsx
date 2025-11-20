import TreeCanopyTrend from "@/components/charts/TreeCanopyTrend"
import BarangayRadarChart from "@/components/charts/BarangayRadarChart"
import NDVILSTChart from "@/components/charts/NDVILSTChart"
import PovertyComparison from "@/components/charts/PovertyComparison"

import { useBarangay } from "@/context/BarangayContext";
import { getGreeneryClassColor, getTemperatureColor } from "@/lib/chloroplet-colors";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel"
import { Download, Info, TreeDeciduous } from "lucide-react";
import { useState } from "react";
import { ChartInfoModal } from "@/components/ui/dashboard/info_modals";

interface ModalValues {
  charttitle: string, 
  chartdescription: string,   
}

export default function BarangayGreeneryPage() {
  const { selectedBarangay } = useBarangay();
  const classColor = getGreeneryClassColor(selectedBarangay?.greeneryIndex || 0);
  const [textColor, bgColor] = classColor.split(' ');
  const temperatureColor = getTemperatureColor(selectedBarangay?.lst || 0);
  const [temperatureTextColor, temperatureBgColor] = temperatureColor.split(' ');

  const [openModal, setOpenModal] = useState<boolean>(false);
  const [modalValues, setModalValues] = useState<ModalValues | null>(null);

  const handleOpenModal = (title: string, description: string) => {
    setModalValues({ charttitle: title, chartdescription: description });
    setOpenModal(true);
  };

  if (!selectedBarangay) {
    return (
      <div className="w-full h-fit bg-white rounded-lg shadow-md p-6">
        <p className="text-neutral-black/80">Select a barangay on the map to view detailed metrics.</p>
      </div>
    );
  }

  return (
    <>
      <div className="w-full h-fit bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex flex-row items-center justify-between">
            <h1 className={`text-2xl font-bold ${textColor} ${bgColor} w-fit px-4 py-1 rounded-md`}>{selectedBarangay?.name}</h1>
            <button className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
          <div className="flex flex-row gap-16">
            <p className="text-neutral-black/90">Population Density: <span className="bg-blue-600/10 text-blue-600 px-2 py-1 rounded-md font-medium">1,000 people/sq.km</span></p>
            <p className="text-neutral-black/90">Area: <span className="bg-blue-600/10 text-blue-600 px-2 py-1 rounded-md font-medium">10,000 sq.m</span></p>
            <p className="text-neutral-black/90">GI: <span className={`bg-primary-green/10 text-primary-green px-2 py-1 rounded-md font-medium ${textColor} ${bgColor}`}>{selectedBarangay?.greeneryIndex}</span></p>
            <p className="text-neutral-black/90">NDVI: <span className={`bg-primary-green/10 text-primary-green px-2 py-1 rounded-md font-medium ${textColor} ${bgColor}`}>{selectedBarangay?.ndvi}</span></p>
            <p className="text-neutral-black/90">TCC: <span className={`bg-primary-green/10 text-primary-green px-2 py-1 rounded-md font-medium ${textColor} ${bgColor}`}>{selectedBarangay?.treeCanopy}</span></p>
            <p className="text-neutral-black/90">LST: <span className={`bg-primary-green/10 text-primary-green px-2 py-1 rounded-md font-medium ${temperatureTextColor} ${temperatureBgColor}`}>{selectedBarangay?.lst}°C</span></p>
            <p className="text-neutral-black/90">Poverty Rate: <span className="bg-primary-green/10 text-primary-green px-2 py-1 rounded-md font-medium">10%</span></p>
          </div>
        </div>
        <hr className="border-neutral-grey w-full" />
        <div className="flex w-full h-[500px] pt-4">
          <div className="flex flex-col h-full w-full gap-4">
            <div className="w-full px-12">
              <Carousel className="pl-12 bg-primary-green/5 border border-primary-green/50 px-4 py-4 rounded-lg h-fit w-full">
                <CarouselContent className="h-full">
                  <CarouselItem className="h-full">
                    <div className="w-full h-60 mb-8 ">                      
                      <div className="flex flex-row justify-between items-center">
                        <h3 className="text-neutral-black text-sm font-medium mb-2">NDVI & LST Trend</h3>
                        <button
                          onClick={() => handleOpenModal(
                            "NDVI & LST Trend",
                            "NDVI represents vegetation health, while LST indicates heat levels. This trend visualizes how vegetation helps regulate urban heat."
                          )}
                          className="text-neutral-black/80 p-1 hover:bg-neutral-200/60 rounded-full transition-all duration-150 cursor-pointer "
                        >
                          <Info />
                        </button>
                      </div>
                        <NDVILSTChart data={[
                          { month: "Jan", NDVI: selectedBarangay?.ndvi || 0, LST: selectedBarangay?.lst || 0 },
                          { month: "Feb", NDVI: .8, LST: 35 },
                        ]} />
                    </div>
                  </CarouselItem>
                  <CarouselItem className="h-full">
                    <div className="w-full h-60">
                      <div className="flex flex-row justify-between items-center">
                        <h3 className="text-neutral-black text-sm font-medium mb-2">Tree Canopy</h3>
                        <button
                          onClick={() => handleOpenModal(
                            "Tree Canopy",
                            "uu uuu u uu auisdgauysgduatyisfgduyiasgduyastfd8aystfduy"
                          )}
                          className="text-neutral-black/80 p-1 hover:bg-neutral-200/60 rounded-full transition-all duration-150 cursor-pointer "
                        >
                          <Info />
                        </button>
                      </div>
                      <TreeCanopyTrend
                        data={[
                          { year: "2020", canopy: selectedBarangay?.treeCanopy - .3 || 0 },
                          { year: "2021", canopy: selectedBarangay?.treeCanopy - .23 || 0 },
                          { year: "2022", canopy: selectedBarangay?.treeCanopy - .1|| 0 },
                          { year: "2023", canopy: selectedBarangay?.treeCanopy + .1 || 0 },
                          { year: "2024", canopy: selectedBarangay?.treeCanopy + .15|| 0 },
                        ]}
                        since="2020"
                        changePercent={5.3}
                      />
                    </div>
                  </CarouselItem>
                  <CarouselItem className="h-full">
                    <div className="w-full h-60">
                      <div className="flex flex-row justify-between items-center">
                        <h3 className="text-neutral-black text-sm font-medium mb-2">Poverty Rate Comparison</h3>
                        <button
                          onClick={() => handleOpenModal(
                            "Poverty Rate Comparison",
                            "uu uuu u uu auisdgauysgduatyisfgduyiasgduyastfd8aystfduy"
                          )}
                          className="text-neutral-black/80 p-1 hover:bg-neutral-200/60 rounded-full transition-all duration-150 cursor-pointer "
                        >
                          <Info />
                        </button>
                      </div>
                      <PovertyComparison
                        data={[
                          { label: selectedBarangay?.name, value: 42 },
                          { label: "City Avg", value: 32 },
                        ]}
                      />
                    </div>
                  </CarouselItem>
                </CarouselContent>
                <CarouselNext />
                <CarouselPrevious />
              </Carousel>
            </div>
            
            <hr className="border-neutral-grey w-full pl-12" />

            <div className="h-full w-full flex flex-col gap-3">
              <h1 className="text-md font-semibold">Top Greening Intervention </h1>
              <div className="w-full h-full flex gap-4 items-center bg-primary-green/5 border  border-primary-green/50 rounded-md p-4">
                <div className="w-fit h-fit bg-primary-green rounded-full p-4">
                  <TreeDeciduous size={32} className="text-white" />
                </div>
                <div>
                  <h1 className="text-primary-green text-lg font-semibold">Street Trees</h1>
                  <p className="text-neutral-black/80 text-sm overflow-hidden line-clamp-2">
                    Street trees benefit the environment by improving air and water quality and reducing the urban heat-island effect. They also provide shade.
                  </p>
                </div>
              </div>
            </div>

          </div>
          <div className="flex flex-col w-full h-full bg-primary-green/5 border border-primary-green/50 rounded-lg p-4 ml-12">
            <h1 className="text-lg font-medium">Barangay Radar Chart</h1>
            <BarangayRadarChart
              data={[
                { metric: "Greenery Index", barangay: selectedBarangay.greeneryIndex, city: .72 },
                { metric: "NDVI", barangay: selectedBarangay.ndvi, city: .70 },
                { metric: "Canopy %", barangay: selectedBarangay.treeCanopy, city: .74 },
                { metric: "Poverty % (Inverted)", barangay: .45, city: .55 },
                { metric: "Area Size", barangay: .68, city: .70 },
              ]}
            />
          </div>
        </div>
      </div>
      {/* Popup Modal */}
      {/* Popup Modal */}
      <ChartInfoModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title={modalValues?.charttitle || "NDVI & LST Trend"}
        description={
          modalValues?.chartdescription ||
          "This chart compares vegetation health (NDVI) with land surface temperature (LST) over time. Higher NDVI values generally indicate healthier vegetation, while higher LST values may indicate heat concentration in urbanized or less vegetated areas."
        }
      />
    </>
    
  );
} 