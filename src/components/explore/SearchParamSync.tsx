"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useBarangay, type BarangayData } from "@/context/BarangayContext";
import type { SelectedFeature } from "@/types/metrics";

export default function SearchParamSync({
  geoData,
  onFeatureFound,
}: {
  geoData: BarangayData[] | null;
  onFeatureFound: (f: SelectedFeature) => void;
}) {
  const searchParams = useSearchParams();
  const { setSelectedBarangay } = useBarangay();

  useEffect(() => {
    const lat = searchParams?.get("lat");
    const lng = searchParams?.get("lng");
    if (!lat || !lng || !geoData) return;

    const latVal = parseFloat(lat);
    const lngVal = parseFloat(lng);
    const address = decodeURIComponent(searchParams?.get("address") || "");
    const name = decodeURIComponent(
      searchParams?.get("name") || "Selected Location",
    );
    const barangay = decodeURIComponent(searchParams?.get("barangay") || "");

    const feature: SelectedFeature = {
      name,
      address,
      barangay,
      coords: { lng: lngVal, lat: latVal },
    };

    onFeatureFound(feature);

    const matched = geoData.find(
      (b) => b.name?.toLowerCase() === barangay.toLowerCase(),
    );
    if (matched) {
      setSelectedBarangay?.({
        ...matched,
        greeneryIndex: matched.greeneryIndex ?? 0,
        ndvi: matched.ndvi ?? 0,
        lst: matched.lst ?? 0,
        treeCanopy: matched.treeCanopy ?? 0,
      });
    }
  }, [searchParams, geoData, setSelectedBarangay, onFeatureFound]);

  return null;
}
