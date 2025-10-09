"use client"

import MapboxMap from "@/components/map/mapbox_map"
import Navbar from "@/components/ui/general/layout/navbar"
import { ZoomIn, ZoomOut, Compass, Search, Layers } from "lucide-react"
import { useState } from "react"
import SearchBar from "@/components/ui/general/inputs/searchbar"

export default function MapPage() {
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  
  return (
    <main className="h-screen w-screen relative bg-gradient-to-br from-white to-green-100">
      {/* top nav bar */}
      <Navbar />
      <div className="h-full w-full flex overflow-hidden bg-neutral-500">                
        {/* <MapboxMap /> */}
      </div>

      {/* search bar */}
      <div className="absolute top-26 left-0 ml-8 w-sm md:w-md lg:w-lg xl:w-xl">
        <SearchBar 
          placeholder="Search Locations"
        />

      </div>

      {/* bottom right buttons  */}
      <div className="absolute bottom-0 right-0 m-8 flex flex-col space-y-2"> 
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
          hover:bg-white/70 transitiontransition
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

      {/* bottom left buttons  */}
      <div className="absolute flex flex-col bottom-0 left-0 m-8">
        <div className="py-3 px-4 rounded-xl
        flex flex-col space-y-1 items-center justify-center
          bg-white/60 backdrop-blur-lg text-neutral-black/80 
          hover:bg-white/70 transition
        ">          
          <Layers 
            size={25}
            className="text-neutral-black/80"
          />
          <p className="font-semibold font-robot text-neutral-black/80">
            Layers
          </p>
        </div>
      </div>
		</main>
  )
}

