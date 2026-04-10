"use client";

import Image from "next/image";
import Link from "next/link";
import { Home, Map, Database, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useTransition, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useUserProfile } from "@/context/UserProfileContext";

const DataCatalogModal = dynamic(
  () => import("@/components/ui/dashboard/DataCatalogModal"),
  { ssr: false },
);

function LogoLink() {
  return (
    <Link href="/" className="flex-shrink-0 min-w-0 flex items-center">
      <Image
        width={120}
        height={40}
        className="object-contain h-7 sm:h-8 md:h-9 w-auto max-w-[88px] sm:max-w-[100px] md:max-w-[112px] lg:max-w-[128px]"
        src="/images/logo/GreenPointWordLogo.png"
        alt="GreenPoint Logo"
        priority
        sizes="(max-width: 640px) 88px, (max-width: 768px) 100px, (max-width: 1024px) 112px, 128px"
      />
    </Link>
  );
}

function NavBarChrome({
  children,
  isPending,
}: {
  children: ReactNode;
  isPending: boolean;
}) {
  return (
    <div>
      <div className="border border-neutral-200/80 dark:border-neutral-800 py-2 sm:py-2.5 md:py-3 px-3 sm:px-4 md:px-6 lg:px-7 mt-2 sm:mt-3 md:mt-4 mx-2 sm:mx-4 md:mx-6 lg:mx-8 mb-0 bg-white/90 dark:bg-neutral-950/85 backdrop-blur-lg rounded-xl shadow-md shadow-black/5 dark:shadow-black/30 flex flex-row justify-between items-center absolute top-0 left-0 right-0 z-50 gap-2 min-h-[2.75rem] sm:min-h-[3rem] md:min-h-[3.5rem]">
        {children}
      </div>
      {isPending && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-white/80 dark:bg-neutral-950/80 backdrop-blur-sm">
          <span className="text-sm sm:text-base font-medium text-neutral-black/80 dark:text-neutral-100/80 font-poppins animate-pulse">
            Loading...
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Marketing landing: no Supabase / profile context — smaller bundle and faster TTI.
 */
function NavbarLanding() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    router.prefetch("/home_dashboard");
    router.prefetch("/explore");
    router.prefetch("/profile");
  }, [router]);

  function handleNavigation(path: string) {
    startTransition(() => {
      router.push(path);
    });
  }

  return (
    <NavBarChrome isPending={isPending}>
      <LogoLink />
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          disabled={isPending}
          onClick={() => handleNavigation("/signup")}
          className="cursor-pointer text-neutral-black dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 active:bg-neutral-200 dark:active:bg-neutral-700 transition-colors text-xs sm:text-sm font-semibold font-poppins py-2.5 px-3 sm:px-4 rounded-lg touch-manipulation min-h-[2.5rem]"
        >
          Sign Up
        </button>
        <button
          disabled={isPending}
          onClick={() => handleNavigation("/login")}
          className="cursor-pointer text-white bg-primary-green hover:bg-primary-green/90 active:bg-primary-green/80 transition-colors text-xs sm:text-sm font-semibold font-poppins py-2.5 px-4 sm:px-5 rounded-lg touch-manipulation min-h-[2.5rem]"
        >
          Login
        </button>
      </div>
    </NavBarChrome>
  );
}

function NavbarApp() {
  const pathname = usePathname();
  const isActive = (path: string) => pathname === path;

  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [catalogMounted, setCatalogMounted] = useState(false);
  const { displayName, avatarUrl, loading: profileLoading } = useUserProfile();

  useEffect(() => {
    router.prefetch("/home_dashboard");
    router.prefetch("/explore");
    router.prefetch("/profile");
    router.prefetch("/settings");
  }, [router]);

  const iconButtonClass = (path: string) =>
    `cursor-pointer p-2 rounded-lg transition touch-manipulation min-w-[2.5rem] min-h-[2.5rem] flex items-center justify-center ${
      isActive(path)
        ? "bg-primary-green text-white dark:bg-primary-green dark:text-white"
        : "hover:bg-neutral-200 text-neutral-black/80 dark:hover:bg-neutral-800 dark:text-neutral-100/80"
    }`;

  function handleNavigation(path: string) {
    if (isActive(path)) return;
    startTransition(() => {
      router.push(path);
    });
  }

  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    displayName || "User",
  )}&background=2DC937&color=fff`;
  const navAvatarSrc = avatarUrl || fallbackAvatar;

  return (
    <div>
      <div className="border border-neutral-200/80 dark:border-neutral-800 py-2 sm:py-2.5 md:py-3 px-3 sm:px-4 md:px-6 lg:px-7 mt-2 sm:mt-3 md:mt-4 mx-2 sm:mx-4 md:mx-6 lg:mx-8 mb-0 bg-white/90 dark:bg-neutral-950/85 backdrop-blur-lg rounded-xl shadow-md shadow-black/5 dark:shadow-black/30 flex flex-row justify-between items-center absolute top-0 left-0 right-0 z-50 gap-2 min-h-[2.75rem] sm:min-h-[3rem] md:min-h-[3.5rem]">
        <Link href="/" className="flex-shrink-0 min-w-0 flex items-center">
          <Image
            width={120}
            height={40}
            className="object-contain h-7 sm:h-8 md:h-9 w-auto max-w-[88px] sm:max-w-[100px] md:max-w-[112px] lg:max-w-[128px]"
            src="/images/logo/GreenPointWordLogo.png"
            alt="GreenPoint Logo"
            priority
            sizes="(max-width: 640px) 88px, (max-width: 768px) 100px, (max-width: 1024px) 112px, 128px"
          />
        </Link>
        <>
          <nav
            className="flex flex-row items-center gap-0.5 sm:gap-1 md:gap-2 flex-shrink-0"
            aria-label="Main"
          >
            <button
              disabled={isPending}
              onClick={() => handleNavigation("/home_dashboard")}
              className={iconButtonClass("/home_dashboard")}
              aria-label="Home"
            >
              <Home size={20} className="sm:w-5 sm:h-5 md:w-6 md:h-6" />
            </button>
            <button
              disabled={isPending}
              onClick={() => handleNavigation("/explore")}
              className={iconButtonClass("/explore")}
              aria-label="Explore"
            >
              <Map size={20} className="sm:w-5 sm:h-5 md:w-6 md:h-6" />
            </button>
            <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-700 mx-1 hidden sm:block" />
            <button
              onClick={() => {
                setCatalogMounted(true);
                setIsCatalogOpen(true);
              }}
              className="cursor-pointer p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-black/80 dark:text-neutral-100/80 transition touch-manipulation min-w-[2.5rem] min-h-[2.5rem] flex items-center justify-center"
              aria-label="Data Catalog"
              title="View Data Sources & Methodology"
            >
              <Database size={20} className="sm:w-5 sm:h-5 md:w-6 md:h-6" />
            </button>
          </nav>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              disabled={isPending}
              onClick={() => handleNavigation("/settings")}
              className={iconButtonClass("/settings")}
              aria-label="Settings"
              title="Settings"
            >
              <Settings size={20} className="sm:w-5 sm:h-5 md:w-6 md:h-6" />
            </button>

            <Link
              href="/profile"
              className={`rounded-full overflow-hidden border-2 border-white/60 dark:border-neutral-700 bg-white/80 dark:bg-neutral-900/80 shadow-sm flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 ring-1 ring-neutral-200/50 dark:ring-neutral-700/50 transition hover:ring-primary-green/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-green ${isActive("/profile") ? "ring-2 ring-primary-green" : ""}`}
              aria-label="Open profile"
            >
              {profileLoading ? (
                <div
                  className="h-full w-full animate-pulse bg-neutral-200 dark:bg-neutral-700"
                  aria-hidden
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element -- dynamic user avatar URLs */
                <img
                  src={navAvatarSrc}
                  alt=""
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                />
              )}
            </Link>
          </div>
        </>
      </div>
      {isPending && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-white/80 dark:bg-neutral-950/80 backdrop-blur-sm">
          <span className="text-sm sm:text-base font-medium text-neutral-black/80 dark:text-neutral-100/80 font-poppins animate-pulse">
            Loading...
          </span>
        </div>
      )}
      {catalogMounted && (
        <DataCatalogModal
          isOpen={isCatalogOpen}
          onClose={() => setIsCatalogOpen(false)}
        />
      )}
    </div>
  );
}

export default function Navbar({ landing = false }: { landing?: boolean }) {
  if (landing) return <NavbarLanding />;
  return <NavbarApp />;
}
