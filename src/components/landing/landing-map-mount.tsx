"use client";

import dynamic from "next/dynamic";
import { memo, useEffect, useRef, useState } from "react";

const MandaueMap = dynamic(
  () => import("@/components/ui/dashboard/ChloropletMap"),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-full w-full items-center justify-center bg-neutral-900 text-sm font-medium text-neutral-500"
        aria-hidden
      />
    ),
  },
);

const StableLandingMandaueMap = memo(function StableLandingMandaueMap({
  settings,
}: {
  settings: boolean;
}) {
  return <MandaueMap settings={settings} />;
});

/**
 * Defers downloading/parsing the Leaflet choropleth chunk until the map column
 * is near the viewport (or after a short fallback).
 *
 * heroMode: renders map edge-to-edge with no border/radius, for use as a full-screen background.
 */
export default function LandingMapMount({
  settings,
  heroMode = false,
}: {
  settings: boolean;
  heroMode?: boolean;
}) {
  const [show, setShow] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin: "280px 0px", threshold: 0 },
    );
    io.observe(el);

    const fallback = window.setTimeout(() => {
      setShow(true);
      io.disconnect();
    }, 4000);

    return () => {
      window.clearTimeout(fallback);
      io.disconnect();
    };
  }, []);

  if (heroMode) {
    return (
      <div ref={sentinelRef} className="w-full h-full bg-neutral-900">
        {show ? (
          <StableLandingMandaueMap settings={settings} />
        ) : (
          <div className="h-full w-full bg-neutral-900" aria-hidden />
        )}
      </div>
    );
  }

  return (
    <div
      ref={sentinelRef}
      className="w-full h-[260px] sm:h-[320px] md:h-[380px] lg:w-[430px] lg:h-[480px] border-2 sm:border-4 border-primary-green/40 dark:border-emerald-500/30 overflow-hidden rounded-lg sm:rounded-xl shadow-xl shadow-black/5 dark:shadow-black/30 bg-white dark:bg-neutral-900"
    >
      {show ? (
        <StableLandingMandaueMap settings={settings} />
      ) : (
        <div
          className="flex h-full min-h-[260px] w-full items-center justify-center bg-emerald-50/50 text-sm font-medium text-neutral-500"
          aria-hidden
        >
          Loading map…
        </div>
      )}
    </div>
  );
}
