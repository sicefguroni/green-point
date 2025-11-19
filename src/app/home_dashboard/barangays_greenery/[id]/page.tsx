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
import { BarangayMetrics, getBarangayMetricbyName } from "@/types/metrics";

interface ModalValues {
  charttitle: string, 
  chartdescription: string,   
}

export default function BarangayGreeneryPage() {
  const { selectedBarangay } = useBarangay();
  const [barangayMetrics, setBarangayMetrics] = useState<Record<string, BarangayMetrics>>({});

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

  useEffect(() => {
    async function fetchMetrics() {
      const metrics = await getBarangayMetricbyName();
      setBarangayMetrics(metrics);
    }
    fetchMetrics();
  }, []);

  const barangayData = barangayMetrics[selectedBarangay.name];

  return (
    <div className="w-full h-fit bg-white rounded-lg shadow-md p-6">
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex flex-row items-center justify-between">
          <div className="flex flex-row items-center gap-8">
            <h1 className={`text-2xl font-bold ${textColor} ${bgColor} w-fit px-4 py-1 rounded-md`}>
              {selectedBarangay?.name || "Barangay"}
            </h1>
          </div>
          <button className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
  
        {/* Metrics */}
        <div className="flex flex-row justify-between flex-wrap gap-2">
          <p className="text-neutral-black/90">
            Population Density:{" "}
            <span className="bg-blue-600/10 text-blue-600 px-2 py-1 rounded-md font-medium">
              1,000 people/sq.km
            </span>
          </p>
  
          <p className="text-neutral-black/90">
            Area:{" "}
            <span className="bg-blue-600/10 text-blue-600 px-2 py-1 rounded-md font-medium">
              10,000 sq.m
            </span>
          </p>
  
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
                <CarouselItem>
                  <div className="w-full h-60 mb-8">
                    <h3 className="text-neutral-black text-sm font-medium mb-2">NDVI & LST Trend</h3>
                    <NDVILSTChart
                      data={[
                        { month: "Jan", NDVI: selectedBarangay?.ndvi || 0, LST: selectedBarangay?.lst || 0 },
                        { month: "Feb", NDVI: 0.8, LST: 35 },
                      ]}
                    />
                  </div>
                </CarouselItem>
  
                <CarouselItem>
                  <div className="w-full h-60">
                    <h3 className="text-neutral-black text-sm font-medium mb-2">Tree Canopy Trend</h3>
                    <TreeCanopyTrend
                      data={[
                        { year: "2020", canopy: (selectedBarangay?.treeCanopy ?? 0) - 0.3 },
                        { year: "2021", canopy: (selectedBarangay?.treeCanopy ?? 0) - 0.23 },
                        { year: "2022", canopy: (selectedBarangay?.treeCanopy ?? 0) - 0.1 },
                        { year: "2023", canopy: (selectedBarangay?.treeCanopy ?? 0) + 0.1 },
                        { year: "2024", canopy: (selectedBarangay?.treeCanopy ?? 0) + 0.15 },
                      ]}
                      since="2020"
                      changePercent={5.3}
                    />
                  </div>
                </CarouselItem>
  
                <CarouselItem>
                  <div className="w-full h-60">
                    <h3 className="text-neutral-black text-sm font-medium mb-2">Poverty Rate Comparison</h3>
                    <PovertyComparison
                      data={[
                        { label: selectedBarangay?.name || "This Barangay", value: 42 },
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