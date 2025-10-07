"use client"

import Image from "next/image"
import Link from "next/link"
import { Home, Leaf, Map } from "lucide-react"
import { usePathname } from "next/navigation"

export default function Navbar() {
  const pathname = usePathname()
  const isActive = (path: string) => pathname === path

  return (
    <div className="py-4 px-7 m-8 bg-white/60 backdrop-blur-lg rounded-2xl shadow-lg/5 flex flex-row justify-between items-center absolute top-0 left-0 right-0 z-50">
      {/* logo temprary */}
      <h1 className="text-neutral-black text-2xl font-bold">
        GreenPoint
      </h1>

      <div className="flex flex-row justify-between items-center space-x-6 m-0">
        <Link href="/home_dashboard"
          className={`p-2 rounded-lg transition ${isActive("/home_dashboard") ? "bg-green-400" : "hover:bg-neutral-200"}`}
        >
          <Home size={30} className="text-neutral-black/80" />
        </Link>

        <Link href="/map_page"
          className={`p-2 rounded-lg transition ${isActive("/map_page") ? "bg-green-400" : "hover:bg-neutral-200"}`}
        >
          <Map size={30} className="text-neutral-black/80" />
        </Link>

        <Link  href="/green_solutions"
          className={`p-2 rounded-lg transition ${isActive("/green_solutions") ? "bg-green-400" : "hover:bg-neutral-200"}`}
        >
          <Leaf size={30} className="text-neutral-black/80" />
        </Link>
      </div>

      <div>
        <Image
          src="https://avatar.iran.liara.run/public/9"
          alt="placeholder avatar"
          width={60}
          height={60}
        />
      </div>
    </div>
  )
}