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

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

const DEFAULT_CENTER: [number, number] = [123.9427, 10.3279];
const DEFAULT_ZOOM = 12;

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

export default function MapboxMap({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
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
  const currentStyleRef = useRef(styleUrl);
  const [, setSelectedFeature] = useState<SelectedFeature | null>(null);

  // Helper to remove marker
  const removeMarker = useCallback(() => {
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, []);

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
    console.debug("MapboxMap: selected feature ->", selected);
    if (onFeatureSelected) {
      console.debug("MapboxMap: calling onFeatureSelected");
      onFeatureSelected(selected);
    }

    // Animate to location
    map.flyTo({ center: [coords.lng, coords.lat], zoom: 16, duration: 2000 });
  };

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

      // --- Dynamic LST Layer (NASA POWER – Earth Skin Temperature) ---
      if (!map.getSource("lstDynamicSource")) {
        map.addSource("lstDynamicSource", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        // Fetch real-time LST data from our API route
        fetch("/api/lst")
          .then((res) => res.json())
          .then((data) => {
            const src = map.getSource("lstDynamicSource");
            if (src && "setData" in src) {
              (src as mapboxgl.GeoJSONSource).setData(data);
            }
          })
          .catch((err) =>
            console.error("Failed to load dynamic LST data:", err),
          );
      }

      if (!map.getLayer("lstFillLayer")) {
        map.addLayer({
          id: "lstFillLayer",
          type: "fill",
          source: "lstDynamicSource",
          filter: ["==", "type", "surface"],
          layout: { visibility: "none" },
          paint: {
            "fill-color": [
              "interpolate",
              ["linear"],
              ["get", "temperature"],
              24,
              "#313695",
              26,
              "#4575b4",
              28,
              "#abd9e9",
              30,
              "#fee090",
              32,
              "#f46d43",
              34,
              "#d73027",
              36,
              "#a50026",
            ],
            "fill-opacity": 0.55,
            "fill-outline-color": "rgba(0,0,0,0)",
          },
        });
      }

      if (!map.getLayer("lstPointsLayer")) {
        map.addLayer({
          id: "lstPointsLayer",
          type: "circle",
          source: "lstDynamicSource",
          filter: ["==", "type", "label"],
          layout: { visibility: "none" },
          minzoom: 12,
          paint: {
            "circle-radius": 8,
            "circle-color": [
              "interpolate",
              ["linear"],
              ["get", "temperature"],
              24,
              "#313695",
              27,
              "#4575b4",
              29,
              "#abd9e9",
              31,
              "#fee090",
              33,
              "#f46d43",
              36,
              "#a50026",
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
            "circle-opacity": 0.9,
          },
        });
      }

      if (!map.getLayer("lstLabelsLayer")) {
        map.addLayer({
          id: "lstLabelsLayer",
          type: "symbol",
          source: "lstDynamicSource",
          filter: ["==", "type", "label"],
          layout: {
            visibility: "none",
            "text-field": [
              "concat",
              ["to-string", ["get", "temperature"]],
              "°C",
            ],
            "text-size": 11,
            "text-offset": [0, -1.5],
            "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
          },
          minzoom: 12,
          paint: {
            "text-color": "#1a1a1a",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.5,
          },
        });
      }

      // --- Dynamic Air Quality Layer (WAQI + Pollution Model) ---
      if (!map.getSource("aqiDynamicSource")) {
        map.addSource("aqiDynamicSource", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        fetch("/api/aqi")
          .then((res) => res.json())
          .then((data) => {
            const src = map.getSource("aqiDynamicSource");
            if (src && "setData" in src) {
              (src as mapboxgl.GeoJSONSource).setData(data);
            }
          })
          .catch((err) =>
            console.error("Failed to load dynamic AQI data:", err),
          );
      }

      if (!map.getLayer("aqiFillLayer")) {
        map.addLayer({
          id: "aqiFillLayer",
          type: "fill",
          source: "aqiDynamicSource",
          filter: ["==", "type", "surface"],
          layout: { visibility: "none" },
          paint: {
            "fill-color": [
              "interpolate",
              ["linear"],
              ["get", "aqi"],
              0,
              "#2DC937",
              50,
              "#A0DB17",
              100,
              "#E7B416",
              150,
              "#CC3232",
              200,
              "#800000",
            ],
            "fill-opacity": 0.5,
            "fill-outline-color": "rgba(0,0,0,0)",
          },
        });
      }

      if (!map.getLayer("aqiPointsLayer")) {
        map.addLayer({
          id: "aqiPointsLayer",
          type: "circle",
          source: "aqiDynamicSource",
          filter: ["==", "type", "label"],
          layout: { visibility: "none" },
          minzoom: 12,
          paint: {
            "circle-radius": 8,
            "circle-color": [
              "interpolate",
              ["linear"],
              ["get", "aqi"],
              0,
              "#2DC937",
              50,
              "#A0DB17",
              100,
              "#E7B416",
              150,
              "#CC3232",
              200,
              "#800000",
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
            "circle-opacity": 0.9,
          },
        });
      }

      if (!map.getLayer("aqiLabelsLayer")) {
        map.addLayer({
          id: "aqiLabelsLayer",
          type: "symbol",
          source: "aqiDynamicSource",
          filter: ["==", "type", "label"],
          layout: {
            visibility: "none",
            "text-field": ["concat", "AQI ", ["to-string", ["get", "aqi"]]],
            "text-size": 10,
            "text-offset": [0, -1.5],
            "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
          },
          minzoom: 12,
          paint: {
            "text-color": "#1a1a1a",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.5,
          },
        });
      }
    },
    [layerColors],
  );

  const addBarangayBounds = useCallback((map: mapboxgl.Map) => {
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
          "fill-opacity": 0,
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
          "line-opacity": 0,
        },
      });
    }
  }, []);

  const syncLayerStyles = useCallback(
    (map: mapboxgl.Map) => {
      const isVisible = (id: string, group: string) =>
        layerVisibility[group as keyof typeof layerVisibility] &&
        layerSpecificSelected[group as keyof typeof layerSpecificSelected] ===
          id;

      // Update Flood Layers
      ["floodLayer5Yr", "floodLayer25Yr", "floodLayer100Yr"].forEach((id) => {
        if (map.getLayer(id)) {
          const active = isVisible(id, "floodLayer");
          map.setLayoutProperty(id, "visibility", active ? "visible" : "none");
          map.setPaintProperty(id, "fill-opacity", active ? 0.6 : 0);
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
          const active = isVisible(id, "stormLayer");
          map.setLayoutProperty(id, "visibility", active ? "visible" : "none");
          map.setPaintProperty(id, "fill-opacity", active ? 0.6 : 0);
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

      // Toggle all dynamic LST sub-layers together
      ["lstFillLayer", "lstPointsLayer", "lstLabelsLayer"].forEach(
        (layerId) => {
          if (map.getLayer(layerId)) {
            map.setLayoutProperty(
              layerId,
              "visibility",
              layerVisibility.heatLayer ? "visible" : "none",
            );
          }
        },
      );

      ["aqiFillLayer", "aqiPointsLayer", "aqiLabelsLayer"].forEach(
        (layerId) => {
          if (map.getLayer(layerId)) {
            map.setLayoutProperty(
              layerId,
              "visibility",
              layerVisibility.airLayer ? "visible" : "none",
            );
          }
        },
      );

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
    },
    [layerVisibility, layerColors, layerSpecificSelected],
  );

  useEffect(() => {
    if (!mapContainer.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: styleUrl,
      center,
      zoom,
    });

    mapRef.current = map;

    // Layer and Event setup on style load
    const handleStyleLoad = () => {
      addBarangayBounds(map);
      addHazardLayers(map);
      syncLayerStyles(map);
      if (onMapReady) onMapReady(map, removeMarker);
    };

    map.on("style.load", handleStyleLoad);

    // Interaction Listeners
    const handleMapClick = (e: mapboxgl.MapMouseEvent) => {
      if (selectionMode === "poi") {
        const poiFeatures = map.queryRenderedFeatures(e.point, {
          layers: ["poi-label"],
        });
        if (poiFeatures.length > 0) {
          const brgyFeatures = map.queryRenderedFeatures(e.point, {
            layers: ["barangayBounds"],
          });
          const brgyName =
            brgyFeatures[0]?.properties?.name || "Unknown Barangay";
          handleFeatureSelection(poiFeatures[0], e.lngLat, brgyName);
        }
      } else if (selectionMode === "barangay") {
        const brgyFeatures = map.queryRenderedFeatures(e.point, {
          layers: ["barangayBounds"],
        });
        if (brgyFeatures.length > 0) {
          const name = brgyFeatures[0].properties?.name;
          // Treat barangay clicks like a feature selection so callers
          // receive a full SelectedFeature object and the UI can
          // consistently open the bottom sheet.
          handleFeatureSelection(brgyFeatures[0], e.lngLat, name);
          if (onBarangaySelected) onBarangaySelected(name);
          map.setPaintProperty("barangayBounds", "fill-color", [
            "match",
            ["get", "name"],
            name,
            "#FFD700",
            "#00FF00",
          ]);
        }
      }
    };

    const handleMouseMove = (e: mapboxgl.MapMouseEvent) => {
      if (selectionMode === "barangay") {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["barangayBounds"],
        });
        map.getCanvas().style.cursor = features.length > 0 ? "pointer" : "";
      }
    };

    const handleAQIClick = (e: mapboxgl.MapLayerMouseEvent) => {
      const feat = e.features?.[0] as unknown as AirQualityFeature;
      if (!feat) return;
      new mapboxgl.Popup()
        .setLngLat(feat.geometry.coordinates as [number, number])
        .setHTML(
          `
          <div class="p-3 font-roboto">
            <h4 class="font-bold text-lg mb-1">${feat.properties.city_name}</h4>
            <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-neutral-600">
              <span>AQI:</span> <span class="font-bold text-neutral-900">${feat.properties["main.aqi"]}</span>
              <span>PM2.5:</span> <span class="text-neutral-900">${feat.properties["components.pm2_5"]}</span>
              <span>O3:</span> <span class="text-neutral-900">${feat.properties["components.o3"]}</span>
              <span>NO2:</span> <span class="text-neutral-900">${feat.properties["components.no2"]}</span>
            </div>
          </div>
        `,
        )
        .addTo(map);
    };

    map.on("click", handleMapClick);
    map.on("mousemove", handleMouseMove);
    map.on("click", "airQualityLayer", handleAQIClick);
    map.on("click", "aqiPointsLayer", (e: mapboxgl.MapLayerMouseEvent) => {
      const feat = e.features?.[0];
      if (!feat || feat.geometry.type !== "Point") return;
      const p = feat.properties;
      const coords = (feat.geometry as GeoJSON.Point).coordinates as [
        number,
        number,
      ];
      new mapboxgl.Popup({ closeButton: true, maxWidth: "240px" })
        .setLngLat(coords)
        .setHTML(
          `<div class="p-2 font-roboto">
            <h4 class="font-bold text-sm mb-1">Air Quality</h4>
            <p class="text-lg font-semibold" style="color:${
              (p?.aqi ?? 0) <= 50
                ? "#2DC937"
                : (p?.aqi ?? 0) <= 100
                  ? "#E7B416"
                  : "#CC3232"
            }">AQI ${p?.aqi} — ${p?.levelLabel}</p>
            <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-neutral-600 mt-1">
              <span>PM2.5:</span><span class="font-medium">${p?.pm25} µg/m³</span>
              <span>PM10:</span><span class="font-medium">${p?.pm10} µg/m³</span>
              <span>NO₂:</span><span class="font-medium">${p?.no2} µg/m³</span>
              <span>O₃:</span><span class="font-medium">${p?.o3} µg/m³</span>
              <span>SO₂:</span><span class="font-medium">${p?.so2} µg/m³</span>
            </div>
            <p class="text-[10px] text-neutral-400 mt-1.5">Source: WAQI / AQICN</p>
          </div>`,
        )
        .addTo(map);
    });

    // LST point click → show temperature popup
    map.on("click", "lstPointsLayer", (e: mapboxgl.MapLayerMouseEvent) => {
      const feat = e.features?.[0];
      if (!feat || feat.geometry.type !== "Point") return;
      const temp = feat.properties?.temperature;
      const rawDate = feat.properties?.date as string | undefined;
      const dateStr = rawDate
        ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
        : "N/A";
      const coords = (feat.geometry as GeoJSON.Point).coordinates as [
        number,
        number,
      ];
      new mapboxgl.Popup({ closeButton: true, maxWidth: "220px" })
        .setLngLat(coords)
        .setHTML(
          `<div class="p-2 font-roboto">
            <h4 class="font-bold text-sm mb-1">Surface Temperature</h4>
            <p class="text-lg font-semibold" style="color:#b2182b">${temp}°C</p>
            <p class="text-xs text-neutral-500">Date: ${dateStr}</p>
            <p class="text-xs text-neutral-400">Source: NASA POWER</p>
          </div>`,
        )
        .addTo(map);
    });
    map.addControl(new mapboxgl.NavigationControl(), "bottom-right");
    map.addControl(new mapboxgl.ScaleControl(), "bottom-right");

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [selectionMode, center, zoom]); // Only re-init if core settings change (stable thanks to DEFAULT_CENTER)

  /**
   * Resize Map and Window Sync
   */
  useEffect(() => {
    if (!mapContainer.current || !mapRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    });

    resizeObserver.observe(mapContainer.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (mapRef.current && mapRef.current.isStyleLoaded()) {
      // Only call sync if style is already properly loaded
      syncLayerStyles(mapRef.current);
    }
  }, [syncLayerStyles]);

  useEffect(() => {
    if (mapRef.current && currentStyleRef.current !== styleUrl) {
      currentStyleRef.current = styleUrl;
      mapRef.current.setStyle(styleUrl);
    }
  }, [styleUrl]);

  return (
    <div className="relative w-full h-full bg-neutral-100">
      <div ref={mapContainer} className={className} />

      {/* Dynamic Search Box */}
      <div className={`absolute ${searchBoxLocation} z-10 hidden lg:block`}>
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
