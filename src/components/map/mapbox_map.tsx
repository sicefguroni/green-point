"use client"

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css";
import { SearchBox } from '@mapbox/search-js-react';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

interface AirQualityFeature {
  properties: {
    city_name: string;
    "main.aqi": number;
    "components.nh3": number;
    "components.no": number;
    "components.no2": number;
    "components.o3": number;
    "components.pm2_5": number;
    "components.pm10": number;
    "components.so2": number;
  };
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
}

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

  const addHazardLayers = (map: mapboxgl.Map, forceVisibility: boolean) => {
    if (onMapReady) onMapReady(map);

    // --- FLOOD LAYERS ---
    const floodLayers = [
      { id: "floodLayer5Yr", source: "flood5YrSource", sourcelayer: "CebuFlood5Yr-94pdig", url: "mapbox://ishah-bautista.0dovx0j1" },
      { id: "floodLayer25Yr", source: "flood25YrSource", sourcelayer: "CebuFlood25Yr-78cmai", url: "mapbox://ishah-bautista.3vk3xhh6" },
      { id: "floodLayer100Yr", source: "flood100YrSource", sourcelayer: "Cebu100yrFlood-cieuwj", url: "mapbox://ishah-bautista.1ok5a1p3" },
    ];

    
    floodLayers.forEach(({ id, source, sourcelayer, url }) => {
      const visibility = forceVisibility
        ? layerVisibility.floodLayer && layerSpecificSelected.floodLayer === id
          ? "visible"
          : "none"
        : "visible"; // default when first loading

      if (!map.getSource(source)) {
        map.addSource(source, { type: "vector", url });
      }
      if (!map.getLayer(id)) {
        map.addLayer({
          id,
          type: "fill",
          source,
          "source-layer": sourcelayer,
          layout: {visibility},
          paint: {
            "fill-color": [
              "match",
              ["get", "Var"],
              1, layerColors.floodLayer[0],
              2, layerColors.floodLayer[1],
              3, layerColors.floodLayer[2],
              "#0096C7"
            ],
            "fill-opacity": 0.6,
          },
        });
      }
    });

    // --- STORM SURGE LAYERS ---
    const stormLayers = [
      { id: "stormLayerAdv1", source: "stormLayerAdv1Source", sourcelayer: "Cebu-cmq2hs", url: "mapbox://ishah-bautista.b6msnt87" },
      { id: "stormLayerAdv2", source: "stormLayerAdv2Source", sourcelayer: "CebuStormAdv2-48ipdj", url: "mapbox://ishah-bautista.60kjmx60" },
      { id: "stormLayerAdv3", source: "stormLayerAdv3Source", sourcelayer: "CebuStormAdv3-cdzon5", url: "mapbox://ishah-bautista.5di27ycb" },
      { id: "stormLayerAdv4", source: "stormLayerAdv4Source", sourcelayer: "CebuStormAdv4-980nqk", url: "mapbox://ishah-bautista.8nkmgnnn" },
    ];

    stormLayers.forEach(({ id, source, sourcelayer, url }) => {
      const visibility = forceVisibility
        ? layerVisibility.stormLayer && layerSpecificSelected.stormLayer === id
          ? "visible"
          : "none"
        : "none"; // default when first loading

      if (!map.getSource(source)) {
        map.addSource(source, { type: "vector", url });
      }
      if (!map.getLayer(id)) {
        map.addLayer({
          id,
          type: "fill",
          source,
          "source-layer": sourcelayer,
          layout: {visibility},
          paint: {
            "fill-color": [
              "match",
              ["get", "HAZ"],
              1, layerColors.stormLayer[0],
              2, layerColors.stormLayer[1],
              3, layerColors.stormLayer[2],
              "#9333ea",
            ],
            "fill-opacity": 0.6,
          },
        });
      }
    });

    // --- LST LAYER ---

    const lstVisibility = forceVisibility
    ? layerVisibility.heatLayer
      ? "visible"
      : "none"
    : "none";

    if (!map.getSource("lstLayerDaySource")) {
      map.addSource("lstLayerDaySource", {
        type: "raster",
        url: "mapbox://ishah-bautista.22nc71rq",
      });
    }
    if (!map.getLayer("lstLayerDay")) {
      map.addLayer({
        id: "lstLayerDay",
        type: "raster",
        source: "lstLayerDaySource",
        layout: { visibility: lstVisibility},
        paint: { "raster-opacity": 0.75 },
      });
    }

    const airVisibility = forceVisibility
    ? layerVisibility.airLayer
      ? "visible"
      : "none"
    : "none";

    // --- AIR QUALITY LAYER ---
    if (!map.getSource("airQualitySource")) {
      map.addSource("airQualitySource", {
        type: "vector",
        url: "mapbox://ishah-bautista.azkvxo9f",
      });
    }
    if (!map.getLayer("airQualityLayer")) {
      map.addLayer({
        id: "airQualityLayer",
        type: "circle",
        source: "airQualitySource",
        "source-layer": "combinedCitiesAirQualityPoint-66kxqv",
        layout: { visibility: airVisibility },
        paint: {
          "circle-color": [
            "interpolate",
            ["linear"],
            ["get", "main.aqi"],
            1, "#2DC937",
            2, "#A0DB17",
            3, "#E7B416",
            4, "#CC3232",
            5, "#800000",
          ],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 9, 12, 13],
          "circle-opacity": 0.8,
        },
      });
    }
  };

  // loading map instance first
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
      if(onMapReady) onMapReady(map)
      addHazardLayers(map, false)  
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
    
    map.on('click', 'airQualityLayer', (e) => {
      const feature = e.features?.[0] as unknown as AirQualityFeature;
      if (!feature) return;

      const city_name = feature.properties.city_name;
      const main_aqi = feature.properties["main.aqi"];
      const components_nh3 = feature.properties["components.nh3"];
      const components_no = feature.properties["components.no"];
      const components_no2 = feature.properties["components.no2"];
      const components_o3 = feature.properties["components.o3"];
      const components_p2_5 = feature.properties["components.pm2_5"];
      const components_10 = feature.properties["components.pm10"];
      const components_so2 = feature.properties["components.so2"];

      // console.log('feauture properties:', feature.properties)
      const coords = feature.geometry.coordinates as [number, number];

      new mapboxgl.Popup()
        .setLngLat(coords)
        .setHTML(`
          <div className="rounded-lg p-2">
          <strong>${city_name}</strong><br/>
          AQI Level: ${main_aqi}<br/>
          nh3 Level: ${components_nh3}<br/>
          no Level: ${components_no}<br/>
          no2 Level: ${components_no2}<br/>
          o3 Level: ${components_o3}<br/>
          pm2_5 Level: ${components_p2_5}<br/>
          pm10 Level: ${components_10}<br/>
          so2 Level: ${components_so2}<br/>
          </div>
          `)
        .addTo(map);
    });

    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
    map.addControl(new mapboxgl.ScaleControl(), 'bottom-right')

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // reloading for stylechange
  useEffect(() => {
    const map = mapRef.current;
    if(!map) return; 

    const center = map.getCenter();
    const zoom = map.getZoom();
    const  pitch = map.getPitch();
    const bearing = map.getBearing();
    
    map.setStyle(styleUrl);

    map.once("styledata", () => {
      console.log("changed!!")
      addHazardLayers(map, true)
      if (onMapReady) onMapReady(map);
      map.jumpTo({center, zoom, bearing, pitch})    
    })
  }, [styleUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // --- FLOOD LAYER VISIBILITY ---
    ["floodLayer5Yr", "floodLayer25Yr", "floodLayer100Yr"].forEach((id) => {
      if (map.getLayer(id)) {
        const visible =
          layerVisibility.floodLayer && layerSpecificSelected.floodLayer === id;
        map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");

        // Update fill color dynamically
        map.setPaintProperty(id, "fill-color", [
          "match",
          ["get", "Var"],
          1, layerColors.floodLayer[0],
          2, layerColors.floodLayer[1],
          3, layerColors.floodLayer[2],
          "#0096C7",
        ]);
      }
    });

    // --- STORM LAYER VISIBILITY ---
    ["stormLayerAdv1", "stormLayerAdv2", "stormLayerAdv3", "stormLayerAdv4"].forEach((id) => {
      if (map.getLayer(id)) {
        const visible =
          layerVisibility.stormLayer && layerSpecificSelected.stormLayer === id;
        map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");

        map.setPaintProperty(id, "fill-color", [
          "match",
          ["get", "HAZ"],
          1, layerColors.stormLayer[0],
          2, layerColors.stormLayer[1],
          3, layerColors.stormLayer[2],
          "#9333ea",
        ]);
      }
    });

    // --- LST LAYER ---
    if (map.getLayer("lstLayerDay")) {
      map.setLayoutProperty(
        "lstLayerDay",
        "visibility",
        layerVisibility.heatLayer ? "visible" : "none"
      );
    }

    // --- AIR QUALITY LAYER ---
    if (map.getLayer("airQualityLayer")) {
      map.setLayoutProperty(
        "airQualityLayer",
        "visibility",
        layerVisibility.airLayer ? "visible" : "none"
      );
    }
  }, [layerVisibility, layerColors, layerSpecificSelected]);

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