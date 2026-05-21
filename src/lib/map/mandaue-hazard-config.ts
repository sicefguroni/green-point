/** Local Mandaue hazard datasets under /public/geo (KML-derived). */

export type MandaueVectorHazardConfig = {
  groupId: MandaueVectorHazardGroupId;
  label: string;
  description: string;
  geojsonUrl: string;
  sourceId: string;
  layerId: string;
  colorField: string;
  defaultPalette: string;
};

export type MandaueRasterHazardConfig = {
  groupId: MandaueRasterHazardGroupId;
  label: string;
  description: string;
  manifestUrl: string;
  sourceIdPrefix: string;
  layerIdPrefix: string;
};

export type MandaueVectorHazardGroupId = "landslideLayer";

export type MandaueRasterHazardGroupId = "liquefactionLayer" | "eilLayer";

export type MandaueHazardGroupId =
  | MandaueVectorHazardGroupId
  | MandaueRasterHazardGroupId;

export const MANDAUE_VECTOR_HAZARD_CONFIGS: MandaueVectorHazardConfig[] = [
  {
    groupId: "landslideLayer",
    label: "Landslide Susceptibility",
    description: "Mandaue landslide susceptibility zones (LL / ML)",
    geojsonUrl: "/geo/MandaueLandslide/susceptibility.geojson",
    sourceId: "landslideSusceptibilitySource",
    layerId: "landslideFillLayer",
    colorField: "level",
    defaultPalette: "Amber",
  },
];

export const MANDAUE_RASTER_HAZARD_CONFIGS: MandaueRasterHazardConfig[] = [
  {
    groupId: "liquefactionLayer",
    label: "Liquefaction Hazard",
    description: "2018 liquefaction susceptibility map (Mandaue)",
    manifestUrl: "/geo/liq_2018_072230000_01/overlays.json",
    sourceIdPrefix: "liquefactionImg",
    layerIdPrefix: "liquefactionImg",
  },
  {
    groupId: "eilLayer",
    label: "Earthquake-Induced Landslide",
    description: "2017 earthquake-induced landslide hazard (Mandaue)",
    manifestUrl: "/geo/eil_2017_072230000_01/overlays.json",
    sourceIdPrefix: "eilImg",
    layerIdPrefix: "eilImg",
  },
];

export const DEFAULT_MANDAUE_HAZARD_LAYER_ORDER: MandaueHazardGroupId[] = [
  "liquefactionLayer",
  "eilLayer",
  "landslideLayer",
];

export const LANDSLIDE_LEVEL_LABELS: Record<number, string> = {
  1: "Low (LL)",
  2: "Moderate (ML)",
};

/** KML symbology — not user-adjustable in the layers panel. */
export const LANDSLIDE_FILL_COLORS = ["#ffff00", "#008000", "#60100b"];
