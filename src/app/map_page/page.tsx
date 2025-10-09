"use client"

import MapboxMap from "@/components/map/mapbox_map"
import Image from "next/image"
import Navbar from "@/components/ui/navbar"
import { ZoomIn, ZoomOut, Compass, Search, Layers } from "lucide-react"
import { useState } from "react"

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
      <div className="absolute top-26 left-0 ml-8">
        <div className={` 
          bg-white/60 py-2 pl-3 pr-2 rounded-xl backdrop-blur-lg
          hover:bg-white/70 overflow-hidden transition-all duration-200 ease-in-out
          ${isSearchFocused ? "h-100" : "h-15"}`}>
          <div className="flex flex-row items-center space-x-2">
            <Search 
              size={30}
              className="text-neutral-black/80"
            />
            <input 
              placeholder="Search locations"
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 150)}
              className="            
                rounded-lg
                pl-4 pr-10 md:pr-15 lg:pr-20 py-2                      
                text-xl text-neutral-black/80 font-roboto 
                placeholder:text-neutral-black/40
                border-none
                focus: outline-none focus:bg-white/30                        
              "          
            />            
          </div>
      </div>

      </div>

      {/* bottom right buttons  */}
      <div className="absolute bottom-0 right-0 m-8 flex flex-col space-y-2"> 
        <div className="p-3 rounded-xl
          bg-white/60 backdrop-blur-lg text-neutral-black/80 
          hover:bg-white/70
        ">
          <Compass 
            size={25}
            className="text-neutral-black/80"
          />
        </div>

        <div className="p-3 rounded-xl
          bg-white/60 backdrop-blur-lg text-neutral-black/80 
          hover:bg-white/70
        ">
          <ZoomIn 
            size={25}
            className="text-neutral-black/80"
          />
        </div>

        <div className="p-3 rounded-xl
          bg-white/60 backdrop-blur-lg text-neutral-black/80 
          hover:bg-white/70
        ">
          <ZoomOut 
            size={25}
            className="text-neutral-black/80"
          />
        </div>
      </div>

      {/* bottom left buttons  */}
      <div className="absolute flex flex-col bottom-0 leftt-0 m-8">
        <div className="py-3 px-4 rounded-xl
        flex flex-col space-y-1 items-center justify-center
          bg-white/60 backdrop-blur-lg text-neutral-black/80 
          hover:bg-white/70
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

