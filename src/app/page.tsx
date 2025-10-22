import {Map, BrainCircuit, Camera, Sprout, LayoutDashboard} from "lucide-react"
import InfoCard from "../components/ui/general/cards/preview-infocard";
import Link from "next/link"
import Navbar from "@/components/ui/general/layout/navbar"
import { ChevronRight } from "lucide-react";

export default function Home() {
  return (
    <main>
      <div className="min-h-screen bg-gradient-to-br from-white to-green-100 overflow-x-hidden"> 
        {/*top nav bar*/}
        <Navbar landing={true} />

        <div className="mt-50">
            {/*hero section*/}
            <div className="flex flex-col items-center gap-8 mt-30 mb-30"> 
              <div className="flex flex-col items-center gap-2">
                <h1 className="text-5xl font-semibold text-neutral-black text-center">
                  Turn Heat Maps into{" "}
                  <span className="text-primary-green">Green Maps</span>
                </h1>
                <h2 className="text-neutral-black/90 font-normal text-xl max-w-2xl">
                  Data-driven pathways to cooler, healthier, and more resilient cities.
                </h2>     
              </div>   
              <Link href="/home_dashboard" className="flex items-center justify-center text-lg text-white bg-primary-green py-2 px-6 rounded-full font-semibold mt-8 hover:bg-green-600 transition-colors">
                  Get Started
                  <ChevronRight size={20} className="ml-2" />
              </Link>     
            </div>

            {/*cards container*/}
            <div className="my-10 mx-40 flex flex-col space-y-4">
              <InfoCard
                imageSrc="https://dummyimage.com/500x400/000/00ffd5.png"
                imageAlt="placeholder image"
                icon={<Map size={32} color="#16881B" />}
                title="GIS-Based Greening Mapper"
                description="Displays multi-hazard hotspots such as Urban Heat Islands, flood and storm surge, 
                as well as air pollution, with toggle-able layers and a greenery index map. This makes use of 
                geospatial datasets including land surface temperature, hazard maps, pollution, and socioeconomic indicators."
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
                imageSrc="https://dummyimage.com/500x400/000/00ffd5.png"
                imageAlt="placeholder image"
                icon={<BrainCircuit size={32} color="#16881B" />}
                title="AI-Driven Greening Recommendation Engine"
                description="Processes the computed GI and other data to generate site-specific greening interventions such as street trees, pocket parks, green roofs, and more. 
                This makes use of machine learning models to estimate cooling effects, pollutant reduction, and resilience benefits for the suggested interventions.
                The engine is trained with data from studies proposing greening solutions, observed pre/post greening impacts, and simulations from ENVI-met and similar urban."
              />

              <InfoCard
                imageSrc="https://dummyimage.com/500x400/000/00ffd5.png"
                imageAlt="placeholder image"
                icon={<Camera size={32} color="#16881B" />}
                title="Community-Contributed Data"
                description="Allows users to upload geotagged photos of their areas they want to employ greening interventions.
                Employs computer vision algorithms to detect viable and effective greening interventions using the AI-driven greening recommendation engine."
              />

              <InfoCard
                imageSrc="https://dummyimage.com/500x400/000/00ffd5.png"
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
