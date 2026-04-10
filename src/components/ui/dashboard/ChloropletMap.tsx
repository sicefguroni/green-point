"use client";
import { useEffect } from "react";
import dynamic from "next/dynamic";
import type {
  Layer,
  Popup,
  TooltipOptions,
  StyleFunction,
  Tooltip,
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
import { useBarangay } from "@/context/BarangayContext";
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

export default function MandaueMap({ settings = true }: MandaueMapProps) {
  const geoData = useGeoData((state) => state.geoData);
  const isClient = useGeoData((state) => state.isClient);
  const setGeoData = useGeoData((state) => state.setGeoData);
  const setIsClient = useGeoData((state) => state.setIsClient);
  const { setSelectedBarangay } = useBarangay();

  useEffect(() => {
    setIsClient(true);

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
  }, [setIsClient]);

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

  const onEachFeature = (
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
  };

  // Default style for the barangay boundaries
  const style = (feature: BarangayFeature) => ({
    fillColor: getGreeneryColor(feature.properties.greenery_index ?? 0),
    weight: BARANGAY_OUTLINE.weight,
    opacity: 1,
    color: BARANGAY_OUTLINE.color,
    fillOpacity: BARANGAY_OUTLINE.fillOpacity,
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
    <div className="w-full h-full overflow-hidden shadow z-40">
      <MapContainer
        center={settings ? DASHBOARD_MAP_CENTER : LANDING_MAP_CENTER}
        zoom={settings ? DASHBOARD_MAP_ZOOM : LANDING_MAP_ZOOM}
        dragging={settings}
        zoomControl={settings}
        scrollWheelZoom={settings}
        doubleClickZoom={settings}
        touchZoom={settings}
        boxZoom={settings}
        keyboard={settings}
        attributionControl={settings}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap contributors"
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
