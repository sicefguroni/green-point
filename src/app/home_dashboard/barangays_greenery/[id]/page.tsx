"use client"

import TreeCanopyTrend from "@/components/charts/TreeCanopyTrend"
import BarangayRadarChart from "@/components/charts/BarangayRadarChart"
import NDVILSTChart from "@/components/charts/NDVILSTChart"
import PovertyComparison from "@/components/charts/PovertyComparison"

import { useBarangay } from "@/context/BarangayContext";
import { getGreeneryClassColor, getTemperatureColor } from "@/lib/chloroplet-colors";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel"
import { Download, Container, Info, TreeDeciduous, GalleryThumbnails } from "lucide-react";
import { useEffect, useState } from "react";
import { ChartInfoModal } from "@/components/ui/dashboard/info_modals";
import { BarangayDataMetrics, getBarangayMetricbyName, MetricDescriptions } from "@/types/metrics";
import { fetchMetricDescriptions } from "@/lib/api/get_definitions";


interface ModalValues {
  charttitle: string, 
  chartdescription: string,   
}

export default function BarangayGreeneryPage() {
  const { selectedBarangay } = useBarangay();
  const [barangayDataMetrics, setBarangayDataMetrics] = useState<Record<string, BarangayDataMetrics>>({});

  const classColor = getGreeneryClassColor(selectedBarangay?.greeneryIndex || 0);
  const [textColor, bgColor] = classColor.split(' ');
  const temperatureColor = getTemperatureColor(selectedBarangay?.lst || 0);
  const [temperatureTextColor, temperatureBgColor] = temperatureColor.split(' ');

  const [openModal, setOpenModal] = useState<boolean>(false);
  const [modalValues, setModalValues] = useState<ModalValues | null>(null);
  
  const [metricDescriptions, setMetricDescriptions] = useState<MetricDescriptions[]>([])
  const handleOpenModal = (title: string, description: string) => {
    setModalValues({ charttitle: title, chartdescription: description });
    setOpenModal(true);
  };
  
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

  useEffect(() => {
    async function fetchMetrics() {
      const metrics = await getBarangayMetricbyName();
      setBarangayDataMetrics(metrics);
    }
    fetchMetrics();
  }, []);

  if (!selectedBarangay) {
    return (
      <div className="w-full h-fit bg-white rounded-lg shadow-md p-6">
        <p className="text-neutral-black/80">Select a barangay on the map to view detailed metrics.</p>
      </div>
    );
  }

  const getInterventionDescription = (intervention: string) => {
    switch (intervention) {
      case "Urban Canopy enhancement":
        return "Street trees benefit the environment by improving air and water quality and reducing the urban heat-island effect. They also provide shade.";
      case "Green Corridor":
        return "Green corridors are urban pathways that combine water-based and vegetative features.";
      case "Rain Garden":
        return "Rain gardens are vegetated depressions that collect and infiltrate rainwater, reducing runoff and pollution.";
      default:
        return "N/A";
    }
  }

  const getInterventionIcon = (intervention: string) => {
    switch (intervention) {
      case "Urban Canopy enhancement":
        return <TreeDeciduous size={32} className="text-white" />;
      case "Green Corridor":
        return <Container size={32} className="text-white" />;
      case "Rain Garden":
        return <GalleryThumbnails size={32} className="text-white" />;
      default:
        return <TreeDeciduous size={32} className="text-white" />;
    }
  }

  const getFloodExposureClass = (floodExposure: string) => {
    switch (floodExposure) {
      case "Low":
        return "bg-green-500/10 text-green-500 px-2 py-1 rounded-md";
      case "Medium":
        return "bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded-md";
      case "High":
        return "bg-red-500/10 text-red-500 px-2 py-1 rounded-md";
      default:
        return "bg-gray-500/10 text-gray-500 px-2 py-1 rounded-md";
    }
  }

  const barangayData = barangayDataMetrics[selectedBarangay?.name || ""];

  return (
    <div className="w-full h-fit bg-white rounded-lg shadow-md p-6">
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex flex-row items-center justify-between">
          <div className="flex flex-row items-center gap-8">
            <h1 className={`text-2xl font-bold ${textColor} ${bgColor} w-fit px-4 py-1 rounded-md`}>
              {selectedBarangay?.name || "Barangay"}
            </h1>
            <p>
              Population:{" "}
              <span className="bg-blue-600/10 text-blue-600 px-2 py-1 rounded-md font-medium">
                {barangayData?.population[2024] ?? "N/A"} people
              </span>
            </p>
            <p>
              Population Density:{" "}
              <span className="bg-blue-600/10 text-blue-600 px-2 py-1 rounded-md font-medium">
                {barangayData?.pop_density_perkm2} people/sq.km
              </span>
            </p>
            <p>
              Area:{" "}
              <span className="bg-blue-600/10 text-blue-600 px-2 py-1 rounded-md font-medium">
                {barangayData?.area_km2} sq.km
              </span>
            </p>

          </div>
          <button className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
  
        {/* Metrics */}
        <div className="flex flex-row flex-wrap gap-12">  
          <p className="text-neutral-black/90">
            GI:{" "}
            <span className={`bg-primary-green/10 text-primary-green px-2 py-1 rounded-md font-medium`}>
              {selectedBarangay?.greeneryIndex ?? "N/A"}
            </span>
          </p>
  
          <p className="text-neutral-black/90">
            NDVI:{" "}
            <span className="bg-primary-green/10 text-primary-green px-2 py-1 rounded-md font-medium">
              {selectedBarangay?.ndvi ?? "N/A"}
            </span>
          </p>
  
          <p className="text-neutral-black/90">
            TCC:{" "}
            <span className="bg-primary-green/10 text-primary-green px-2 py-1 rounded-md font-medium">
              {selectedBarangay?.treeCanopy ?? "N/A"}
            </span>
          </p>
  
          <p className="text-neutral-black/90">
            LST:{" "}
            <span className={`bg-primary-green/10 text-primary-green px-2 py-1 rounded-md font-medium ${temperatureTextColor} ${temperatureBgColor}`}>
              {selectedBarangay?.lst ? `${selectedBarangay.lst}°C` : "N/A"}
            </span>
          </p>
  
          <p className="text-neutral-black/80 font-medium">
            Flood Exposure:{" "}
            <span className={getFloodExposureClass(selectedBarangay?.floodExposure ?? "N/A")}>
              {selectedBarangay?.floodExposure ?? "N/A"}
            </span>
          </p>
  
          <p className="text-neutral-black/90">
            Poverty Rate:{" "}
            <span className="bg-primary-green/10 text-primary-green px-2 py-1 rounded-md font-medium">
              10%
            </span>
          </p>
        </div>
      </div>
  
      <hr className="border-neutral-grey w-full" />
  
      {/* Charts + Interventions */}
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
                            getDesc("NDVI & LST Time Series")
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
                            getDesc("Tree Canopy % Trend")
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
                            getDesc("Poverty % Comparison vs City Average")
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
  
          {/* TOP INTERVENTION */}
          <hr className="border-neutral-grey w-full pl-12" />
          <div className="h-full w-full flex flex-col gap-3">
            <h1 className="text-md font-semibold">Top Greening Intervention</h1>
            <div className="w-full h-full flex gap-4 items-center bg-primary-green/5 border border-primary-green/50 rounded-md p-4">
              <div className="w-fit h-fit bg-primary-green rounded-full p-4">
                {getInterventionIcon(selectedBarangay?.currentIntervention ?? "N/A")}
              </div>
              <div>
                <h1 className="text-primary-green text-lg font-semibold">
                  {selectedBarangay?.currentIntervention ?? "N/A"}
                </h1>
                <p className="text-neutral-black/80 text-sm line-clamp-2">
                  {getInterventionDescription(selectedBarangay?.currentIntervention ?? "N/A")}
                </p>
              </div>
            </div>
          </div>
        </div>
  
        {/* RADAR CHART */}
        <div className="flex flex-col w-full h-full bg-primary-green/5 border border-primary-green/50 rounded-lg p-4 ml-12">
          <h1 className="text-lg font-medium">Barangay Radar Chart</h1>
          <BarangayRadarChart
            data={[
              { metric: "Greenery Index", barangay: selectedBarangay?.greeneryIndex ?? 0, city: 0.72 },
              { metric: "NDVI", barangay: selectedBarangay?.ndvi ?? 0, city: 0.70 },
              { metric: "Canopy %", barangay: selectedBarangay?.treeCanopy ?? 0, city: 0.74 },
              { metric: "Poverty % (Inverted)", barangay: 0.45, city: 0.55 },
              { metric: "Area Size", barangay: 0.68, city: 0.70 },
            ]}
          />
        </div>
      </div>
  
      {/* Popup Modal */}
      <ChartInfoModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title={modalValues?.charttitle || "NDVI & LST Trend"}
        description={
          modalValues?.chartdescription ||
          "This chart compares vegetation health (NDVI) with land surface temperature (LST) over time."
        }
      />
    </div>
  );
} 