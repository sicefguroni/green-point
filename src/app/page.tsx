import Image from "next/image";
import {Map, BrainCircuit, Camera, Sprout, LayoutDashboard} from "lucide-react"
import InfoCard from "../components/ui/general/cards/preview-infocard";
import Link from "next/link"

export default function Home() {
  return (
    <main>
      <div className="min-h-screen bg-gradient-to-br from-white to-green-100 overflow-x-hidden"> 
        {/*top nav bar*/}
        <nav className="bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg/5 flex flex-row justify-between items-center top-0 left-0 right-0 z-50 p-5 fixed">
          {/*temprary to be replaced by logo*/}
          <Link
          href='\'
          >
            <Image
              src="/images/logo/GreenPointWordLogo.png"
              alt="placeholder avatar"
              width={150}
              height={50}
            />
          </Link>
          
          <div className="flex justify-between gap-5">
            <Link href="/login" className="text-neutral-black text-md font-medium py-1 px-7 rounded-2xl hover:bg-gray-200 transition font-poppins">
              Login
            </Link>
            <Link href="/signup" className="text-white bg-primary-green py-1 px-7 rounded-full font-medium hover:bg-green-700 transition font-poppins">
              Sign Up
            </Link>
          </div>
        </nav>

        <div className="mt-50">
            {/*hero section*/}
            <div className="flex flex-col items-center gap-2 mt-30 mb-20 mx-10 px-6">        
              <h1 className="text-6xl font-semibold mb-3 text-neutral-black text-center">
                Turn Heat Maps into{" "}
                <span className="text-primary-darkgreen">Green Maps</span>
              </h1>
              <h2 className="text-neutral-black/90 font-normal text-xl md:text-2xl max-w-xl text-center">
                Data-driven pathways to cooler, healthier, and more resilient cities.
              </h2>        
              <Link href="/home_dashboard" className="text-xl text-white bg-primary-green py-2 px-18 rounded-full font-semibold mt-7 hover:bg-green-700 transition">
                  Get Started
              </Link>     
            </div>

            {/*cards container*/}
            <div className="my-10 mx-20 flex flex-col space-y-8">
              <InfoCard
                imageSrc="https://dummyimage.com/500x400/000/00ffd5.png"
                imageAlt="placeholder image"
                icon={<Map size={50} color="#16881B" />}
                title="GIS-Based Greening Mapper"
                description="Displays multi-hazard hotspots such as Urban Heat Islands, flood and storm surge, 
                as well as air pollution, with toggle-able layers and a greenery index map. This makes use of 
                geospatial datasets including land surface temperature, hazard maps, pollution, and socioeconomic indicators"
              />

              <InfoCard
                imageSrc="https://dummyimage.com/500x400/000/00ffd5.png"
                imageAlt="placeholder image"
                icon={<Sprout size={50} color="#16881B" />}
                title="Greenery Index (GI) Computation"
                description="GI measures greenness of an area across quantity, accessibility & equity, 
                environmental quality & resilience, and connectivity & biodiversity potential. This will be used to identify
                areas of high priority, as well as aid in deciding efficient and appropriate greening solutions."
              />

              <InfoCard
                imageSrc="https://dummyimage.com/500x400/000/00ffd5.png"
                imageAlt="placeholder image"
                icon={<BrainCircuit size={50} color="#16881B" />}
                title="AI-Driven Greening Recommendation Engine"
                description="Processes the computed GI and other data to generate site-specific greening interventions such as street trees, pocket parks, green roofs, and more. 
                This makes use of machine learning models to estimate cooling effects, pollutant reduction, and resilience benefits for the suggested interventions.
                The engine is trained with data from studies proposing greening solutions, observed pre/post greening impacts, and simulations from ENVI-met and similar urban "
              />

              <InfoCard
                imageSrc="https://dummyimage.com/500x400/000/00ffd5.png"
                imageAlt="placeholder image"
                icon={<Camera size={50} color="#16881B" />}
                title="Community-Contributed Data"
                description="Allows users to upload geotagged photos of their areas they want to employ greening interventions.
                Employs computer vision algorithms to detect viable and effective greening interventions using the AI-driven greening recommendation engine."
              />

              <InfoCard
                imageSrc="https://dummyimage.com/500x400/000/00ffd5.png"
                imageAlt="placeholder image"
                icon={<LayoutDashboard size={50} color="#16881B" />}
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
