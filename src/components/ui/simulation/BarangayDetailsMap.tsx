// components/BarangayDetailMap.tsx
"use client"

import { useEffect } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import type { FeatureCollection, Feature } from "geojson";
import { useBarangay } from "@/context/BarangayContext";
import { useGeoData } from "@/context/geoDataStore";

function FitBoundsToFeature({ feature }: { readonly feature: Feature }) {
  const map = useMap();

  useEffect(() => {
    const layer = L.geoJSON(feature);
    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.1));
    }
  }, [feature, map]);

  return null;
}

export default function BarangayDetailMap() {
  const { simulationBarangay } = useBarangay();
  const geoData = useGeoData((state) => state.geoData);

  if (!simulationBarangay || !geoData) return <p>Select a barangay first.</p>;

  const feature = geoData.features.find(
    (f: Feature) => f.properties?.name?.toLowerCase() === simulationBarangay.name.toLowerCase()
  );

  if (!feature) return <p>Selected barangay geometry not found.</p>;

  const singleFeature: FeatureCollection = {
    type: "FeatureCollection",
    features: [feature],
  };

  return (
    <div className="h-96 w-full shadow rounded-lg overflow-hidden">
      <MapContainer 
        zoom={15} 
        center={[10.35, 123.94]} 
        style={{ height: "100%", width: "100%" }}
        dragging={false}
        zoomControl={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false} keyboard={false}
        >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <GeoJSON
          key={simulationBarangay.name}
          data={singleFeature} // ONLY THIS BARANGAY
          style={() => ({
            fillColor: "#31a354",
            fillOpacity: 0.6,
            color: "green",
            weight: 1,
          })}
        >
          <FitBoundsToFeature feature={feature} />
        </GeoJSON>
      </MapContainer>
    </div>
  );
}
