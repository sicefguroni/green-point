
import Navbar from "@/components/ui/navbar"

export default function MapPage() {
  return (
    <main className="h-screen w-screen relative bg-gradient-to-br from-white to-green-100">
      {/* top nav bar */}
      <Navbar />
      <div className="h-full w-full flex overflow-hidden justify-center items-center">            
        <h1 className="text-neutral-black/50 text-center text-5xl font-bold">
          DASHBOARD PLACEHOLDER
        </h1>
      </div>
    </main>
  )
}

