import MapboxMap from "@/components/map/mapbox_map"
import Image from "next/image"
import Navbar from "@/components/ui/navbar"

export default function MapPage() {
  return (
    <main className="h-screen w-screen relative bg-gradient-to-br from-white to-green-100">
      {/* top nav bar */}
      <Navbar />
      <div className="h-full w-full flex overflow-hidden">                
        {/* <MapboxMap /> */}
      </div>
		</main>
  )
}

