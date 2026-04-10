import mapboxgl from "mapbox-gl";
import { getAirQualityData, getFloodData, getStormData } from "@/lib/api/get_hazard_data";
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
      const metricsUrl = `/api/metrics/coordinates?lat=${coords.lat}&lng=${coords.lng}`;
      const metricsRes = await fetch(metricsUrl);
      const metricsObj = await metricsRes.json();
      if (metricsObj.success && metricsObj.metrics) {
        properties.temperature = metricsObj.metrics.lst;
        properties.ndvi = metricsObj.metrics.ndvi;
        properties.treeCanopy = metricsObj.metrics.treeCanopy;
        properties.greeneryIndex = metricsObj.metrics.greeneryIndex;
        properties.greeneryLevel = metricsObj.metrics.greeneryLevel;
      }
    } catch (err) {
      console.error("Error fetching unified metrics for sidebar:", err);
    }
  } else {
    // Extract the existing API centroid calculations directly from the map source
    const features = map.querySourceFeatures("greeneryIndexDynamicSource");
    const matchedFeature = features.find(f => f.properties?.name === barangay);

    if (matchedFeature && matchedFeature.properties) {
      const p = matchedFeature.properties as Record<string, unknown>;
      properties.temperature = p.lst;
      properties.ndvi = p.ndvi;
      properties.treeCanopy = p.treeCanopy;
      properties.greeneryIndex = p.greeneryIndex;
      properties.greeneryLevel = p.level ?? p.greeneryLevel;
    } else {
      console.warn("Could not find loaded barangay metrics in source for:", barangay);
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
