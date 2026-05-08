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

const BARANGAY_GREENERY_FILL_LAYER_ID = "barangayGreeneryFill";

type LayerVisibilityState = Record<string, boolean>;
type LayerColorState = Record<string, string[]>;

// --- UTILITIES ---

const ensureHex = (color: string) =>
  color.startsWith("#") ? color : `#${color}`;

export function bringBarangayToFront(map: mapboxgl.Map) {
  const { fill, casing, outline } = BARANGAY_CONFIG.layers;
  [BARANGAY_GREENERY_FILL_LAYER_ID, fill, casing, outline].forEach((layerId) => {
    if (map.getLayer(layerId)) map.moveLayer(layerId);
  });
}

// --- LAYER INITIALIZATION ---

export function addBarangayBounds(map: mapboxgl.Map) {
  if (!map.getStyle()) return;
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
  onMetricRasterLayerAdded?: () => void,
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

  initializeMetricSources(map, onMetricRasterLayerAdded);
  initializeMetricLayers(map);
}

function initializeMetricSources(
  map: mapboxgl.Map,
  onMetricRasterLayerAdded?: () => void,
) {
  if (!map.getStyle()) return;
  const sources = [
    { id: "lstDynamicSource", key: "lst" },
    { id: "aqiDynamicSource", key: "aqi" },
    { id: "ndviDynamicSource", key: "ndvi" },
    { id: "greeneryIndexDynamicSource", key: "greeneryIndex" },
  ];

  sources.forEach(({ id, key }) => {
    if (map.getStyle() && !map.getSource(id)) {
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
    if (map.getStyle() && !map.getSource(sourceId)) {
      fetchMapEnvBundle().then((bundle) => {
        if (!map.getStyle()) return;
        const url =
          bundle.rasterTileUrls[key as keyof typeof bundle.rasterTileUrls];
        if (url && !map.getSource(sourceId)) {
          map.addSource(sourceId, {
            type: "raster",
            tiles: [url],
            tileSize: 256,
          });
          const beforeLayer = map.getLayer(BARANGAY_CONFIG.layers.outline)
            ? BARANGAY_CONFIG.layers.outline
            : undefined;
          map.addLayer(
            {
              id: `${key}RasterLayer`,
              type: "raster",
              source: sourceId,
              layout: { visibility: "none" },
              paint: { "raster-opacity": 0.65 },
            },
            beforeLayer,
          );
          onMetricRasterLayerAdded?.();
        }
      }).catch((err) => console.error(`Failed to load ${key} raster:`, err));
    }
  });
}

function initializeMetricLayers(map: mapboxgl.Map) {
  if (!map.getStyle()) return;
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
      id: BARANGAY_GREENERY_FILL_LAYER_ID,
      source: "greeneryIndexDynamicSource",
      filter: ["==", "type", "greenery"],
      paint: {
        "fill-color":
          mapboxGreeneryIndexFillColorExpression() as mapboxgl.Expression,
        "fill-opacity": 0.45,
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
      } as mapboxgl.FillLayer);
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
  if (!map.getStyle()) return;
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
    selectionMode !== "barangay",
    layerOpacity,
  );
  syncBarangayLayerStyles(
    map,
    layerVisibility,
    layerColors,
    layerOpacity,
  );
  syncTaggedTreesStyles(map, layerVisibility, layerOpacity);
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
    taggedTreesLayer: ["taggedTreesLayer"],
    barangayBoundsLayer: [
      BARANGAY_GREENERY_FILL_LAYER_ID,
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
  layerVisibility: LayerVisibilityState,
  layerColors: LayerColorState,
  layerSpecificSelected: Record<string, string>,
  layerOpacity: Record<string, number>,
) {
  if (!map.getStyle()) return;
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
  layerVisibility: LayerVisibilityState,
  useRaster: boolean,
  layerOpacity: Record<string, number>,
) {
  if (!map.getStyle()) return;
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
    // Hard bind layer kind to mode: pin/lasso → raster only, barangay → fill
    // only. We never fall back from raster to clipped fill, otherwise pin/lasso
    // would briefly look "constrained" while raster tiles are still loading.
    const showRaster = enabled && useRaster && hasRaster;
    const showFill = enabled && !useRaster && hasFill;
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
  layerVisibility: LayerVisibilityState,
  layerColors: LayerColorState,
  selectionMode: string,
  layerOpacity: Record<string, number>,
) {
  if (!map.getStyle()) return;

  const colors = (
    layerColors.barangayBoundsLayer || BARANGAY_CONFIG.defaultColors
  ).map(ensureHex);
  const [baseFill, , selFillOverride, selLine] = colors;

  // Use second color from palette for selected fill if available, else a darker version
  const selectedFill = colors[1] || selFillOverride || "#FFD700";
  const layerVisible = layerVisibility.barangayBoundsLayer;
  const baseOpacity =
    (layerOpacity && layerOpacity.barangayBoundsLayer) ?? 0.15;
  const hasEnvironmentalOverlay =
    layerVisibility.heatLayer ||
    layerVisibility.airLayer ||
    layerVisibility.ndviLayer ||
    layerVisibility.canopyLayer ||
    layerVisibility.greeneryIndexLayer;
  const barangayModeBaseOpacity = hasEnvironmentalOverlay
    ? baseOpacity
    : Math.min(baseOpacity, 0.12);

  // Dashboard-style auto GI gradient is dropped: pin/lasso and barangay modes
  // should all read as the basemap until the user explicitly enables an env
  // layer. Keep the layer hidden so it never paints a "remnant".
  if (map.getLayer(BARANGAY_GREENERY_FILL_LAYER_ID)) {
    map.setLayoutProperty(BARANGAY_GREENERY_FILL_LAYER_ID, "visibility", "none");
    map.setPaintProperty(BARANGAY_GREENERY_FILL_LAYER_ID, "fill-opacity", 0);
  }

  // Hover/select shading is preserved as before. In barangay mode, keep the
  // subtle base tint visible so the barangay view reads like the reference
  // map even when the active overlay is a hazard layer (flood/storm), not just
  // an environmental metric.
  if (map.getLayer(BARANGAY_CONFIG.layers.fill)) {
    map.setLayoutProperty(
      BARANGAY_CONFIG.layers.fill,
      "visibility",
      layerVisible ? "visible" : "none",
    );
    map.setPaintProperty(BARANGAY_CONFIG.layers.fill, "fill-color", [
      "case",
      ["boolean", ["feature-state", "selected"], false],
      selectedFill,
      ["boolean", ["feature-state", "hover"], false],
      "#FFFFFF",
      baseFill,
    ]);
    // Whenever the barangays are visible to the user — either because the
    // mode is `barangay` or because the Barangay Borders layer toggle is on
    // — paint the subtle base tint so the map reads like the reference
    // (dark basemap + faint green inside each polygon).
    //
    // Firefox has been observed to miss the subtle default tint when the
    // fallback opacity is buried inside a feature-state expression during
    // rapid style/layer sync, so use a plain numeric opacity for the default
    // case and only switch to an expression for hover/selected emphasis.
    const showBaseTint = isBarangayMode || layerVisible;
    map.setPaintProperty(
      BARANGAY_CONFIG.layers.fill,
      "fill-opacity",
      showBaseTint
        ? [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            Math.min(baseOpacity * 3, 1),
            ["boolean", ["feature-state", "hover"], false],
            Math.min(baseOpacity * 1.6, 1),
            barangayModeBaseOpacity,
          ]
        : 0,
    );
  }

  // Boundary lines are driven solely by the `barangayBoundsLayer` toggle so
  // turning it off — even in barangay mode — leaves a clean basemap.
  if (map.getLayer(BARANGAY_CONFIG.layers.outline)) {
    map.setLayoutProperty(
      BARANGAY_CONFIG.layers.outline,
      "visibility",
      layerVisible ? "visible" : "none",
    );
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
      layerVisible ? 1 : 0,
    );
  }

  if (map.getLayer(BARANGAY_CONFIG.layers.casing)) {
    map.setLayoutProperty(
      BARANGAY_CONFIG.layers.casing,
      "visibility",
      layerVisible ? "visible" : "none",
    );
    map.setPaintProperty(
      BARANGAY_CONFIG.layers.casing,
      "line-opacity",
      layerVisible ? 0.4 : 0,
    );
  }
}

export function applyOverlayClipping(map: mapboxgl.Map) {
  const filters = [
    { layer: "lstFillLayer", type: "surface" },
    { layer: "aqiFillLayer", type: "surface" },
    { layer: "ndviFillLayer", type: "vegetation" },
    { layer: "canopyFillLayer", type: "greenery" },
    { layer: BARANGAY_GREENERY_FILL_LAYER_ID, type: "greenery" },
    { layer: "greeneryIndexFillLayer", type: "greenery" },
  ];

  filters.forEach(({ layer, type }) => {
    if (map.getLayer(layer))
      map.setFilter(layer, ["all", ["==", "type", type]]);
  });
}
function syncTaggedTreesStyles(
  map: mapboxgl.Map,
  layerVisibility: LayerVisibilityState,
  layerOpacity: Record<string, number>,
) {
  if (!map.getStyle() || !map.getLayer("taggedTreesLayer")) return;

  const visible = layerVisibility.taggedTreesLayer;
  const opacity = layerOpacity.taggedTreesLayer ?? 0.8;

  map.setLayoutProperty(
    "taggedTreesLayer",
    "visibility",
    visible ? "visible" : "none",
  );
  map.setPaintProperty(
    "taggedTreesLayer",
    "circle-opacity",
    visible ? opacity : 0,
  );
  map.setPaintProperty(
    "taggedTreesLayer",
    "circle-stroke-opacity",
    visible ? opacity : 0,
  );
}
