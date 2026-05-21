import { LegendConfig } from "@/components/map/map_legend";
import { GREENERY_INDEX_FILL_STOPS } from "@/lib/chloroplet-colors";
import {
  LANDSLIDE_FILL_COLORS,
  LANDSLIDE_LEVEL_LABELS,
} from "@/lib/map/mandaue-hazard-config";

export const STATIC_LEGENDS: Record<string, LegendConfig> = {
  heatLayer: {
    id: "heatLayer",
    title: "Surface Temperature",
    unit: "┬░C",
    type: "gradient",
    stops: [
      { value: 24, color: "#313695" },
      { value: 26, color: "#4575b4" },
      { value: 28, color: "#abd9e9" },
      { value: 30, color: "#fee090" },
      { value: 32, color: "#f46d43" },
      { value: 34, color: "#d73027" },
      { value: 36, color: "#a50026" },
    ],
  },
  ndviLayer: {
    id: "ndviLayer",
    title: "Vegetation (NDVI)",
    type: "gradient",
    stops: [
      { value: -0.1, color: "#d73027", label: "Barren" },
      { value: 0.3, color: "#d9ef8b" },
      { value: 0.5, color: "#66bd63" },
      { value: 0.9, color: "#006837", label: "Dense" },
    ],
  },
  canopyLayer: {
    id: "canopyLayer",
    title: "Tree Canopy",
    type: "gradient",
    stops: [
      { value: 0, color: "#f7fcb1", label: "Low" },
      { value: 0.4, color: "#78c679" },
      { value: 0.8, color: "#006837", label: "High" },
    ],
  },
  greeneryIndexLayer: {
    id: "greeneryIndexLayer",
    title: "Greenery Index",
    type: "gradient",
    stops: GREENERY_INDEX_FILL_STOPS.map((s) => ({
      value: s.value,
      color: s.color,
    })),
  },
  taggedTreesLayer: {
    id: "taggedTreesLayer",
    title: "Tagged Trees",
    type: "categorical",
    stops: [{ value: "Location", color: "#10b981", label: "Inventoried Tree" }],
  },
  barangayBoundsLayer: {
    id: "barangayBoundsLayer",
    title: "Barangay Borders",
    type: "categorical",
    stops: [
      { value: "Boundary", color: "#FFFFFF" },
      { value: "Selection", color: "#FFD700" },
    ],
  },
};

export function getHazardLegend(
  id: string,
  colors: string[],
): LegendConfig | null {
  if (id === "floodLayer") {
    return {
      id: "floodLayer",
      title: "Flood Hazard",
      type: "categorical",
      stops: [
        { value: 1, color: colors[0], label: "Low" },
        { value: 2, color: colors[1], label: "Medium" },
        { value: 3, color: colors[2], label: "High" },
      ],
    };
  }
  if (id === "stormLayer") {
    return {
      id: "stormLayer",
      title: "Storm Surge",
      type: "categorical",
      stops: [
        { value: 1, color: colors[0], label: "Advisory 1" },
        { value: 2, color: colors[1], label: "Advisory 2" },
        { value: 3, color: colors[2], label: "Advisory 3" },
        { value: "Default", color: "#9333ea", label: "Advisory 4" },
      ],
    };
  }
  if (id === "landslideLayer") {
    return {
      id: "landslideLayer",
      title: "Landslide Susceptibility",
      type: "categorical",
      stops: [
        {
          value: 1,
          color: LANDSLIDE_FILL_COLORS[0],
          label: LANDSLIDE_LEVEL_LABELS[1],
        },
        {
          value: 2,
          color: LANDSLIDE_FILL_COLORS[1],
          label: LANDSLIDE_LEVEL_LABELS[2],
        },
      ],
    };
  }
  if (id === "liquefactionLayer") {
    return {
      id: "liquefactionLayer",
      title: "Liquefaction Hazard",
      type: "categorical",
      stops: [
        {
          value: "map",
          color: "#0096C7",
          label: "2018 susceptibility raster",
        },
      ],
    };
  }
  if (id === "eilLayer") {
    return {
      id: "eilLayer",
      title: "Earthquake-Induced Landslide",
      type: "categorical",
      stops: [
        {
          value: "map",
          color: "#E7BC10",
          label: "2017 hazard raster",
        },
      ],
    };
  }
  return null;
}
