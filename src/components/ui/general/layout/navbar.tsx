"use client"

import Image from "next/image"
import Link from "next/link"
import { Home, Leaf, Map } from "lucide-react"
import { usePathname } from "next/navigation"
import { useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"

export default function Navbar({ landing = false }: { landing?: boolean }) {
  const pathname = usePathname()
  const isActive = (path: string) => pathname === path

  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    router.prefetch("/home_dashboard");
    router.prefetch("/map_page");
    router.prefetch("/green_solutions");
  }, [router]);

  function handleNavigation(path:string) {
    startTransition(() => {
      if(isActive(path)) return;
      
      startTransition(() => {
        router.push(path);
      });
    })
  }

  return (
    <div>

      <div className="border py-3 px-7 mt-4 m-8 bg-white/80 backdrop-blur-lg rounded-lg shadow-lg/5 flex flex-row justify-between items-center absolute top-0 left-0 right-0 z-50">
        {/* logo temprary */}
        <Link
        href={'/'}      
        >
          <Image 
          width={130}
          height={50}
          className="object-cover h-auto w-auto"
          src="/images/logo/GreenPointWordLogo.png"
          alt="GreenPoint Logo"  
          priority        
          />
        </Link>
        {landing ? (
          <div className="flex items-center justify-between gap-2">
            <button 
            disabled={isPending}
            onClick={() => handleNavigation('/home_dashboard')}
            className="cursor-pointer text-neutral-black hover:bg-neutral-100 transition-colors text-sm justify-center  py-2 px-3 rounded-sm font-medium  font-poppins">
              Sign Up
            </button>
            <button
            disabled={isPending}
            onClick={() => handleNavigation('/home_dashboard')}
            className="cursor-pointer text-white bg-primary-green hover:bg-green-600 transition-colors text-sm not-even:font-medium py-2 px-4 rounded-sm font-poppins">
              Login
            </button>
          </div>
        ) : (
          <>  
            <div className="flex flex-row justify-between items-center space-x-4 m-0">
              <button 
              disabled={isPending}
              onClick={() => handleNavigation('/home_dashboard')}
                className={` cursor-pointer p-2 rounded-lg transition ${isActive("/home_dashboard") ? "bg-green-400" : "hover:bg-neutral-200"}`}
              >
                <Home size={24} className={`${isActive("/home_dashboard") ? "text-white" : "text-neutral-black/80"}`} />
              </button>

              <button
              disabled={isPending}
                onClick={() => handleNavigation('/map_page')}
                className={`cursor-pointer p-2 rounded-lg transition ${isActive("/map_page") ? "bg-green-400" : "hover:bg-neutral-200"}`}
              >
                <Map size={24} className={`${isActive("/map_page") ? "text-white" : "text-neutral-black/80"}`} />
              </button>

              <button
              disabled={isPending}
                onClick={() => handleNavigation('/green_solutions')}
                className={`cursor-pointer p-2 rounded-lg transition ${isActive("/green_solutions") ? "bg-green-400" : "hover:bg-neutral-200"}`}
              >
                <Leaf size={24} className={`${isActive("/green_solutions") ? "text-white" : "text-neutral-black/80"}`} />
              </button>
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
      {isPending && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <span className="text-lg font-medium text-neutral-black/80 font-poppins animate-pulse">
            Loading...
          </span>
        </div>
      )}
    </div>
  );
}