"use client";

import { SearchBox } from "@mapbox/search-js-react";
import mapboxgl from "mapbox-gl";

interface MapboxSearchBarProps {
  map: mapboxgl.Map | null;
}

export default function MapboxSearchBar({ map }: MapboxSearchBarProps) {
  return (
    <div className="absolute top-0 left-0 w-80 z-10">
      <SearchBox
        accessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string}
        map={map!}
        placeholder="Search for a location..."
        onRetrieve={(res) => {
          if (map && res.features.length > 0) {
            const [lng, lat] = res.features[0].geometry.coordinates;
            map.flyTo({ center: [lng, lat], zoom: 12 });
          }
        }}        
      />
    </div>
  );
}
