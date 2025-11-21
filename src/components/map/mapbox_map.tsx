"use client"

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css";
import { SearchBox } from '@mapbox/search-js-react'
import { type LocationSelectionMode } from "@/types/maplayers"
import { getAirQualityData, getFloodData, getStormData } from "@/lib/api/get_hazard_data";
import { FeatureHazardData, SelectedFeature } from "@/types/metrics";

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
  onFeatureSelected?: (featureData: SelectedFeature) => void; 
  onBarangaySelected?: (barangayName: string) => void;
  onMapReady?: (map: mapboxgl.Map, removeMarker: () => void) => void;
  selectionMode: LocationSelectionMode;
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
  onBarangaySelected,
  onMapReady,
  selectionMode,
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const[selectedFeature, setSelectedFeature] = useState<SelectedFeature | null>(null)
  
  const removeMarker = () => {
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }

  const handleFeatureSelection = async (feature: mapboxgl.GeoJSONFeature, coords: {lng: number, lat: number}, barangay: string) => {
    const map = mapRef.current
    if(!map) return

    const name = feature.properties?.name || "Unnamed Point";

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
    
    // Get hazard data
    const point = map.project([coords.lng, coords.lat]);
    const flood = getFloodData(map, point);
    const storm = getStormData(map, point);
    const air = await getAirQualityData(); 

    const hazards: FeatureHazardData = { flood, storm, air };

    const selected = {
      name,
      coords, 
      address,
      properties: feature.properties,
      barangay,
      hazards
    }

    setSelectedFeature(selected);
    
    if(onFeatureSelected) onFeatureSelected(selected)

    map.flyTo({ center: [coords.lng, coords.lat], zoom: 16, duration: 2000});
  }

  const addBarangayBounds = (map: mapboxgl.Map, forceVisibility: boolean) => {
    if(onMapReady) onMapReady(map, removeMarker);

    console.log("layervisibility:", layerVisibility)

    if (!map.getSource("barangayBoundsSource")) {
      map.addSource("barangayBoundsSource", {
        type: "vector",
        url: "mapbox://ishah-bautista.dtxcpd4f",
      });
    }

    if (!map.getLayer("barangayBounds")) {
      map.addLayer({
        id: "barangayBounds",
        type: "fill",
        source: "barangayBoundsSource",
        "source-layer": "mandaue_barangay_boundaries-7byvux",
        layout: { visibility: "visible"},
        paint: {
          "fill-color": "#00FF00",
          "fill-opacity": layerVisibility.barangayBoundsLayer ? 0.2 : 0,
        },
      });
    }

    if (!map.getLayer("barangayBoundsOutline")) {
      map.addLayer({
        id: "barangayBoundsOutline",
        type: "line",
        source: "barangayBoundsSource",
        "source-layer": "mandaue_barangay_boundaries-7byvux",
        layout: {
          visibility: "visible",
        },
        paint: {
          "line-color": "#1F6B07",     
          "line-width": 2,            
          "line-opacity": layerVisibility.barangayBoundsLayer ? 0.9 : 0,          
        },
      });
    };

    if(selectionMode === "barangay") {
      let hoveredBarangayName: string | null = null;
      let clickedBarangay: string | null = null; 
      
      map.on('mousemove', 'barangayBounds', (e) => {
        if (!e.features || e.features.length === 0) return;

        const feature = e.features[0];
        const name = feature.properties?.name as string;

        if (hoveredBarangayName && hoveredBarangayName !== name && hoveredBarangayName !== clickedBarangay) {
          map.setPaintProperty('barangayBounds', 'fill-color', [
            'match',
            ['get', 'name'],
            hoveredBarangayName || '', '#00FF00', // default
            clickedBarangay || '', '#FFD700', // keep selected color
            '#00FF00'
          ]);
        }

        //set hover color for current feature
        if (name !== clickedBarangay) {
          map.setPaintProperty('barangayBounds', 'fill-color', [
            'match',
            ['get', 'name'],
            name || '', '#FFD700', 
            clickedBarangay || '', '#FFD700', 
            '#00FF00'
          ]);
        }

        hoveredBarangayName = name;
      });

      map.on('mouseleave', 'barangayBounds', () => {
        if (!hoveredBarangayName) return;

        if (hoveredBarangayName !== clickedBarangay) {
          map.setPaintProperty('barangayBounds', 'fill-color', [
            'match',
            ['get', 'name'],
            clickedBarangay, '#FFD700',
            '#00FF00'
          ]);
        }

        hoveredBarangayName = null;
      });

      map.on('click', 'barangayBounds', () => {
        if (!hoveredBarangayName) return;
        
        if (clickedBarangay && clickedBarangay !== hoveredBarangayName) {
          map.setPaintProperty('barangayBounds', 'fill-color', [
            'match',
            ['get', 'name'],
            clickedBarangay, '#00FF00', // reset previous
            '#00FF00'
          ]);
        }

        clickedBarangay = hoveredBarangayName;
        map.setPaintProperty('barangayBounds', 'fill-color', [
          'match',
          ['get', 'name'],
          clickedBarangay, '#FFD700',
          '#00FF00'
        ]);
        
        if(onBarangaySelected) onBarangaySelected(clickedBarangay);
        console.log("Selected Barangay:", clickedBarangay);
      });
    }
  }

  const addHazardLayers = (map: mapboxgl.Map, forceVisibility: boolean) => {
    if (onMapReady) onMapReady(map, removeMarker);

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
        : layerVisibility.floodLayer && layerSpecificSelected.floodLayer === id ? "visible" : "none"; // default when first loading

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
      if(onMapReady) onMapReady(map, removeMarker)
      addBarangayBounds(map, false)
      addHazardLayers(map, false)  
    });

    // for selecting features by clicking on the map
    if(selectionMode === "poi") {
      map.on('click', (e) => {
        const features = map.queryRenderedFeatures(e.point, { 
          layers: ['poi-label']       
        }); 
        
        if (!features.length) return;
        const feature = features[0];
        
        const barangayfeatures = map.queryRenderedFeatures(e.point, {
          layers: ['barangayBounds']
        });
  
        if (!barangayfeatures.length) {
          console.log("No barangay found at clicked point");
          return;
        }
  
        const barangayFeature = barangayfeatures[0];
        const barangayName = barangayFeature.properties?.name || "Unknown Barangay";
  
        console.log("Clicked inside barangay:", barangayName);
  
        handleFeatureSelection(feature, e.lngLat, barangayName)
      });
    }

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
  }, [selectionMode])

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
      addBarangayBounds(map, true)
      if (onMapReady) onMapReady(map, removeMarker);
      map.jumpTo({center, zoom, bearing, pitch})    
    })
  }, [styleUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // --- FLOOD LAYER VISIBILITY ---
    ["floodLayer5Yr", "floodLayer25Yr", "floodLayer100Yr"].forEach((id) => {
      if (map.getLayer(id)) {
        const visible = layerVisibility.floodLayer && layerSpecificSelected.floodLayer === id;
        
        map.setLayoutProperty(id, "visibility", "visible"); 
        map.setPaintProperty(id, "fill-opacity", visible ? 0.6 : 0.01); 

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
        const visible = layerVisibility.stormLayer && layerSpecificSelected.stormLayer === id;
       
        map.setLayoutProperty(id, "visibility", "visible"); 
        map.setPaintProperty(id, "fill-opacity", visible ? 0.6 : 0.01); 

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

    // --- BARANGAY BOUNDARIES LAYER ---
    if (map.getLayer("barangayBounds")) {
      map.setPaintProperty("barangayBounds", "fill-opacity", layerVisibility.barangayBoundsLayer ? 0.1 : 0);
    }

    if (map.getLayer("barangayBoundsOutline")) {
      map.setPaintProperty("barangayBoundsOutline", "line-opacity", layerVisibility.barangayBoundsLayer ? 0.7 : 0);
    }
  }, [layerVisibility, layerColors, layerSpecificSelected]);
  

  return (
    <div className="relative w-full h-full bg-white">
      {/* Map container */}
      <div ref={mapContainer} className={className} />

      {/* Search box */}
      <div className={`absolute ${searchBoxLocation} z-10`}>
        <SearchBox
          accessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string}
          map={mapRef.current!}
          mapboxgl={mapboxgl}
          placeholder="Search for a location..."
          onRetrieve={async (res) => {
            if (mapRef.current && res.features.length > 0) {
              const feature = res.features[0] as unknown as mapboxgl.GeoJSONFeature;
              if (feature.geometry.type === 'Point') {
                const [lng, lat] = feature.geometry.coordinates;

                const barangayFeatures = mapRef.current.queryRenderedFeatures(
                  mapRef.current.project([lng, lat]), //convert coords to screen point
                  { layers: ["barangayBounds"] }
                );

                const polygonFeature = barangayFeatures.find(
                  (f): f is mapboxgl.GeoJSONFeature =>
                    f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"
                );
                
                const barangayName = polygonFeature?.properties?.name ?? "Unknown Barangay";

                handleFeatureSelection(feature as mapboxgl.GeoJSONFeature, { lng, lat }, barangayName);
              }
            }
          }}
          marker
        />
      </div>
    </div>
  );
}
