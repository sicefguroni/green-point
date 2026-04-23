import mapboxgl from "mapbox-gl";
import { type LocationSelectionMode } from "@/types/maplayers";
import { fetchMapEnvBundle } from "@/lib/data-api/client";
import {
  GREENERY_BARANGAY_OUTLINE_COLOR,
  mapboxGreeneryIndexFillColorExpression,
} from "@/lib/chloroplet-colors";

// --- CONFIGURATION & CONSTANTS ---

export const floodLayersConfig = [
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

export const stormLayersConfig = [
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

const BARANGAY_CONFIG = {
  sourceId: "barangayBoundsSource",
  sourceUrl: "mapbox://ishah-bautista.dtxcpd4f",
  sourceLayer: "mandaue_barangay_boundaries-7byvux",
  layers: {
    fill: "barangayBounds",
    outline: "barangayBoundsOutline",
    casing: "barangayBoundsCasing",
  },
  defaultColors: ["#3B82F6", "#1D4ED8", "#FFD700", "#FFA500"], // Base Blue, Darker Selected Blue, White Outline (forced)
};

// --- UTILITIES ---

const ensureHex = (color: string) =>
  color.startsWith("#") ? color : `#${color}`;

export function bringBarangayToFront(map: mapboxgl.Map) {
  const { fill, casing, outline } = BARANGAY_CONFIG.layers;
  [fill, casing, outline].forEach((layerId) => {
    if (map.getLayer(layerId)) map.moveLayer(layerId);
  });
}

// --- LAYER INITIALIZATION ---

export function addBarangayBounds(map: mapboxgl.Map) {
  if (!map.getSource(BARANGAY_CONFIG.sourceId)) {
    map.addSource(BARANGAY_CONFIG.sourceId, {
      type: "vector",
      url: BARANGAY_CONFIG.sourceUrl,
      promoteId: "name",
    });
  }

  const commonProps = {
    source: BARANGAY_CONFIG.sourceId,
    "source-layer": BARANGAY_CONFIG.sourceLayer,
    layout: { visibility: "visible" as const },
  };

  if (!map.getLayer(BARANGAY_CONFIG.layers.fill)) {
    map.addLayer({
      id: BARANGAY_CONFIG.layers.fill,
      type: "fill",
      ...commonProps,
      paint: {
        "fill-color": "#00FF00",
        "fill-opacity": 0,
      },
    });
  }

  if (!map.getLayer(BARANGAY_CONFIG.layers.outline)) {
    map.addLayer({
      id: BARANGAY_CONFIG.layers.outline,
      type: "line",
      ...commonProps,
      layout: {
        ...commonProps.layout,
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#FFFFFF",
        "line-width": 2,
        "line-opacity": 1,
      },
    });
  }

  if (!map.getLayer(BARANGAY_CONFIG.layers.casing)) {
    map.addLayer(
      {
        id: BARANGAY_CONFIG.layers.casing,
        type: "line",
        ...commonProps,
        layout: {
          ...commonProps.layout,
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#000000",
          "line-width": 3,
          "line-opacity": 0.4,
        },
      },
      BARANGAY_CONFIG.layers.outline,
    );
  }

  bringBarangayToFront(map);
}

export function addHazardLayers(
  map: mapboxgl.Map,
  layerColors: Record<string, string[]>,
) {
  floodLayersConfig.forEach(({ id, source, sourcelayer, url }) => {
    if (!map.getSource(source)) map.addSource(source, { type: "vector", url });
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

  stormLayersConfig.forEach(({ id, source, sourcelayer, url }) => {
    if (!map.getSource(source)) map.addSource(source, { type: "vector", url });
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

  initializeMetricSources(map);
  initializeMetricLayers(map);
}

function initializeMetricSources(map: mapboxgl.Map) {
  const sources = [
    { id: "lstDynamicSource", key: "lst" },
    { id: "aqiDynamicSource", key: "aqi" },
    { id: "ndviDynamicSource", key: "ndvi" },
    { id: "greeneryIndexDynamicSource", key: "greeneryIndex" },
  ];

  sources.forEach(({ id, key }) => {
    if (!map.getSource(id)) {
      map.addSource(id, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      fetchMapEnvBundle()
        .then((bundle) => {
          if (!map.getStyle()) return;
          const src = map.getSource(id) as mapboxgl.GeoJSONSource;
          if (src)
            src.setData(
              bundle.barangayGeoJson[
                key as keyof typeof bundle.barangayGeoJson
              ],
            );
        })
        .catch((err) => console.error(`Failed to load ${key} data:`, err));
    }
  });

  // Raster sources
  ["lst", "ndvi", "canopy", "gi"].forEach((key) => {
    const sourceId = `${key}RasterSource`;
    if (!map.getSource(sourceId)) {
      fetchMapEnvBundle().then((bundle) => {
        const url =
          bundle.rasterTileUrls[key as keyof typeof bundle.rasterTileUrls];
        if (url && !map.getSource(sourceId)) {
          map.addSource(sourceId, {
            type: "raster",
            tiles: [url],
            tileSize: 256,
          });
          map.addLayer(
            {
              id: `${key}RasterLayer`,
              type: "raster",
              source: sourceId,
              layout: { visibility: "none" },
              paint: { "raster-opacity": 0.65 },
            },
            BARANGAY_CONFIG.layers.outline,
          );
        }
      });
    }
  });
}

function initializeMetricLayers(map: mapboxgl.Map) {
  const layerDefs = [
    {
      id: "lstFillLayer",
      source: "lstDynamicSource",
      filter: ["==", "type", "surface"],
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
    },
    {
      id: "aqiFillLayer",
      source: "aqiDynamicSource",
      filter: ["==", "type", "surface"],
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
    },
    {
      id: "ndviFillLayer",
      source: "ndviDynamicSource",
      filter: ["==", "type", "vegetation"],
      paint: {
        "fill-color": [
          "interpolate",
          ["linear"],
          ["get", "ndvi"],
          -0.1,
          "#d73027",
          0.1,
          "#fee08b",
          0.3,
          "#d9ef8b",
          0.5,
          "#66bd63",
          0.7,
          "#1a9850",
          0.9,
          "#006837",
        ],
        "fill-opacity": 0.55,
        "fill-outline-color": "rgba(0,0,0,0)",
      },
    },
    {
      id: "canopyFillLayer",
      source: "greeneryIndexDynamicSource",
      filter: ["==", "type", "greenery"],
      paint: {
        "fill-color": [
          "interpolate",
          ["linear"],
          ["get", "treeCanopy"],
          0,
          "#f7fcb1",
          0.2,
          "#addd8e",
          0.4,
          "#78c679",
          0.6,
          "#31a354",
          0.8,
          "#006837",
        ],
        "fill-opacity": 0.55,
        "fill-outline-color": GREENERY_BARANGAY_OUTLINE_COLOR,
      },
    },
    {
      id: "greeneryIndexFillLayer",
      source: "greeneryIndexDynamicSource",
      filter: ["==", "type", "greenery"],
      paint: {
        "fill-color":
          mapboxGreeneryIndexFillColorExpression() as mapboxgl.Expression,
        "fill-opacity": 0.6,
        "fill-outline-color": GREENERY_BARANGAY_OUTLINE_COLOR,
      },
    },
  ];

  layerDefs.forEach((def) => {
    if (!map.getLayer(def.id)) {
      map.addLayer({
        ...def,
        type: "fill",
        layout: { visibility: "none" },
      } as any);
    }
  });
}

// --- STYLE SYNCHRONIZATION ---

export function syncLayerStyles(
  map: mapboxgl.Map,
  layerVisibility: Record<string, boolean>,
  layerColors: Record<string, string[]>,
  layerSpecificSelected: Record<string, string>,
  selectionMode: LocationSelectionMode,
  layerOpacity: Record<string, number>,
) {
  syncHazardStyles(
    map,
    layerVisibility,
    layerColors,
    layerSpecificSelected,
    layerOpacity,
  );
  syncMetricOverlayStyles(
    map,
    layerVisibility,
    selectionMode === "poi",
    layerOpacity,
  );
  syncBarangayLayerStyles(
    map,
    layerVisibility,
    layerColors,
    selectionMode,
    layerOpacity,
  );
  bringBarangayToFront(map);
}

export function reorderLayers(
  map: mapboxgl.Map,
  hazardOrder: string[],
  environmentalOrder: string[],
) {
  if (!map.isStyleLoaded()) return;

  const layerMapping: Record<string, string[]> = {
    floodLayer: ["floodLayer5Yr", "floodLayer25Yr", "floodLayer100Yr"],
    stormLayer: [
      "stormLayerAdv1",
      "stormLayerAdv2",
      "stormLayerAdv3",
      "stormLayerAdv4",
    ],
    airLayer: ["aqiFillLayer"],
    heatLayer: ["lstFillLayer", "lstRasterLayer"],
    ndviLayer: ["ndviFillLayer", "ndviRasterLayer"],
    canopyLayer: ["canopyFillLayer", "canopyRasterLayer"],
    greeneryIndexLayer: ["greeneryIndexFillLayer", "giRasterLayer"],
    barangayBoundsLayer: [
      BARANGAY_CONFIG.layers.fill,
      BARANGAY_CONFIG.layers.casing,
      BARANGAY_CONFIG.layers.outline,
    ],
  };

  // Hierarchy: Hazard (bottom) -> Environmental -> Barangay (top)
  // We move them in order from bottom to top.
  // Within categories, the first item in the list should be on top of others in that category.
  // So we move them in REVERSE order of the lists.

  const fullOrder = [
    ...[...hazardOrder].reverse(),
    ...[...environmentalOrder].reverse(),
    "barangayBoundsLayer",
  ];

  fullOrder.forEach((uiId) => {
    const mapLayerIds = layerMapping[uiId];
    if (mapLayerIds) {
      mapLayerIds.forEach((layerId) => {
        if (map.getLayer(layerId)) {
          map.moveLayer(layerId);
        }
      });
    }
  });
}

function syncHazardStyles(
  map: mapboxgl.Map,
  layerVisibility: any,
  layerColors: any,
  layerSpecificSelected: any,
  layerOpacity: Record<string, number>,
) {
  const isVisible = (id: string, group: string) =>
    layerVisibility[group] && layerSpecificSelected[group] === id;

  const syncGroup = (
    config: typeof floodLayersConfig,
    group: string,
    defaultColor: string,
    colorField: string,
  ) => {
    config.forEach(({ id }) => {
      if (!map.getLayer(id)) return;
      const active = isVisible(id, group);
      map.setLayoutProperty(id, "visibility", active ? "visible" : "none");
      const opacity = (layerOpacity && layerOpacity[group]) ?? 0.6;
      map.setPaintProperty(id, "fill-opacity", active ? opacity : 0);
      map.setPaintProperty(id, "fill-color", [
        "match",
        ["get", colorField],
        1,
        layerColors[group][0],
        2,
        layerColors[group][1],
        3,
        layerColors[group][2],
        defaultColor,
      ]);
    });
  };

  syncGroup(floodLayersConfig, "floodLayer", "#0096C7", "Var");
  syncGroup(stormLayersConfig, "stormLayer", "#9333ea", "HAZ");
}

function syncMetricOverlayStyles(
  map: mapboxgl.Map,
  layerVisibility: any,
  useRaster: boolean,
  layerOpacity: Record<string, number>,
) {
  const metrics = [
    {
      enabled: layerVisibility.heatLayer,
      fill: "lstFillLayer",
      raster: "lstRasterLayer",
      opacityKey: "heatLayer",
    },
    {
      enabled: layerVisibility.ndviLayer,
      fill: "ndviFillLayer",
      raster: "ndviRasterLayer",
      opacityKey: "ndviLayer",
    },
    {
      enabled: layerVisibility.canopyLayer,
      fill: "canopyFillLayer",
      raster: "canopyRasterLayer",
      opacityKey: "canopyLayer",
    },
    {
      enabled: layerVisibility.greeneryIndexLayer,
      fill: "greeneryIndexFillLayer",
      raster: "giRasterLayer",
      opacityKey: "greeneryIndexLayer",
    },
  ];

  metrics.forEach(({ enabled, fill, raster, opacityKey }) => {
    const hasFill = Boolean(map.getLayer(fill));
    const hasRaster = Boolean(map.getLayer(raster));
    const showRaster = enabled && useRaster && hasRaster;
    const showFill = enabled && (!useRaster || !hasRaster) && hasFill;
    const opacity = (layerOpacity && layerOpacity[opacityKey]) ?? 0.6;

    if (hasFill) {
      map.setLayoutProperty(fill, "visibility", showFill ? "visible" : "none");
      map.setPaintProperty(fill, "fill-opacity", showFill ? opacity : 0);
    }
    if (hasRaster) {
      map.setLayoutProperty(
        raster,
        "visibility",
        showRaster ? "visible" : "none",
      );
      map.setPaintProperty(raster, "raster-opacity", showRaster ? opacity : 0);
    }
  });

  if (map.getLayer("aqiFillLayer")) {
    const aqiVisible = layerVisibility.airLayer;
    const aqiOpacity = layerOpacity.airLayer || 0.6;
    map.setLayoutProperty(
      "aqiFillLayer",
      "visibility",
      aqiVisible ? "visible" : "none",
    );
    map.setPaintProperty(
      "aqiFillLayer",
      "fill-opacity",
      aqiVisible ? aqiOpacity : 0,
    );
  }
}

function syncBarangayLayerStyles(
  map: mapboxgl.Map,
  layerVisibility: any,
  layerColors: any,
  selectionMode: string,
  layerOpacity: Record<string, number>,
) {
  const isBarangayMode = selectionMode === "barangay";

  const colors = (
    layerColors.barangayBoundsLayer || BARANGAY_CONFIG.defaultColors
  ).map(ensureHex);
  const [baseFill, , selFillOverride, selLine] = colors;

  // Use second color from palette for selected fill if available, else a darker version
  const selectedFill = colors[1] || selFillOverride || "#FFD700";
  const layerVisible = layerVisibility.barangayBoundsLayer;
  const baseOpacity =
    (layerOpacity && layerOpacity.barangayBoundsLayer) ?? 0.15;

  if (map.getLayer(BARANGAY_CONFIG.layers.fill)) {
    map.setPaintProperty(BARANGAY_CONFIG.layers.fill, "fill-color", [
      "case",
      ["boolean", ["feature-state", "selected"], false],
      selectedFill,
      ["boolean", ["feature-state", "hover"], false],
      "#FFFFFF",
      baseFill,
    ]);
    map.setPaintProperty(
      BARANGAY_CONFIG.layers.fill,
      "fill-opacity",
      layerVisible || isBarangayMode
        ? [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            Math.min(baseOpacity * 3, 1),
            ["boolean", ["feature-state", "hover"], false],
            Math.min(baseOpacity * 1.6, 1),
            layerVisible ? baseOpacity : 0.05,
          ]
        : 0,
    );
  }

  if (map.getLayer(BARANGAY_CONFIG.layers.outline)) {
    map.setPaintProperty(BARANGAY_CONFIG.layers.outline, "line-color", [
      "case",
      ["boolean", ["feature-state", "selected"], false],
      selLine || "#FFA500",
      ["boolean", ["feature-state", "hover"], false],
      "#FFD700",
      "#FFFFFF",
    ]);
    map.setPaintProperty(
      BARANGAY_CONFIG.layers.outline,
      "line-opacity",
      layerVisible || isBarangayMode ? 1 : 0,
    );
  }

  if (map.getLayer(BARANGAY_CONFIG.layers.casing)) {
    map.setPaintProperty(
      BARANGAY_CONFIG.layers.casing,
      "line-opacity",
      layerVisible || isBarangayMode ? 0.4 : 0,
    );
  }
}

export function applyOverlayClipping(map: mapboxgl.Map) {
  const filters = [
    { layer: "lstFillLayer", type: "surface" },
    { layer: "aqiFillLayer", type: "surface" },
    { layer: "ndviFillLayer", type: "vegetation" },
    { layer: "canopyFillLayer", type: "greenery" },
    { layer: "greeneryIndexFillLayer", type: "greenery" },
  ];

  filters.forEach(({ layer, type }) => {
    if (map.getLayer(layer))
      map.setFilter(layer, ["all", ["==", "type", type]]);
  });
}
