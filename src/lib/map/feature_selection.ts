import mapboxgl from "mapbox-gl";
import { getAirQualityData, getFloodData, getStormData } from "@/lib/api/get_hazard_data";
import { fetchMapEnvBundle } from "@/lib/data-api/client";
import { type LocationSelectionMode } from "@/types/maplayers";
import { FeatureHazardData, SelectedFeature } from "@/types/metrics";

export async function handleFeatureSelection(
  feature: mapboxgl.GeoJSONFeature,
  coords: { lng: number; lat: number },
  barangay: string,
  map: mapboxgl.Map,
  markerRef: React.MutableRefObject<mapboxgl.Marker | null>,
  onFeatureSelected?: (featureData: SelectedFeature) => void,
  selectionMode: LocationSelectionMode = "poi",
  customSelectionGeometry: GeoJSON.Polygon | null = null,
  customSelectionAreaHectares: number | null = null,
  placeMarker = true,
) {
  const isCustomSelection = selectionMode === "custom";
  const name =
    feature.properties?.name || (isCustomSelection ? "Custom Area" : "Unnamed Point");

  if (markerRef.current) {
    markerRef.current.remove();
  }
  if (placeMarker) {
    markerRef.current = new mapboxgl.Marker({ color: "#DB4848" })
      .setLngLat([coords.lng, coords.lat])
      .addTo(map);
  } else {
    markerRef.current = null;
  }

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

  const point = map.project([coords.lng, coords.lat]);
  const hazards: FeatureHazardData = {
    flood: getFloodData(map, point),
    storm: getStormData(map, point),
    air: await getAirQualityData(coords.lat, coords.lng),
  };

  const properties = { ...(feature.properties || {}) };

  const initialSelected: SelectedFeature = {
    name,
    coords,
    address,
    properties,
    barangay,
    customSelectionGeometry,
    customSelectionAreaHectares,
    hazards,
    isLoadingMetrics: true,
  };

  console.debug("Feature Selection Helper: initial selected feature ->", initialSelected);
  if (onFeatureSelected) {
    onFeatureSelected(initialSelected);
  }

  if (selectionMode === "poi") {
    // Fetch the unified remote GEE metrics for the exact point
    try {
      const metricsUrl = `/api/data?resource=point&lat=${coords.lat}&lng=${coords.lng}`;
      const metricsRes = await fetch(metricsUrl);
      const metricsObj = await metricsRes.json();
      const payload = metricsObj.ok ? metricsObj.data : null;
      if (payload?.success && payload.metrics) {
        properties.temperature = payload.metrics.lst;
        properties.ndvi = payload.metrics.ndvi;
        properties.treeCanopy = payload.metrics.treeCanopy;
        properties.greeneryIndex = payload.metrics.greeneryIndex;
      }
    } catch (err) {
      console.error("Error fetching unified metrics for sidebar:", err);
    }
  } else {
    // Try the live map source first, then fall back to the shared bundle if the style
    // has not loaded yet or the source is temporarily unavailable.
    let populatedFromSource = false;

    try {
      if (map.isStyleLoaded()) {
        const source = map.getSource("greeneryIndexDynamicSource") as
          | mapboxgl.GeoJSONSource
          | undefined;

        if (source) {
          const features = map.querySourceFeatures("greeneryIndexDynamicSource");
          const matchedFeature = features.find(
            (f) => f.properties?.name === barangay,
          );

          if (matchedFeature?.properties) {
            const p = matchedFeature.properties;
            properties.temperature = p.lst;
            properties.ndvi = p.ndvi;
            properties.treeCanopy = p.treeCanopy;
            properties.greeneryIndex = p.greeneryIndex;
            populatedFromSource = true;
          }
        }
      }
    } catch (err) {
      console.error("Error querying barangay metrics from map source:", err);
    }

    if (!populatedFromSource) {
      try {
        const bundle = await fetchMapEnvBundle();
        const features = bundle.barangayGeoJson.greeneryIndex.features ?? [];
        const matchedFeature = features.find(
          (f) => f.properties?.name === barangay,
        );

        if (matchedFeature?.properties) {
          const p = matchedFeature.properties;
          properties.temperature = p.lst;
          properties.ndvi = p.ndvi;
          properties.treeCanopy = p.treeCanopy;
          properties.greeneryIndex = p.greeneryIndex;
        } else {
          console.warn(
            "Could not find loaded barangay metrics in bundle for:",
            barangay,
          );
        }
      } catch (err) {
        console.error("Error loading barangay metrics bundle:", err);
      }
    }
  }

  const finalSelected: SelectedFeature = {
    ...initialSelected,
    properties,
    isLoadingMetrics: false,
  };

  if (onFeatureSelected) {
    onFeatureSelected(finalSelected);
  }

  map.flyTo({ center: [coords.lng, coords.lat], zoom: 16, duration: 2000 });
  
  return finalSelected;
}
