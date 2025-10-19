"use client";
import { useEffect, useState } from 'react';
import { getGreeneryColor } from '@/lib/chloroplet-colors';
import { mergeGI } from '@/lib/MergeGI';
import { useBarangay } from '@/context/BarangayContext';
import dynamic from 'next/dynamic';

import GreeneryLegend from './greeneryLegend';
import 'leaflet/dist/leaflet.css';

// Dynamically import the map component to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then(mod => mod.GeoJSON), { ssr: false });

export default function MandaueMap() {
  const [geoData, setGeoData] = useState(null);
  const [isClient, setIsClient] = useState(false);
  const { selectedBarangay, setSelectedBarangay } = useBarangay();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/geo/mandaue_barangay_boundaries.json').then(res => res.json()),
      fetch('/geo/mandaue_barangays_gi.geojson').then(res => res.json()),
    ])
      .then(([boundaries, gi]) => mergeGI(boundaries, gi))
      .then(setGeoData)
      .catch(err => console.error("GeoJSON load error:", err));
  }, []);

  const onEachFeature = (feature: any, layer: any) => {
    if (feature.properties && feature.properties.name) {
      layer.bindTooltip(`<b>${feature.properties.name}</b>`, {
        direction: 'top',
        sticky: false,
        permanent: false,
      }).openTooltip();
      
      // Add hover effects
      layer.on('mouseover', function(e) {
        layer.setStyle({
          fillColor: getGreeneryColor(feature.properties.greenery_index),
          weight: 2,
          opacity: 1,
          color: "white",
          dashArray: "3",
          fillOpacity: 0.4,
        });
        
        // Show tooltip on hover
        layer.openTooltip();
      });

      // Mouse away from the barangay boundary -> revert to default style
      layer.on('mouseout', function(e) {
        layer.setStyle({
          fillColor: getGreeneryColor(feature.properties.greenery_index),
          weight: 1,
          opacity: 1,
          color: "white",
          dashArray: "3",
          fillOpacity: 1,
        });
        
        // Close tooltip on mouse out
        layer.closeTooltip();
      });

      layer.on("click", (e) => {
        // Close all other popups first
        layer._map.eachLayer((l) => {
          if (l.closePopup) l.closePopup();
        });
    
        setSelectedBarangay({
          name: feature.properties.name,
          greeneryIndex: feature.properties.greenery_index,
          ndvi: feature.properties.ndvi,
          lst: feature.properties.lst,
          treeCanopy: feature.properties.tree_canopy,
        });
        // Open a popup for the clicked feature
        layer.bindPopup(
          `<b>${feature.properties.name}</b>`
        ).openPopup();
      });
    }
  };

  // Default style for the barangay boundaries
  const style = (feature: any) => ({
    fillColor: getGreeneryColor(feature.properties.greenery_index),
    weight: 1,
    opacity: 1,
    color: "white",
    dashArray: "3",
    fillOpacity: 1,
  });

  if (!isClient) {
    return (
      <div className="w-full h-full rounded-lg overflow-hidden shadow flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-green mx-auto mb-2"></div>
          <p className="text-neutral-black/60">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-hidden shadow">
      <MapContainer
        center={[10.350564, 123.938147]} // Center near Mandaue City
        zoom={13}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap contributors"
        />
        {geoData && <GeoJSON data={geoData} style={style} onEachFeature={onEachFeature} />}
        <GreeneryLegend />
      </MapContainer>
    </div>
  );
}
