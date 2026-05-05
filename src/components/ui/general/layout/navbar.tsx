"use client";

import Image from "next/image";
import Link from "next/link";
import { Home, Map, Database, Settings, User, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useTransition, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useUserProfile } from "@/context/UserProfileContext";
import { buildUiAvatarsUrl } from "@/lib/avatar/ui-avatars-url";

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
 * Marketing landing: checks authentication and shows profile or login/signup buttons
 */
function NavbarLanding() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { isAuthenticated, loading, displayName, avatarUrl } = useUserProfile();

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

  const fallbackAvatar = buildUiAvatarsUrl(displayName || "User");
  const navAvatarSrc = avatarUrl || fallbackAvatar;

  return (
    <NavBarChrome isPending={isPending}>
      <LogoLink />
      {isAuthenticated ? (
        <Link
          href="/profile"
          className="rounded-full overflow-hidden border-2 border-white/60 dark:border-neutral-700 bg-white/80 dark:bg-neutral-900/80 shadow-sm flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 ring-1 ring-neutral-200/50 dark:ring-neutral-700/50 transition hover:ring-primary-green/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-green"
          aria-label="Open profile"
        >
          {loading ? (
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
      ) : (
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
      )}
    </NavBarChrome>
  );
}

function LogoIconLink() {
  return (
    <Link href="/" className="flex-shrink-0 flex items-center justify-center transition-transform hover:scale-105 active:scale-95">
      <Image
        width={32}
        height={32}
        className="object-contain w-7 h-7 sm:w-8 sm:h-8"
        src="/images/logo/greenpointlogo.svg"
        alt="GreenPoint Logo"
        priority
      />
    </Link>
  );
}

function NavbarApp() {
  const pathname = usePathname();
  const isActive = (path: string) => pathname === path;

  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [catalogMounted, setCatalogMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Close sidebar when clicking outside or navigating
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    router.prefetch("/home_dashboard");
    router.prefetch("/explore");
    router.prefetch("/profile");
    router.prefetch("/settings");
  }, [router]);

  const iconButtonClass = (path: string) =>
    `cursor-pointer p-2 rounded-xl transition-all duration-200 touch-manipulation min-w-[2.25rem] min-h-[2.25rem] flex items-center justify-center ${
      isActive(path)
        ? "bg-primary-green text-white shadow-lg shadow-primary-green/20 scale-110"
        : "hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
    }`;

  function handleNavigation(path: string) {
    if (isActive(path)) return;
    startTransition(() => {
      router.push(path);
    });
  }

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed top-6 left-4 z-[40] p-2.5 bg-white/90 dark:bg-neutral-950/85 backdrop-blur-xl rounded-xl border border-neutral-200/80 dark:border-neutral-800 shadow-lg sm:hidden text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition-all duration-300 ${
          isOpen ? "opacity-0 pointer-events-none scale-75" : "opacity-100 scale-100"
        }`}
        aria-label="Open Menu"
      >
        <Menu size={20} />
      </button>

      {/* Backdrop overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-neutral-950/40 backdrop-blur-[2px] z-[45] sm:hidden animate-in fade-in duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={`border border-neutral-200/80 dark:border-neutral-800 py-6 px-2 fixed top-6 left-4 bottom-6 w-14 sm:w-16 bg-white/90 dark:bg-neutral-950/85 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/5 dark:shadow-black/30 flex flex-col items-center z-50 overflow-hidden transition-all duration-300 ${
          isOpen
            ? "translate-x-0 opacity-100"
            : "-translate-x-[calc(100%+2rem)] sm:translate-x-0 opacity-0 sm:opacity-100"
        }`}
      >
        <div className="flex flex-col items-center w-full h-full relative">
          {/* Mobile Close Button */}
          <button
            onClick={() => setIsOpen(false)}
            className="sm:hidden absolute -top-2 -right-1 p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
            aria-label="Close Menu"
          >
            <X size={16} />
          </button>

          {/* Top: Logo */}
          <LogoIconLink />

          <div className="w-8 h-px bg-neutral-100 dark:bg-neutral-800 my-6" />

          {/* Middle: Nav Icons */}
          <nav
            className="flex flex-col items-center gap-4 flex-grow w-full"
            aria-label="Main"
          >
            <button
              disabled={isPending}
              onClick={() => handleNavigation("/home_dashboard")}
              className={iconButtonClass("/home_dashboard")}
              aria-label="Home"
              title="Dashboard"
            >
              <Home size={18} className="sm:w-5 sm:h-5" />
            </button>
            <button
              disabled={isPending}
              onClick={() => handleNavigation("/explore")}
              className={iconButtonClass("/explore")}
              aria-label="Explore"
              title="Explore Map"
            >
              <Map size={18} className="sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={() => {
                setCatalogMounted(true);
                setIsCatalogOpen(true);
              }}
              className="cursor-pointer p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition-all duration-200 touch-manipulation min-w-[2.25rem] min-h-[2.25rem] flex items-center justify-center"
              aria-label="Data Catalog"
              title="Data Catalog"
            >
              <Database size={18} className="sm:w-5 sm:h-5" />
            </button>
          </nav>

          {/* Bottom: Profile and Settings */}
          <div className="flex flex-col items-center gap-4 mt-auto w-full pt-6">
            <button
              disabled={isPending}
              onClick={() => handleNavigation("/profile")}
              className={iconButtonClass("/profile")}
              aria-label="Profile"
              title="Profile"
            >
              <User size={18} className="sm:w-5 sm:h-5" />
            </button>
            <button
              disabled={isPending}
              onClick={() => handleNavigation("/settings")}
              className={iconButtonClass("/settings")}
              aria-label="Settings"
              title="Settings"
            >
              <Settings size={18} className="sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </aside>

      {isPending && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-white/60 dark:bg-neutral-950/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary-green" />
            <span className="text-sm font-bold text-neutral-800 dark:text-neutral-100 font-poppins tracking-tight">
              Loading...
            </span>
          </div>
        </div>
      )}
      {catalogMounted && (
        <DataCatalogModal
          isOpen={isCatalogOpen}
          onClose={() => setIsCatalogOpen(false)}
        />
      )}
    </>
  );
}


export default function Navbar({ landing = false }: { landing?: boolean }) {
  if (landing) return <NavbarLanding />;
  return <NavbarApp />;
}
