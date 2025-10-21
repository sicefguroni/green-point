"use client"

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css";
import { SearchBox } from '@mapbox/search-js-react';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

interface LayerVisibility {
  [layerId: string]: boolean;
}

interface LayerSpecificSelected {
  [layerId: string]: string;
}

interface LayerColors {
  [layerId: string]: string[];
}

interface MapboxMapProps {
  center?: [number, number];
  zoom?: number;
  className?: string;
  styleUrl: string;
  layerVisibility: LayerVisibility;
  layerColors: LayerColors;
  layerSpecificSelected: LayerSpecificSelected;
  searchBoxLocation: string;
  onFeatureSelected?: (featureData: {
    name:string; 
    coords: {lng:number, lat:number };
    address: string;
    properties?: Record<string, any> ;
  }) => void; 
  onMapReady?: (map: mapboxgl.Map) => void;
}

export default function MapboxMap({
  center = [123.9427, 10.3279], //default mandaue city
  zoom = 12,
  className = 'w-full h-full overflow-hidden',
  styleUrl,
  layerVisibility,
  layerColors,
  layerSpecificSelected,
  searchBoxLocation,
  onFeatureSelected,
  onMapReady,
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const[selectedFeature, setSelectedFeature] = useState<any | null>(null)
  
  const handleFeatureSelection = async (feature: any, coords: {lng: number, lat: number}) => {
    const map = mapRef.current
    if(!map) return

    const name = feature.properties?.name || (feature as any).text || "Unnamed Point";

    if (markerRef.current) markerRef.current.remove();

    markerRef.current = new mapboxgl.Marker({ color: "#DB4848" })
      .setLngLat([coords.lng, coords.lat])
      .addTo(map);

    //get address
    const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${coords.lng},${coords.lat}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`;
    let address = "Unknown Address"
    try {
      const response = await fetch(geocodeUrl);
      const data = await response.json();
      if(data.features && data.features.length > 0) { 
        address = data.features[0].place_name        
      } 
    } catch (error) {
      console.error("Error fetching address:", error)
    }

    new mapboxgl.Popup()
      .setLngLat([coords.lng, coords.lat])
      .addTo(map);
      
      const selected = {
        name,
        coords, 
        address,
        properties: feature.properties,
      }

      setSelectedFeature(selected);
      
      if(onFeatureSelected) onFeatureSelected(selected)

      map.flyTo({ center: [coords.lng, coords.lat], zoom: 16, duration: 2000});
  }

  useEffect(() => {
    if (mapRef.current) return;    

    const map = new mapboxgl.Map({
      container: mapContainer.current as HTMLDivElement,
      style: styleUrl,
      center,
      zoom,
    });

    mapRef.current = map

    map.on('load', () => {
      // FLOOD LAYERz
      if(onMapReady) onMapReady(map);
      const floodLayers = [
        { id: "floodLayer5Yr", source: "flood5YrSource", sourcelayer: "CebuFlood5Yr-94pdig", url: "mapbox://ishah-bautista.0dovx0j1" },
        { id: "floodLayer25Yr", source: "flood25YrSource", sourcelayer: "CebuFlood25Yr-78cmai", url: "mapbox://ishah-bautista.3vk3xhh6" },
        { id: "floodLayer100Yr", source: "flood100YrSource", sourcelayer: "Cebu100yrFlood-cieuwj", url: "mapbox://ishah-bautista.1ok5a1p3" },
      ]

      floodLayers.forEach(({ id, source, sourcelayer, url }) => {
        map.addSource(source, {
          type: "vector",
          url: url,
        });

        map.addLayer({          
          id: id,
          type: "fill",
          source: source, "source-layer": sourcelayer,
          layout: { 'visibility': (layerVisibility.floodLayer && layerSpecificSelected.floodLayer == id) ? 'visible' : 'none' },
          paint: {
            "fill-color": [
              "match",
              ["get", "Var"],
              1, layerColors.floodLayer[0],
              2, layerColors.floodLayer[1],
              3, layerColors.floodLayer[2],
              "#0096C7"
            ],
            "fill-opacity": 0.6
          },
        });
      })

      // STORM SURGE LAYER
      const stormLayers = [
        { id: "stormLayerAdv1", source: "stormLayerAdv1Source", sourcelayer: "Cebu-cmq2hs", url: "mapbox://ishah-bautista.b6msnt87" },
        { id: "stormLayerAdv2", source: "stormLayerAdv2Source", sourcelayer: "CebuStormAdv2-48ipdj", url: "mapbox://ishah-bautista.60kjmx60" },
        { id: "stormLayerAdv3", source: "stormLayerAdv3Source", sourcelayer: "CebuStormAdv3-cdzon5", url: "mapbox://ishah-bautista.5di27ycb" },
        { id: "stormLayerAdv4", source: "stormLayerAdv4Source", sourcelayer: "CebuStormAdv4-980nqk", url: "mapbox://ishah-bautista.8nkmgnnn" },
      ]

      stormLayers.forEach(({ id, source, sourcelayer, url }) => {
        map.addSource(source, {
          type: "vector",
          url: url,
        });

        map.addLayer({
          id: id,
          type: "fill",
          source: source, "source-layer": sourcelayer,
          layout: { 'visibility': (layerVisibility.stormLayer && layerSpecificSelected.stormLayer == id) ? 'visible' : 'none' },
          paint: {
            "fill-color": [
              "match",
              ["get", "HAZ"],
              1, layerColors.stormLayer[0],
              2, layerColors.stormLayer[1],
              3, layerColors.stormLayer[2],
              "#9333ea"
            ],
            "fill-opacity": 0.6
          }
        });
      })

    });

    // for selecting features by clicking on the map
    map.on('click', (e) => {
      const features = map.queryRenderedFeatures(e.point, { 
        layers: ['poi-label']       
      }); 
      
      if (!features.length) return;
      const feature = features[0];
      
      handleFeatureSelection(feature, e.lngLat)
    });
  

    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
    map.addControl(new mapboxgl.ScaleControl(), 'bottom-right')

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [styleUrl, layerVisibility, layerColors, layerSpecificSelected,]);

  return (
    <div ref={mapContainer} className={className}>
      <div className={searchBoxLocation}>
        <div>          
          <SearchBox
            accessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string}
            map={mapRef.current!}
            mapboxgl={mapboxgl}
            placeholder="Search for a location..."
            onRetrieve={(res) => {
              if (mapRef.current && res.features.length > 0) {
                const feature = res.features[0]
                const [lng, lat] = feature.geometry.coordinates;                
                handleFeatureSelection(feature, {lng, lat})
              }
            }}            
            marker
          />
        </div>      
      </div>
    </div>
  )
}