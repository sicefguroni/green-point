"use client"

import Image from "next/image"
import Link from "next/link"
import { Home, Leaf, Map } from "lucide-react"
import { usePathname } from "next/navigation"

export default function Navbar({ landing = false }: { landing?: boolean }) {
  const pathname = usePathname()
  const isActive = (path: string) => pathname === path

  return (
    <div className="border py-3 px-7 mt-4 m-8 bg-white/80 backdrop-blur-lg rounded-lg shadow-lg/5 flex flex-row justify-between items-center absolute top-0 left-0 right-0 z-50">
      {/* logo temprary */}
      <Link
      href={'/'}      
      >
        <Image 
        width={130}
        height={50}
        className="object-cover"
        src="/images/logo/GreenPointWordLogo.png"
        alt="GreenPoint Logo"
        />
      </Link>
      {landing ? (
        <div className="flex items-center justify-between gap-2">
          <Link href="/signup" className="text-neutral-black  text-sm justify-center  py-2 px-3 rounded-sm font-medium  font-poppins">
            Sign Up
          </Link>
          <Link href="/login" className="text-white bg-primary-green hover:bg-green-600 transition-colors text-sm not-even:font-medium py-2 px-4 rounded-sm font-poppins">
            Login
          </Link>
        </div>
      ) : (
        <>  
          <div className="flex flex-row justify-between items-center space-x-4 m-0">
            <Link href="/home_dashboard"
              className={`p-2 rounded-lg transition ${isActive("/home_dashboard") ? "bg-green-400" : "hover:bg-neutral-200"}`}
            >
              <Home size={24} className={`${isActive("/home_dashboard") ? "text-white" : "text-neutral-black/80"}`} />
            </Link>

            <Link href="/map_page"
              className={`p-2 rounded-lg transition ${isActive("/map_page") ? "bg-green-400" : "hover:bg-neutral-200"}`}
            >
              <Map size={24} className={`${isActive("/map_page") ? "text-white" : "text-neutral-black/80"}`} />
            </Link>

            <Link  href="/green_solutions"
              className={`p-2 rounded-lg transition ${isActive("/green_solutions") ? "bg-green-400" : "hover:bg-neutral-200"}`}
            >
              <Leaf size={24} className={`${isActive("/green_solutions") ? "text-white" : "text-neutral-black/80"}`} />
            </Link>
          </div>
        
          <div>
            <Image
              src="https://avatar.iran.liara.run/public/9"
              alt="placeholder avatar"
              width={40}
              height={40}
            />
          </div>
        </>
      )}
    </div>
  )
}