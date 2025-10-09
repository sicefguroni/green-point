import TreeCanopyTrend from "@/components/charts/TreeCanopyTrend"
import BarangayRadarChart from "@/components/charts/BarangayRadarChart"
import NDVILSTChart from "@/components/charts/NDVILSTChart"
import PovertyComparison from "@/components/charts/PovertyComparison"

import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel"
import { TreeDeciduous } from "lucide-react";

export default function BarangayGreeneryPage({ params }: { params: { id: string } }) {
  const barangays = {
    'lahug': { name: 'Lahug', population: 15000, gi: 0.72 },
    'mabolo': { name: 'Mabolo', population: 12000, gi: 0.58 },
  };

  const barangay = barangays[params.id as keyof typeof barangays]

  if (!barangay) {
    return <div>Barangay not found</div>
  }

  return (
    <div className="w-full h-fit bg-white rounded-lg shadow-md p-6">
      <div className="flex flex-col gap-2 mb-4">
        <h1 className="text-2xl font-bold">{barangay.name}</h1>
        <div className="flex flex-row gap-16">
          <p className="text-neutral-black/90">Population Density: <span className="bg-primary-green/10 text-primary-green px-2 py-1 rounded-md font-medium">{barangay.population}</span></p>
          <p className="text-neutral-black/90">Area: <span className="bg-primary-green/10 text-primary-green px-2 py-1 rounded-md font-medium">10,000 sq.m</span></p>
          <p className="text-neutral-black/90">GI: <span className="bg-primary-green/10 text-primary-green px-2 py-1 rounded-md font-medium">{barangay.gi}</span></p>
          <p className="text-neutral-black/90">NDVI: <span className="bg-primary-green/10 text-primary-green px-2 py-1 rounded-md font-medium">0.8</span></p>
          <p className="text-neutral-black/90">LST: <span className="bg-primary-green/10 text-primary-green px-2 py-1 rounded-md font-medium">0.2</span></p>
          <p className="text-neutral-black/90">TCC: <span className="bg-primary-green/10 text-primary-green px-2 py-1 rounded-md font-medium">0.5</span></p>
          <p className="text-neutral-black/90">Poverty Rate: <span className="bg-primary-green/10 text-primary-green px-2 py-1 rounded-md font-medium">10%</span></p>
        </div>
      </div>
      <hr className="border-neutral-grey w-full" />
      <div className="flex w-full h-[500px] pt-6">
        <div className="flex flex-col h-full w-full gap-4">
          <div className="w-full px-12">
            <Carousel className="pl-12 bg-neutral-grey/10 p-4 rounded-lg h-fit w-full">
              <CarouselContent className="h-full">
                <CarouselItem className="h-full">
                  <div className="w-full h-60">
                    <NDVILSTChart data={[
                      { month: "Jan", ndvi: 0.6, lst: 32 },
                      { month: "Feb", ndvi: 0.7, lst: 34 },
                    ]} />
                  </div>
                </CarouselItem>
                <CarouselItem className="h-full">
                  <div className="w-full h-60">
                    <TreeCanopyTrend
                      data={[
                        { year: "2020", canopy: 35 },
                        { year: "2021", canopy: 38 },
                        { year: "2022", canopy: 40 },
                      ]}
                      since="2020"
                      changePercent={5.3}
                    />
                  </div>
                </CarouselItem>
                <CarouselItem className="h-full">
                  <div className="w-full h-60">
                    <PovertyComparison
                      data={[
                        { label: "Barangay", value: 42 },
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
                <p className="text-neutral-black/80 text-sm overflow-hidden line-clamp-2">Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, quos.
                Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, quos.
                Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, quos.
                </p>
              </div>
            </div>
          </div>

        </div>
        <div className="flex flex-col w-full h-full bg-primary-green/5 border border-primary-green/50 rounded-lg p-4 ml-12">
          <h1 className="text-lg font-medium">Barangay Radar Chart</h1>
          <BarangayRadarChart
            data={[
              { metric: "Greenery Index", barangay: 85, city: 72 },
              { metric: "NDVI", barangay: 78, city: 70 },
              { metric: "LST (Inverted)", barangay: 65, city: 60 },
              { metric: "Canopy %", barangay: 80, city: 74 },
              { metric: "Poverty % (Inverted)", barangay: 45, city: 55 },
              { metric: "Area Size", barangay: 68, city: 70 },
            ]}
          />
        </div>
      </div>
    </div>
  );
} 