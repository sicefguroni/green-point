import mapboxgl from "mapbox-gl";

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

export function addBarangayBounds(map: mapboxgl.Map) {
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

  if (!map.getSource("lstDynamicSource")) {
    map.addSource("lstDynamicSource", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });

    fetch("/api/lst")
      .then((res) => res.json())
      .then((data) => {
        const src = map.getSource("lstDynamicSource");
        if (src && "setData" in src) {
          (src as mapboxgl.GeoJSONSource).setData(data);
        }
      })
      .catch((err) => console.error("Failed to load dynamic LST data:", err));
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
      .catch((err) => console.error("Failed to load dynamic AQI data:", err));
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
}

export function syncLayerStyles(
  map: mapboxgl.Map,
  layerVisibility: Record<string, boolean>,
  layerColors: Record<string, string[]>,
  layerSpecificSelected: Record<string, string>,
) {
  const isVisible = (id: string, group: string) =>
    layerVisibility[group as keyof typeof layerVisibility] &&
    layerSpecificSelected[group as keyof typeof layerSpecificSelected] === id;

  floodLayersConfig
    .map((c) => c.id)
    .forEach((id) => {
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

  stormLayersConfig
    .map((c) => c.id)
    .forEach((id) => {
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
}

export function applyOverlayClipping(map: mapboxgl.Map) {
  const surfaceFilter: any = ["all", ["==", "type", "surface"]];

  if (map.getLayer("lstFillLayer"))
    map.setFilter("lstFillLayer", surfaceFilter);
  if (map.getLayer("aqiFillLayer"))
    map.setFilter("aqiFillLayer", surfaceFilter);
}
