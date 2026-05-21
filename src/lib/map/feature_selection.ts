import mapboxgl from "mapbox-gl";
import { getAirQualityData, getFloodData, getStormData } from "@/lib/api/get_hazard_data";
import { fetchMapEnvBundle } from "@/lib/data-api/client";
import { POINT_SELECTION_AREA_HECTARES } from "@/lib/selection-area";
import { type LocationSelectionMode } from "@/types/maplayers";
import { FeatureHazardData, SelectedFeature } from "@/types/metrics";
import * as turf from "@turf/turf";

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
  let resolvedBarangay = barangay;

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

  if (onFeatureSelected) {
    onFeatureSelected({
      name,
      coords,
      address: "Loading address...",
      properties: { ...(feature.properties || {}) },
      barangay,
      customSelectionGeometry,
      customSelectionAreaHectares,
      isLoadingMetrics: true,
    });
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
    pointSelectionAreaHectares:
      selectionMode === "poi" ? POINT_SELECTION_AREA_HECTARES : null,
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
        properties.nearbyTaggedTreeCount = payload.metrics.nearbyTaggedTreeCount ?? 0;
        properties.inventoryCanopyFraction = payload.metrics.inventoryCanopyFraction ?? 0;
      }
    } catch (err) {
      console.error("Error fetching unified metrics for sidebar:", err);
    }

    if (!resolvedBarangay || resolvedBarangay === "Unknown Barangay") {
      try {
        const bundle = await fetchMapEnvBundle();
        const features = bundle.barangayGeoJson.greeneryIndex.features ?? [];
        const point = turf.point([coords.lng, coords.lat]);
        const matchedBarangay = features.find((f) => {
          if (!f.geometry) return false;
          if (
            f.geometry.type !== "Polygon" &&
            f.geometry.type !== "MultiPolygon"
          ) {
            return false;
          }

          try {
            return turf.booleanPointInPolygon(
              point,
              f as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
            );
          } catch {
            return false;
          }
        });

        const inferredBarangay = matchedBarangay?.properties?.name;
        if (typeof inferredBarangay === "string" && inferredBarangay.trim()) {
          resolvedBarangay = inferredBarangay;
        }
      } catch (err) {
        console.error("Error resolving pin barangay from geometry bundle:", err);
      }
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
            properties.inventoryTreeCount = p.inventoryTreeCount ?? 0;
            properties.inventoryCanopyFraction = p.inventoryCanopyFraction ?? 0;
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
          properties.inventoryTreeCount = p.inventoryTreeCount ?? 0;
          properties.inventoryCanopyFraction = p.inventoryCanopyFraction ?? 0;
        }
      } catch (err) {
        console.error("Error loading barangay metrics bundle:", err);
      }
    }

    if (selectionMode === "custom" && customSelectionGeometry) {
      try {
        const treeFeatures = map.querySourceFeatures("taggedTreesSource");
        const poly = turf.polygon(customSelectionGeometry.coordinates);
        
        const treesInside = treeFeatures.filter((f) => {
          if (f.geometry.type !== "Point") return false;
          const pt = turf.point(f.geometry.coordinates as [number, number]);
          return turf.booleanPointInPolygon(pt, poly);
        });

        properties.inventoryTreeCount = treesInside.length;
        
        if (customSelectionAreaHectares && customSelectionAreaHectares > 0) {
          const areaM2 = customSelectionAreaHectares * 10000;
          
          const crownAreaM2 = (dbhCm: number, heightFt: number | null) => {
            const h = heightFt != null ? heightFt * 0.3048 : null;
            const r = h != null
              ? 0.5 * Math.pow(dbhCm, 0.6) * Math.pow(h, 0.3)
              : 1.5 + 0.04 * dbhCm;
            return Math.PI * r * r;
          };

          const totalCrownArea = treesInside.reduce((sum, f) => {
            const dbh = (f.properties?.dbh_cm as number) ?? 15;
            const height = (f.properties?.height_ft as number) ?? null;
            return sum + crownAreaM2(dbh, height);
          }, 0);

          properties.inventoryCanopyFraction = Math.min(1, totalCrownArea / areaM2);
        }
      } catch (err) {
        console.error("Error calculating trees for custom selection:", err);
      }
    }
  }

  const finalSelected: SelectedFeature = {
    ...initialSelected,
    properties,
    barangay: resolvedBarangay,
    isLoadingMetrics: false,
  };

  if (onFeatureSelected) {
    onFeatureSelected(finalSelected);
  }

  map.flyTo({ center: [coords.lng, coords.lat], zoom: 16, duration: 2000 });
  
  return finalSelected;
}
