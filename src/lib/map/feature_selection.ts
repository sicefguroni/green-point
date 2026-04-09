import mapboxgl from "mapbox-gl";
import {
  getAirQualityData,
  getFloodData,
  getStormData,
} from "@/lib/api/get_hazard_data";
import { FeatureHazardData, SelectedFeature } from "@/types/metrics";

export async function handleFeatureSelection(
  feature: mapboxgl.GeoJSONFeature,
  coords: { lng: number; lat: number },
  barangay: string,
  map: mapboxgl.Map,
  markerRef: React.MutableRefObject<mapboxgl.Marker | null>,
  onFeatureSelected?: (featureData: SelectedFeature) => void,
) {
  const name = feature.properties?.name || "Unnamed Point";

  if (markerRef.current) {
    markerRef.current.remove();
  }
  markerRef.current = new mapboxgl.Marker({ color: "#DB4848" })
    .setLngLat([coords.lng, coords.lat])
    .addTo(map);

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

  const selected: SelectedFeature = {
    name,
    coords,
    address,
    properties: feature.properties,
    barangay,
    hazards,
  };

  console.debug("Feature Selection Helper: selected feature ->", selected);
  if (onFeatureSelected) {
    onFeatureSelected(selected);
  }

  map.flyTo({ center: [coords.lng, coords.lat], zoom: 16, duration: 2000 });

  return selected;
}
