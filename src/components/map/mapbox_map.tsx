"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { SearchBox } from "@mapbox/search-js-react";
import { type LocationSelectionMode } from "@/types/maplayers";
import {
  getAirQualityData,
  getFloodData,
  getStormData,
} from "@/lib/api/get_hazard_data";
import { FeatureHazardData, SelectedFeature } from "@/types/metrics";

// Configure Mapbox Token
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

interface MapboxMapProps {
  center?: [number, number];
  zoom?: number;
  className?: string;
  styleUrl: string;
  layerVisibility: Record<string, boolean>;
  layerColors: Record<string, string[]>;
  layerSpecificSelected: Record<string, string>;
  searchBoxLocation: string;
  onFeatureSelected?: (featureData: SelectedFeature) => void;
  onBarangaySelected?: (barangayName: string) => void;
  onMapReady?: (map: mapboxgl.Map, removeMarker: () => void) => void;
  selectionMode: LocationSelectionMode;
}

/**
 * Main Mapbox Map Component
 * Handles rendering, layer management, and user interaction with the Mapbox GL map.
 */
export default function MapboxMap({
  center = [123.9427, 10.3279], // Default: Mandaue City
  zoom = 12,
  className = "w-full h-full overflow-hidden",
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
  const [, setSelectedFeature] = useState<SelectedFeature | null>(null);

  // Helper to remove marker
  const removeMarker = useCallback(() => {
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, []);

  /**
   * Handles user selection of a point on the map
   */
  const handleFeatureSelection = async (
    feature: mapboxgl.GeoJSONFeature,
    coords: { lng: number; lat: number },
    barangay: string,
  ) => {
    const map = mapRef.current;
    if (!map) return;

    const name = feature.properties?.name || "Unnamed Point";

    // Update marker
    removeMarker();
    markerRef.current = new mapboxgl.Marker({ color: "#DB4848" })
      .setLngLat([coords.lng, coords.lat])
      .addTo(map);

    // Fetch address using reverse geocoding
    const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${coords.lng},${coords.lat}.json?access_token=${mapboxgl.accessToken}`;
    let address = "Unknown Address";
    try {
      const response = await fetch(geocodeUrl);
      const data = await response.json();
      if (data.features && data.features.length > 0) {
        address = data.features[0].place_name;
      }
    } catch (error) {
      console.error("Error fetching address:", error);
    }

    // Get hazard data for the selected location
    const point = map.project([coords.lng, coords.lat]);
    const hazards: FeatureHazardData = {
      flood: getFloodData(map, point),
      storm: getStormData(map, point),
      air: await getAirQualityData(),
    };

    const selected: SelectedFeature = {
      name,
      coords,
      address,
      properties: feature.properties,
      barangay,
      hazards,
    };

    setSelectedFeature(selected);
    if (onFeatureSelected) onFeatureSelected(selected);

    // Animate to location
    map.flyTo({ center: [coords.lng, coords.lat], zoom: 16, duration: 2000 });
  };

  /**
   * Initializes Hazard Layers (Flood, Storm Surge, Heat, Air Quality)
   */
  const addHazardLayers = useCallback(
    (map: mapboxgl.Map) => {
      // --- Flood Layers ---
      const floodLayers = [
        {
          id: "floodLayer5Yr",
          source: "flood5YrSource",
          sourcelayer: "CebuFlood5Yr-94pdig",
          url: "mapbox://ishah-bautista.0dovx0j1",
        },
        {
          id: "floodLayer25Yr",
          source: "flood25YrSource",
          sourcelayer: "CebuFlood25Yr-78cmai",
          url: "mapbox://ishah-bautista.3vk3xhh6",
        },
        {
          id: "floodLayer100Yr",
          source: "flood100YrSource",
          sourcelayer: "Cebu100yrFlood-cieuwj",
          url: "mapbox://ishah-bautista.1ok5a1p3",
        },
      ];

      floodLayers.forEach(({ id, source, sourcelayer, url }) => {
        if (!map.getSource(source))
          map.addSource(source, { type: "vector", url });
        if (!map.getLayer(id)) {
          map.addLayer({
            id,
            type: "fill",
            source,
            "source-layer": sourcelayer,
            layout: { visibility: "none" },
            paint: {
              "fill-color": [
                "match",
                ["get", "Var"],
                1,
                layerColors.floodLayer[0],
                2,
                layerColors.floodLayer[1],
                3,
                layerColors.floodLayer[2],
                "#0096C7",
              ],
              "fill-opacity": 0.6,
            },
          });
        }
      });

      // --- Storm Surge Layers ---
      const stormLayers = [
        {
          id: "stormLayerAdv1",
          source: "stormLayerAdv1Source",
          sourcelayer: "Cebu-cmq2hs",
          url: "mapbox://ishah-bautista.b6msnt87",
        },
        {
          id: "stormLayerAdv2",
          source: "stormLayerAdv2Source",
          sourcelayer: "CebuStormAdv2-48ipdj",
          url: "mapbox://ishah-bautista.60kjmx60",
        },
        {
          id: "stormLayerAdv3",
          source: "stormLayerAdv3Source",
          sourcelayer: "CebuStormAdv3-cdzon5",
          url: "mapbox://ishah-bautista.5di27ycb",
        },
        {
          id: "stormLayerAdv4",
          source: "stormLayerAdv4Source",
          sourcelayer: "CebuStormAdv4-980nqk",
          url: "mapbox://ishah-bautista.8nkmgnnn",
        },
      ];

      stormLayers.forEach(({ id, source, sourcelayer, url }) => {
        if (!map.getSource(source))
          map.addSource(source, { type: "vector", url });
        if (!map.getLayer(id)) {
          map.addLayer({
            id,
            type: "fill",
            source,
            "source-layer": sourcelayer,
            layout: { visibility: "none" },
            paint: {
              "fill-color": [
                "match",
                ["get", "HAZ"],
                1,
                layerColors.stormLayer[0],
                2,
                layerColors.stormLayer[1],
                3,
                layerColors.stormLayer[2],
                "#9333ea",
              ],
              "fill-opacity": 0.6,
            },
          });
        }
      });

      // --- LST (Heat Map) Layer ---
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
          layout: { visibility: "none" },
          paint: { "raster-opacity": 0.75 },
        });
      }

      // --- Air Quality Layer ---
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
          layout: { visibility: "none" },
          paint: {
            "circle-color": [
              "interpolate",
              ["linear"],
              ["get", "main.aqi"],
              1,
              "#2DC937",
              2,
              "#A0DB17",
              3,
              "#E7B416",
              4,
              "#CC3232",
              5,
              "#800000",
            ],
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              5,
              9,
              12,
              13,
            ],
            "circle-opacity": 0.8,
          },
        });
      }
    },
    [layerColors],
  );

  /**
   * Initializes Barangay Boundaries Layer
   */
  const addBarangayBounds = useCallback(
    (map: mapboxgl.Map) => {
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
          layout: { visibility: "visible" },
          paint: {
            "fill-color": "#00FF00",
            "fill-opacity": 0, // Managed by visibility effect
          },
        });
      }

      if (!map.getLayer("barangayBoundsOutline")) {
        map.addLayer({
          id: "barangayBoundsOutline",
          type: "line",
          source: "barangayBoundsSource",
          "source-layer": "mandaue_barangay_boundaries-7byvux",
          layout: { visibility: "visible" },
          paint: {
            "line-color": "#1F6B07",
            "line-width": 2,
            "line-opacity": 0, // Managed by visibility effect
          },
        });
      }

      // Set up hover and click events for barangay selection
      if (selectionMode === "barangay") {
        let hoveredId: string | null = null;
        let clickedId: string | null = null;

        const updateColors = () => {
          map.setPaintProperty("barangayBounds", "fill-color", [
            "match",
            ["get", "name"],
            clickedId || "___none___",
            "#FFD700",
            hoveredId || "___none___",
            "#FFD700",
            "#00FF00",
          ]);
        };

        map.on("mousemove", "barangayBounds", (e) => {
          if (!e.features?.length) return;
          const name = e.features[0].properties?.name;
          if (hoveredId !== name) {
            hoveredId = name;
            updateColors();
          }
        });

        map.on("mouseleave", "barangayBounds", () => {
          hoveredId = null;
          updateColors();
        });

        map.on("click", "barangayBounds", (e) => {
          if (!e.features?.length) return;
          const name = e.features[0].properties?.name;
          clickedId = name;
          updateColors();
          if (onBarangaySelected) onBarangaySelected(name);
        });
      }
    },
    [selectionMode, onBarangaySelected],
  );

  /**
   * Map Initialization and View Updates
   */
  useEffect(() => {
    if (!mapContainer.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: styleUrl,
      center,
      zoom,
    });

    mapRef.current = map;

    map.on("load", () => {
      addBarangayBounds(map);
      addHazardLayers(map);
      if (onMapReady) onMapReady(map, removeMarker);
    });

    // Handle POI selection
    if (selectionMode === "poi") {
      map.on("click", (e) => {
        const poiFeatures = map.queryRenderedFeatures(e.point, {
          layers: ["poi-label"],
        });
        if (!poiFeatures.length) return;

        const barangayFeatures = map.queryRenderedFeatures(e.point, {
          layers: ["barangayBounds"],
        });
        const barangayName =
          barangayFeatures[0]?.properties?.name || "Unknown Barangay";

        handleFeatureSelection(poiFeatures[0], e.lngLat, barangayName);
      });
    }

    // Air Quality Popup
    map.on("click", "airQualityLayer", (e) => {
      const feature = e.features?.[0] as unknown as AirQualityFeature;
      if (!feature) return;

      const props = feature.properties;
      const coords = feature.geometry.coordinates as [number, number];

      new mapboxgl.Popup()
        .setLngLat(coords)
        .setHTML(
          `
          <div class="p-2">
            <strong>${props.city_name}</strong><br/>
            AQI: ${props["main.aqi"]}<br/>
            NH3: ${props["components.nh3"]}<br/>
            NO2: ${props["components.no2"]}<br/>
            O3: ${props["components.o3"]}<br/>
            PM2.5: ${props["components.pm2_5"]}<br/>
            PM10: ${props["components.pm10"]}<br/>
            SO2: ${props["components.so2"]}
          </div>
        `,
        )
        .addTo(map);
    });

    map.addControl(new mapboxgl.NavigationControl(), "bottom-right");
    map.addControl(new mapboxgl.ScaleControl(), "bottom-right");

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [selectionMode, center, zoom]); // Re-init on significant changes

  /**
   * Update layer styles when base map style changes
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    const currentPitch = map.getPitch();
    const currentBearing = map.getBearing();

    map.setStyle(styleUrl);

    map.once("styledata", () => {
      addHazardLayers(map);
      addBarangayBounds(map);
      if (onMapReady) onMapReady(map, removeMarker);
      map.jumpTo({
        center: currentCenter,
        zoom: currentZoom,
        bearing: currentBearing,
        pitch: currentPitch,
      });
    });
  }, [styleUrl, addHazardLayers, addBarangayBounds, onMapReady, removeMarker]);

  /**
   * Synchronize Layer Visibilities and Colors
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Update Flood Layers
    ["floodLayer5Yr", "floodLayer25Yr", "floodLayer100Yr"].forEach((id) => {
      if (map.getLayer(id)) {
        const isSelected =
          layerVisibility.floodLayer && layerSpecificSelected.floodLayer === id;
        map.setLayoutProperty(id, "visibility", "visible");
        map.setPaintProperty(id, "fill-opacity", isSelected ? 0.6 : 0.001);
        map.setPaintProperty(id, "fill-color", [
          "match",
          ["get", "Var"],
          1,
          layerColors.floodLayer[0],
          2,
          layerColors.floodLayer[1],
          3,
          layerColors.floodLayer[2],
          "#0096C7",
        ]);
      }
    });

    // Update Storm Layers
    [
      "stormLayerAdv1",
      "stormLayerAdv2",
      "stormLayerAdv3",
      "stormLayerAdv4",
    ].forEach((id) => {
      if (map.getLayer(id)) {
        const isSelected =
          layerVisibility.stormLayer && layerSpecificSelected.stormLayer === id;
        map.setLayoutProperty(id, "visibility", "visible");
        map.setPaintProperty(id, "fill-opacity", isSelected ? 0.6 : 0.001);
        map.setPaintProperty(id, "fill-color", [
          "match",
          ["get", "HAZ"],
          1,
          layerColors.stormLayer[0],
          2,
          layerColors.stormLayer[1],
          3,
          layerColors.stormLayer[2],
          "#9333ea",
        ]);
      }
    });

    // Update Raster/Circle Layers
    if (map.getLayer("lstLayerDay")) {
      map.setLayoutProperty(
        "lstLayerDay",
        "visibility",
        layerVisibility.heatLayer ? "visible" : "none",
      );
    }

    if (map.getLayer("airQualityLayer")) {
      map.setLayoutProperty(
        "airQualityLayer",
        "visibility",
        layerVisibility.airLayer ? "visible" : "none",
      );
    }

    // Update Barangay Bounds
    if (map.getLayer("barangayBounds")) {
      map.setPaintProperty(
        "barangayBounds",
        "fill-opacity",
        layerVisibility.barangayBoundsLayer ? 0.1 : 0,
      );
    }
    if (map.getLayer("barangayBoundsOutline")) {
      map.setPaintProperty(
        "barangayBoundsOutline",
        "line-opacity",
        layerVisibility.barangayBoundsLayer ? 0.7 : 0,
      );
    }
  }, [layerVisibility, layerColors, layerSpecificSelected]);

  return (
    <div className="relative w-full h-full bg-neutral-100">
      <div ref={mapContainer} className={className} />

      {/* Dynamic Search Box */}
      <div className={`absolute ${searchBoxLocation} z-10`}>
        <SearchBox
          accessToken={mapboxgl.accessToken || ""}
          map={mapRef.current!}
          mapboxgl={mapboxgl}
          placeholder="Search for a location..."
          onRetrieve={async (res) => {
            if (mapRef.current && res.features.length > 0) {
              const feature = res
                .features[0] as unknown as mapboxgl.GeoJSONFeature;
              if (feature.geometry.type === "Point") {
                const [lng, lat] = feature.geometry.coordinates;
                const barangayFeatures = mapRef.current.queryRenderedFeatures(
                  mapRef.current.project([lng, lat]),
                  { layers: ["barangayBounds"] },
                );
                const name =
                  barangayFeatures[0]?.properties?.name || "Unknown Barangay";
                handleFeatureSelection(feature, { lng, lat }, name);
              }
            }
          }}
          marker
        />
      </div>
    </div>
  );
}
