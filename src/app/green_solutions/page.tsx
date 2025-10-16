"use client"

import Navbar from "@/components/ui/general/layout/navbar"
import SearchBar from "@/components/ui/general/inputs/searchbar"
import { MapPin, Trees, Flower, Mountain, Cookie, ZoomOut, ZoomIn, Compass, Map} from "lucide-react"
import GreenSolutionCard from "@/components/ui/general/cards/greensolution-infocard"
import MapboxMap from "@/components/map/mapbox_map"

export default function GreenSolutionsPage() {
  return (
    <main className="min-h-screen w-screen relative bg-gradient-to-br from-white to-green-100">
      {/* top nav bar */}
      <Navbar />
      <div className="grid grid-cols-1 lg:grid-cols-2 w-full h-[calc(100vh-8rem)] px-8 pb-8 pt-32">
        {/* Left Side */}
        <div className="flex flex-col space-y-4 pr-0 lg:pr-4 h-[calc(100vh-10rem)]">
          <div className="flex flex-col justify-between items-start
          lg:flex-row lg:items-center">
            <h1 className="text-neutral-black font-poppins font-bold text-2xl 
            whitespace-nowrap overflow-hidden text-ellipsis">
              Greening Suggestions
            </h1>
            {/* this should be a link -- will change later on */}
            <h2 className="text-primary-darkgreen underline font-roboto
            whitespace-nowrap overflow-hidden text-ellipsis"> 
              Browse sample interventions
            </h2>                        
          </div>

          <p className="text-neutral-black text-lg leading-tight text-justify">
            See what greening interventions are suitable for your selected area.These aim to reduce the effects of environmental hazards and improve livability.
          </p>

          <div className="flex flex-col bg-white/60 backdrop-blur-lg rounded-xl
          shadow-xl shadow-neutral-300 flex-1 max-
          p-4 space-y-3 overflow-hidden
          ">

            {/* Current Location  */}
            <div className="flex items-center space-x-3 flex-row">
              <MapPin size={35} className="text-neutral-black shrink-0" />
              <div>
                <p className="font-semibold text-lg text-neutral-black">
                  University of the Philippines Cebu
                </p>
                <p className="text-md text-neutral-black/80 -mt-1 ">
                  Gorordo Ave., Cebu City, Cebu
                </p>
              </div>
            </div>

            <div className="-mx-4">
              <hr className="border-t border-1 border-neutral-black/30" />
            </div>

            <div className=" flex-1 overflow-y-auto [scrollbar-width:none] pr-2">

              <GreenSolutionCard 
                solutionTitle="Street Trees"
                solutionDescription="Trees planted along urban streets and walkways."
                efficiencyLevel="Highly Efficient"
                value={90}
                icon={<Trees size={60} />}
              />

              <hr className="border-t border-1 border-neutral-black/20" />

              <GreenSolutionCard 
                solutionTitle="Roof Gardens"
                solutionDescription="Gardens grown on the rooftops of buildings."
                efficiencyLevel="Moderately Efficient"
                value={60}
                icon={<Flower size={60} />}
              />

              <hr className="border-t border-1 border-neutral-black/20" />

              <GreenSolutionCard 
                solutionTitle="Mixed Blue-Green Corridors"
                solutionDescription="Urban pathways that combine water-based and vegetative features."
                efficiencyLevel="Not Efficient"
                value={30}
                icon={<Cookie size={60} />}
              />

              <hr className="border-t border-1 border-neutral-black/20" />

              <GreenSolutionCard 
                solutionTitle="PEAK"
                solutionDescription="Bingbong Airlines"
                efficiencyLevel="Not Efficient"
                value={20}
                icon={<Mountain size={60} />}
              />

            </div>        
          </div>   
        </div>       
        
        {/* Right Side */}
        <div className="bg-white/60 backdrop-blur-lg relative rounded-lg p-2">
          {/* <MapboxMap /> */}

          <div className="absolute top-0 left-0 m-4">
            <div className="p-3 rounded-xl
              bg-white/60 backdrop-blur-lg text-neutral-black/80 
              hover:bg-white/70 transition
            ">
              <Map 
                size={25}
                className="text-neutral-black/80"
              />
            </div>
          </div>

          {/* bottom right buttons  */}
          <div className="absolute bottom-0 right-0 m-4 flex flex-col space-y-2"> 
            <div className="p-3 rounded-xl
              bg-white/60 backdrop-blur-lg text-neutral-black/80 
              hover:bg-white/70 transition
            ">
              <Compass 
                size={25}
                className="text-neutral-black/80"
              />
            </div>

            <div className="p-3 rounded-xl
              bg-white/60 backdrop-blur-lg text-neutral-black/80 
              hover:bg-white/70 transition
            ">
              <ZoomIn 
                size={25}
                className="text-neutral-black/80"
              />
            </div>

            <div className="p-3 rounded-xl
              bg-white/60 backdrop-blur-lg text-neutral-black/80 
              hover:bg-white/70 transition
            ">
              <ZoomOut 
                size={25}
                className="text-neutral-black/80"
              />
            </div>            
          </div>         
        </div>                           
      </div>
    </main>
  )
}

