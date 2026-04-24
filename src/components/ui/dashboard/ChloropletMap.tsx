"use client";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import type {
  Layer,
  Popup,
  TooltipOptions,
  StyleFunction,
  Tooltip,
  Map as LeafletMap,
} from "leaflet";
import type { Feature } from "geojson";
import {
  getGreeneryColor,
  GREENERY_BARANGAY_OUTLINE_COLOR,
} from "@/lib/chloroplet-colors";
import { formatUpTo2Decimals, roundTo2Decimals } from "@/lib/format-number";
import {
  mergeBoundariesWithLiveGreenery,
  mergeGI,
} from "@/lib/MergeGI";
import { fetchGreeneryIndexResourceDeduped } from "@/lib/data-api/greenery-index-resource-client";
import { useBarangayActions } from "@/context/BarangayContext";
import { useTheme } from "@/context/ThemeContext";
import { useGeoData } from "@/context/geoDataStore";
import "leaflet/dist/leaflet.css";

/** Leaflet [lat, lng]. Shifted slightly north and zoomed in on Mandaue urban core. */
const DASHBOARD_MAP_CENTER: [number, number] = [10.351, 123.939];
const DASHBOARD_MAP_ZOOM = 13.25;
const LANDING_MAP_CENTER: [number, number] = [10.350, 123.939];
const LANDING_MAP_ZOOM = 12.75;

/** Lighter barangay outlines (weight + shared rgba) so fills stay primary. */
const BARANGAY_OUTLINE = {
  weight: 1.25,
  color: GREENERY_BARANGAY_OUTLINE_COLOR,
  fillOpacity: 0.55,
} as const;

const BARANGAY_OUTLINE_HOVER = {
  weight: 2,
  color: "rgba(255, 255, 255, 0.72)",
  fillOpacity: 0.68,
} as const;

const GreeneryLegend = dynamic(() => import("./greeneryLegend"), {
  ssr: false,
});

// Dynamically import the map component to avoid SSR issues
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false },
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false },
);
const GeoJSON = dynamic(
  () => import("react-leaflet").then((mod) => mod.GeoJSON),
  { ssr: false },
);

type BarangayFeature = Feature & {
  properties: {
    name: string;
    greenery_index: number | null;
    ndvi: number | null;
    lst: number | null;
    tree_canopy: number | null;
    [key: string]: string | number | null | undefined;
  };
};

interface MandaueMapProps {
  readonly settings?: boolean;
}

function MandaueMap({ settings = true }: MandaueMapProps) {
  const geoData = useGeoData((state) => state.geoData);
  const setGeoData = useGeoData((state) => state.setGeoData);
  const mapView = useGeoData((state) => state.mapView);
  const setMapView = useGeoData((state) => state.setMapView);
  const { setSelectedBarangay } = useBarangayActions();
  const { isDarkMode } = useTheme();
  const renderCountRef = useRef(0);
  const mapRef = useRef<LeafletMap | null>(null);

  renderCountRef.current += 1;

  const initialCenter = useMemo<[number, number]>(() => {
    if (mapView?.center) return mapView.center;
    return settings ? DASHBOARD_MAP_CENTER : LANDING_MAP_CENTER;
    // Intentional: only compute once at mount to seed MapContainer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initialZoom = useMemo<number>(() => {
    if (typeof mapView?.zoom === "number") return mapView.zoom;
    return settings ? DASHBOARD_MAP_ZOOM : LANDING_MAP_ZOOM;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMapReady = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const persist = () => {
      const c = map.getCenter();
      setMapView({ center: [c.lat, c.lng], zoom: map.getZoom() });
    };

    map.on("moveend", persist);
    map.on("zoomend", persist);
  }, [setMapView]);

  useEffect(() => {
    return () => {
      const map = mapRef.current;
      if (!map) return;
      map.off("moveend");
      map.off("zoomend");
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    console.debug("[MandaueMap] mounted");
    return () => {
      console.debug("[MandaueMap] unmounted");
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    console.debug("[MandaueMap] render", {
      count: renderCountRef.current,
      isDarkMode,
      hasGeoData: Boolean(geoData),
      settings,
    });
  }, [geoData, isDarkMode, settings]);

  useEffect(() => {
    // Fix for Leaflet icon in Next.js SSR
    if (globalThis.window !== undefined) {
      import("leaflet").then((L) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
          iconUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
          shadowUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
        });
      });
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/geo/mandaue_barangay_boundaries.json").then((res) => res.json()),
      fetchGreeneryIndexResourceDeduped(),
      fetch("/geo/mandaue_barangays_gi.geojson").then((res) => res.json()),
    ])
      .then(([boundaries, giResult, supplement]) => {
        const staticRows = Array.isArray(supplement) ? supplement : [];
        if (
          giResult.ok &&
          giResult.data?.type === "FeatureCollection" &&
          Array.isArray(giResult.data.features) &&
          giResult.data.features.length > 0
        ) {
          return mergeBoundariesWithLiveGreenery(
            boundaries,
            giResult.data,
            staticRows,
          );
        }
        return mergeGI(boundaries, staticRows);
      })
      .then((data) => setGeoData(data))
      .catch((err) => console.error("GeoJSON load error:", err));
  }, [setGeoData]);

  const tileLayers = useMemo(
    () => ({
      light: {
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution: "© OpenStreetMap contributors",
      },
      dark: {
        url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        attribution: "© OpenStreetMap contributors © CARTO",
      },
    }),
    [],
  );

  const onEachFeature = useCallback((
    feature: BarangayFeature,
    layer: Layer & {
      bindTooltip: (content: string, options?: TooltipOptions) => void;
      openTooltip: () => void;
      closeTooltip: () => void;
      setStyle: (style: {
        fillColor?: string;
        weight?: number;
        opacity?: number;
        color?: string;
        dashArray?: string;
        fillOpacity?: number;
      }) => void;
      bindPopup: (content: string) => Popup;
      getTooltip?: () => Tooltip;
      setTooltipContent?: (html: string) => void;
      unbindTooltip?: () => void;
      _map: {
        eachLayer: (
          fn: (l: Layer & { closePopup: () => void }) => void,
        ) => void;
      };
    },
  ) => {
    if (feature.properties && feature.properties.name) {
      // Add hover effects
      layer.on("mouseover", function () {
        layer.setStyle({
          fillColor: getGreeneryColor(feature.properties.greenery_index ?? 0),
          weight: BARANGAY_OUTLINE_HOVER.weight,
          opacity: 1,
          color: BARANGAY_OUTLINE_HOVER.color,
          fillOpacity: BARANGAY_OUTLINE_HOVER.fillOpacity,
        });

        // Show rich tooltip on hover
        const fmt = (v: unknown) =>
          typeof v === "number" && Number.isFinite(v)
            ? formatUpTo2Decimals(v)
            : "N/A";
        const content = `
          <div>
            <b>${feature.properties.name}</b>
            <p>Greenery Index: ${fmt(feature.properties.greenery_index)}</p>
            <p>NDVI: ${fmt(feature.properties.ndvi)}</p>
            <p>LST: ${fmt(feature.properties.lst)}°C</p>
            <p>Tree Canopy: ${fmt(feature.properties.tree_canopy)}</p>
          </div>
        `;
        // Rebind tooltip content each hover to ensure it's up to date
        if (layer.getTooltip && layer.getTooltip()) {
          if (layer.setTooltipContent) {
            layer.setTooltipContent(content);
          }
        } else {
          layer.bindTooltip(content, {
            direction: "top",
            sticky: false,
            permanent: false,
          });
        }
        layer.openTooltip();
      });

      // Mouse away from the barangay boundary -> revert to default style
      layer.on("mouseout", function () {
        layer.setStyle({
          fillColor: getGreeneryColor(feature.properties.greenery_index ?? 0),
          weight: BARANGAY_OUTLINE.weight,
          opacity: 1,
          color: BARANGAY_OUTLINE.color,
          fillOpacity: BARANGAY_OUTLINE.fillOpacity,
        });

        // Close and unbind tooltip on mouse out
        layer.closeTooltip();
        if (layer.unbindTooltip) {
          layer.unbindTooltip();
        }
      });

      layer.on("click", () => {
        // Close all other popups first
        layer._map.eachLayer((l: Layer) => {
          const layerWithPopup = l as Layer & { closePopup?: () => void };
          if (layerWithPopup.closePopup) layerWithPopup.closePopup();
        });

        const n = (v: unknown) =>
          typeof v === "number" && Number.isFinite(v) ? roundTo2Decimals(v) : 0;
        setSelectedBarangay({
          name: feature.properties.name,
          greeneryIndex: n(feature.properties.greenery_index),
          ndvi: n(feature.properties.ndvi),
          lst: n(feature.properties.lst),
          treeCanopy: n(feature.properties.tree_canopy),
          floodExposure: feature.properties.flood_exposure ?? "",
          currentIntervention: feature.properties.current_intervention ?? "",
        });
        // Open a popup for the clicked feature
        layer.bindPopup(`<b>${feature.properties.name}</b>`).openPopup();
      });
    }
  }, [setSelectedBarangay]);

  // Default style for the barangay boundaries
  const style = useCallback((feature: BarangayFeature) => {
    return {
      fillColor: getGreeneryColor(feature.properties.greenery_index ?? 0),
      weight: BARANGAY_OUTLINE.weight,
      opacity: 1,
      color: BARANGAY_OUTLINE.color,
      fillOpacity: BARANGAY_OUTLINE.fillOpacity,
    };
  }, []);

  return (
    <div className="w-full h-full overflow-hidden shadow z-40">
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        dragging={settings}
        zoomControl={settings}
        scrollWheelZoom={settings}
        doubleClickZoom={settings}
        touchZoom={settings}
        boxZoom={settings}
        keyboard={settings}
        attributionControl={settings}
        style={{ height: "100%", width: "100%" }}
        ref={(instance) => {
          mapRef.current = instance ?? null;
        }}
        whenReady={handleMapReady}
      >
        <TileLayer
          url={tileLayers.light.url}
          attribution={tileLayers.light.attribution}
          opacity={isDarkMode ? 0 : 1}
          zIndex={1}
        />
        <TileLayer
          url={tileLayers.dark.url}
          attribution={tileLayers.dark.attribution}
          opacity={isDarkMode ? 1 : 0}
          zIndex={2}
        />
        {geoData && (
          <GeoJSON
            data={geoData}
            style={style as StyleFunction}
            onEachFeature={onEachFeature}
          />
        )}
        {settings && <GreeneryLegend />}
      </MapContainer>
    </div>
  );
}

export default memo(MandaueMap);
