"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import MapSearchBar from "./map_search";
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
  const barangayMaskRef = useRef<GeoJSON.MultiPolygon | null>(null);

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

  // Stable callback for the search bar to use on suggestion retrieval
  const handleSearchRetrieve = useCallback(
    (feature: { geometry: { type: string; coordinates: number[] }; properties: Record<string, unknown> }) => {
      if (mapRef.current && feature.geometry.type === "Point") {
        const [lng, lat] = feature.geometry.coordinates;
        const geoFeature = feature as unknown as mapboxgl.GeoJSONFeature;
        mapRef.current.flyTo({ center: [lng, lat], zoom: 16, duration: 1500 });
        mapRef.current.once("moveend", () => {
          const barangayFeatures =
            mapRef.current?.queryRenderedFeatures(
              mapRef.current.project([lng, lat]),
              { layers: ["barangayBounds"] },
            ) ?? [];
          const name =
            barangayFeatures[0]?.properties?.name || "Unknown Barangay";
          handleFeatureSelection(geoFeature, { lng, lat }, name);
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

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

      // No explicit LST point/label layers: we keep only the gradient surface

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

      // No explicit AQI point/label layers: we keep only the gradient surface
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

      // Toggle LST and AQI gradient surfaces
      if (map.getLayer("lstFillLayer")) {
        map.setLayoutProperty(
          "lstFillLayer",
          "visibility",
          layerVisibility.heatLayer ? "visible" : "none",
        );
      }

      if (map.getLayer("aqiFillLayer")) {
        map.setLayoutProperty(
          "aqiFillLayer",
          "visibility",
          layerVisibility.airLayer ? "visible" : "none",
        );
      }

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

  const applyOverlayClipping = useCallback((map: mapboxgl.Map) => {
    const geom = barangayMaskRef.current;
    if (!geom) return;

    const surfaceFilter: any = [
      "all",
      ["==", "type", "surface"],
      ["within", geom],
    ];
    const labelFilter: any = [
      "all",
      ["==", "type", "label"],
      ["within", geom],
    ];

    if (map.getLayer("lstFillLayer")) {
      map.setFilter("lstFillLayer", surfaceFilter);
    }
    if (map.getLayer("aqiFillLayer")) {
      map.setFilter("aqiFillLayer", surfaceFilter);
    }
    if (map.getLayer("lstPointsLayer")) {
      map.setFilter("lstPointsLayer", labelFilter);
    }
    if (map.getLayer("lstLabelsLayer")) {
      map.setFilter("lstLabelsLayer", labelFilter);
    }
    if (map.getLayer("aqiPointsLayer")) {
      map.setFilter("aqiPointsLayer", labelFilter);
    }
    if (map.getLayer("aqiLabelsLayer")) {
      map.setFilter("aqiLabelsLayer", labelFilter);
    }
  }, []);

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
      applyOverlayClipping(map);
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

    map.on("click", handleMapClick);
    map.on("mousemove", handleMouseMove);

    map.on("click", "aqiFillLayer", (e: mapboxgl.MapLayerMouseEvent) => {
      const feat = e.features?.[0];
      if (!feat) return;
      const p = feat.properties as any;
      const coords = (e.lngLat as mapboxgl.LngLatLike) as [number, number];

      new mapboxgl.Popup({ closeButton: true, maxWidth: "260px" })
        .setLngLat(coords)
        .setHTML(
          `<div class="p-3 font-roboto">
            <h4 class="font-bold text-sm mb-1">Air Quality</h4>
            <p class="text-lg font-semibold" style="color:${
              (p?.aqi ?? 0) <= 50
                ? "#2DC937"
                : (p?.aqi ?? 0) <= 100
                  ? "#E7B416"
                  : "#CC3232"
            }">AQI ${p?.aqi}</p>
            <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-neutral-600 mt-1">
              <span>PM2.5:</span><span class="font-medium">${p?.pm25 ?? "N/A"} µg/m³</span>
              <span>PM10:</span><span class="font-medium">${p?.pm10 ?? "N/A"} µg/m³</span>
              <span>NO₂:</span><span class="font-medium">${p?.no2 ?? "N/A"} µg/m³</span>
              <span>O₃:</span><span class="font-medium">${p?.o3 ?? "N/A"} µg/m³</span>
            </div>
          </div>`,
        )
        .addTo(map);
    });

    map.on("click", "lstFillLayer", (e: mapboxgl.MapLayerMouseEvent) => {
      const feat = e.features?.[0];
      if (!feat) return;
      const p = feat.properties as any;
      const coords = (e.lngLat as mapboxgl.LngLatLike) as [number, number];
      const temp = p?.temperature;
      const rawDate = p?.date as string | undefined;
      const dateStr = rawDate
        ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
        : "N/A";

      new mapboxgl.Popup({ closeButton: true, maxWidth: "240px" })
        .setLngLat(coords)
        .setHTML(
          `<div class="p-3 font-roboto">
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
  }, [
    selectionMode,
    center,
    zoom,
    addBarangayBounds,
    addHazardLayers,
    syncLayerStyles,
    applyOverlayClipping,
  ]); // Only re-init if core settings change

  useEffect(() => {
    let cancelled = false;

    async function loadBarangayMask() {
      try {
        const response = await fetch("/geo/mandaue_barangay_boundaries.json");
        if (!response.ok) return;
        const data = await response.json();

        const features = (data?.features ?? []) as {
          geometry?: {
            type: "Polygon" | "MultiPolygon";
            coordinates: number[][][] | number[][][][];
          };
        }[];

        const polygons: number[][][][] = [];

        for (const f of features) {
          if (!f.geometry) continue;
          if (f.geometry.type === "Polygon") {
            const coords = f.geometry.coordinates as number[][][];
            polygons.push(coords);
          } else if (f.geometry.type === "MultiPolygon") {
            const polys = f.geometry.coordinates as number[][][][];
            polys.forEach((poly) => polygons.push(poly));
          }
        }

        if (!polygons.length || cancelled) return;

        const maskGeom: GeoJSON.MultiPolygon = {
          type: "MultiPolygon",
          coordinates: polygons,
        };

        if (cancelled) return;

        barangayMaskRef.current = maskGeom;

        if (mapRef.current && mapRef.current.isStyleLoaded()) {
          applyOverlayClipping(mapRef.current);
        }
      } catch (error) {
        console.error("Failed to load barangay mask geometry:", error);
      }
    }

    loadBarangayMask();

    return () => {
      cancelled = true;
    };
  }, [applyOverlayClipping]);

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

      {/* Custom Search Bar */}
      <div className={`absolute ${searchBoxLocation}`}>
        <MapSearchBar
          accessToken={mapboxgl.accessToken || ""}
          map={mapRef.current}
          onRetrieve={handleSearchRetrieve}
        />
      </div>
    </div>
  );
}
