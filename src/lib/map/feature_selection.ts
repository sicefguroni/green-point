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

  // Fire immediate "loading" callback so the sidebar shows a state immediately
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

  const point = map.project([coords.lng, coords.lat]);

  // Fire all async fetches in parallel: geocode + WAQI + point metrics
  const [geocodeResult, airData, pointMetricsResult] = await Promise.all([
    // Geocode (Mapbox reverse geocode)
    (async () => {
      const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${coords.lng},${coords.lat}.json?access_token=${mapboxgl.accessToken}`;
      try {
        const response = await fetch(geocodeUrl);
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          return data.features[0].place_name;
        }
      } catch (error) {
        console.error("Error fetching address:", error);
      }
      return "Unknown Address";
    })(),
    // WAQI air quality (always fetched — used in all selection modes)
    getAirQualityData(coords.lat, coords.lng),
    // Point environmental metrics
    selectionMode === "poi"
      ? (async () => {
          const metricsUrl = `/api/data?resource=point&lat=${coords.lat}&lng=${coords.lng}`;
          try {
            const res = await fetch(metricsUrl);
            const obj = await res.json();
            if (obj.ok && obj.data?.success && obj.data.metrics) {
              return obj.data.metrics as Record<string, unknown>;
            }
          } catch (err) {
            console.error("Error fetching point metrics:", err);
          }
          return null;
        })()
      : Promise.resolve(null),
  ]);

  const address = geocodeResult ?? "Unknown Address";

  const hazards: FeatureHazardData = {
    flood: getFloodData(map, point),
    storm: getStormData(map, point),
    air: airData,
  };

  const properties = { ...(feature.properties || {}) };

  // Apply point metrics from parallel fetch immediately (avoids duplicate round-trip)
  if (pointMetricsResult) {
    const m = pointMetricsResult as Record<string, unknown>;
    if (typeof m.lst === "number") properties.temperature = m.lst;
    if (typeof m.ndvi === "number") properties.ndvi = m.ndvi;
    if (typeof m.treeCanopy === "number") properties.treeCanopy = m.treeCanopy;
    if (typeof m.greeneryIndex === "number") properties.greeneryIndex = m.greeneryIndex;
    if (typeof m.nearbyTaggedTreeCount === "number") properties.nearbyTaggedTreeCount = m.nearbyTaggedTreeCount;
    if (typeof m.inventoryCanopyFraction === "number") properties.inventoryCanopyFraction = m.inventoryCanopyFraction;
  }

  // For POI mode: resolve barangay via turf if not already known
  if (selectionMode === "poi") {
    if (!resolvedBarangay || resolvedBarangay === "Unknown Barangay") {
      try {
        const bundle = await fetchMapEnvBundle();
        const features = bundle.barangayGeoJson.greeneryIndex.features ?? [];
        const pt = turf.point([coords.lng, coords.lat]);
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
              pt,
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
    // Barangay / custom mode: populate metrics from the map source or bundle
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
    name,
    coords,
    address,
    properties,
    barangay: resolvedBarangay,
    customSelectionGeometry,
    customSelectionAreaHectares,
    pointSelectionAreaHectares:
      selectionMode === "poi" ? POINT_SELECTION_AREA_HECTARES : null,
    hazards,
    isLoadingMetrics: false,
  };

  if (onFeatureSelected) {
    onFeatureSelected(finalSelected);
  }

  map.flyTo({ center: [coords.lng, coords.lat], zoom: 16, duration: 2000 });
  
  return finalSelected;
}
