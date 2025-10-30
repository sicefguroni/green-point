"use client"

import {Map, BrainCircuit, Camera, LayoutDashboard, ChevronRight,  Sprout, Leaf, Thermometer, TreeDeciduous } from "lucide-react"
import InfoCard from "../components/ui/general/cards/preview-infocard";
import Link from "next/link"
import Navbar from "@/components/ui/general/layout/navbar"
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import MandaueMap from "@/components/ui/dashboard/ChloropletMap";
import { BarangayProvider } from "@/context/BarangayContext";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.prefetch("/home_dashboard");
    router.prefetch("/map_page");
    router.prefetch("/green_solutions")
  }, [router])

  useEffect(() => {
    import("@/components/map/map_wrapper")
  })

  return (
    <main>
      <div className="min-h-screen bg-gradient-to-br from-white to-green-100 overflow-x-hidden"> 
        {/*top nav bar*/}
        <Navbar landing={true} />

        <div className="mt-25">
            {/*hero section*/}
            <div className="flex items-center justify-evenly gap-4"> 
              <div className="flex flex-col items-start gap-2">
                <h1 className="text-6xl font-semibold text-neutral-black text-left">
                  Turn Heat Maps<br className="block mt-1"/> into <span className="text-primary-green">Green Maps</span>
                </h1>
                <Link href="/home_dashboard" 
                  className="flex items-center justify-center text-lg text-white border-2 border-white bg-primary-green py-2 px-6 rounded-full 
                  font-semibold mt-8 mb-16 
                  hover:bg-primary-green/90 hover:text-white
                  transition-colors">
                    Get Started
                    <ChevronRight size={20} className="ml-2" />
                </Link>
                <h2 className="text-neutral-black/60 font-normal text-xl max-w-2xl mb-2">
                  Data-driven pathways to greener and healthier cities.
                </h2>   
                <div className="flex flex-row gap-3 w-full">
                  <div className="flex flex-col w-1/4 items-center justify-center text-primary-green/60 hover:text-primary-green/80 bg-white/50 border border-primary-green/50 rounded-md py-2 gap-1 hover:shadow-md hover:translate-y-[-2px] transition-all duration-300"> 
                    <Sprout size={24} />
                      <h3 className="text-sm font-medium">NDVI</h3>
                  </div>
                  <div className="flex flex-col w-1/4 items-center justify-center text-primary-green/60 hover:text-primary-green/80 bg-white/50 border border-primary-green/50 rounded-md py-2 gap-1 hover:shadow-md hover:translate-y-[-2px] transition-all duration-300"> 
                    <Thermometer size={24} />
                    <h3 className="text-sm font-medium">LST</h3>
                  </div>
                  <div className="flex flex-col w-1/4 items-center justify-center text-primary-green/60 hover:text-primary-green/80 bg-white/50 border border-primary-green/50 rounded-md py-2 gap-1 hover:shadow-md hover:translate-y-[-2px] transition-all duration-300"> 
                    <TreeDeciduous size={24} />
                    <h3 className="text-sm font-medium">Tree Canopy</h3>
                  </div>
                </div>
              </div>   
              <div 
                className="flex flex-col gap-4"
                style={{ 
                  transform: 'rotateX(45deg) rotateZ(15deg)',
                  transformStyle: 'preserve-3d',
                  transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h1 className="text-neutral-black text-2xl font-medium">Mandaue City</h1>
                    <h2 className="text-neutral-black/50 text-xl">October 20</h2>
                  </div>
                  <div className="flex items-center gap-2 font-medium border-2 border-primary-green/50 bg-white text-primary-green px-4 py-2 rounded-full">
                    <Leaf size={24} className="text-primary-green" />
                    GI = 0.94 (High)
                  </div>
                </div>
                <div className="w-[430px] h-[480px] border-4 border-primary-green/50 overflow-hidden rounded-lg shadow-2xl">
                  <BarangayProvider>
                    <MandaueMap settings={false} />
                  </BarangayProvider>
                </div>
              </div>
            </div>

            {/*cards container*/}
            <div className="my-5 mx-40 flex flex-col space-y-4">
              <InfoCard
                imageSrc="/images/landingpage/greeningmapper.png"
                imageAlt="placeholder image"
                icon={<Map size={32} color="#16881B" />}
                title="GIS-Based Greening Mapper"
                description="Displays multi-hazard hotspots such as Urban Heat Islands, flood and storm surge, 
                as well as air pollution, with toggle-able layers and a greenery index map. This makes use of 
                geospatial datasets including land surface temperature, hazard maps, pollution, and socioeconomic indicators."
                priority={true}
              />

              <InfoCard
                imageSrc="https://dummyimage.com/500x400/000/00ffd5.png"
                imageAlt="placeholder image"
                icon={<Sprout size={32} color="#16881B" />}
                title="Greenery Index (GI) Computation"
                description="GI measures greenness of an area across quantity, accessibility & equity, 
                environmental quality & resilience, and connectivity & biodiversity potential. This will be used to identify
                areas of high priority, as well as aid in deciding efficient and appropriate greening solutions."
              />

              <InfoCard
                imageSrc="/images/landingpage/greeningsolutions.png"
                imageAlt="placeholder image"
                icon={<BrainCircuit size={32} color="#16881B" />}
                title="AI-Driven Greening Recommendation Engine"
                description="Processes the computed GI and other data to generate site-specific greening interventions such as street trees, pocket parks, green roofs, and more. 
                This makes use of machine learning models to estimate cooling effects, pollutant reduction, and resilience benefits for the suggested interventions.
                The engine is trained with data from studies proposing greening solutions, observed pre/post greening impacts, and simulations from ENVI-met and similar urban."
              />

              <InfoCard
                imageSrc="/images/landingpage/imageuploading.png"
                imageAlt="placeholder image"
                icon={<Camera size={32} color="#16881B" />}
                title="Community-Contributed Data"
                description="Allows users to upload geotagged photos of their areas they want to employ greening interventions.
                Employs computer vision algorithms to detect viable and effective greening interventions using the AI-driven greening recommendation engine."
              />

              <InfoCard
                imageSrc="/images/landingpage/dashboard.png"
                imageAlt="placeholder image"
                icon={<LayoutDashboard size={32} color="#16881B" />}
                title="Interactive Dashboard "
                description="Summarizes and visualizes the key metrics of a specific location such as greenery index, air quality status, heat and hazard exposures.
                It provides an overview of a hotspot and its specific intervention along with its projected benefits / impact."
              />
            </div>
          </div>
        </div>        
    </main>
  );
}
