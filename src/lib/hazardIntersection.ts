import { HazardSummary } from "@/types/metrics";
import { booleanIntersects } from "@turf/turf";

export interface GeometryData {
  name: string, 
  geometry: GeoJSON.Geometry,
}

export interface GeometryDatawithProperties extends GeometryData {
  properties: GeoJSON.GeoJsonProperties,
}

export function getHazardsInsideBarangay(
  barangay: GeometryData,
  hazards: GeometryDatawithProperties[]
): GeometryDatawithProperties[] {
  const barangayGeom = barangay.geometry;
  return hazards.filter(hazard => {
    const hazardGeom = hazard.geometry;

    try {
      return booleanIntersects(
        { type: "Feature", geometry: hazardGeom, properties: {} },
        { type: "Feature", geometry: barangayGeom, properties: {} }
      );
    } catch (e) {
      console.warn("skipping invalid geometry:", hazard);
      return false;
    }
  });
}

export function summarizeHazards(hazards: GeometryDatawithProperties[]): HazardSummary[] {
  const layerMap: Record<string, number[]> = {};

  hazards.forEach(hazard => {
    const layerName = hazard.name;
    let value: number | undefined;

    // pick Var or HAZ property
    if ('Var' in hazard.properties!) value = hazard.properties['Var'] as number;
    else if ('HAZ' in hazard.properties!) value = hazard.properties['HAZ'] as number;

    if (value === undefined) return;

    if (!layerMap[layerName]) layerMap[layerName] = [];
    layerMap[layerName].push(value);
  });

  const result: HazardSummary[] = Object.entries(layerMap).map(([name, values]) => {
    const freqMap: Record<number, number> = {};

    values.forEach(v => {
      freqMap[v] = (freqMap[v] || 0) + 1;
    });


    let mostCommonValue = values[0];
    let maxCount = 0;

    Object.entries(freqMap).forEach(([val, count]) => {
      if (count > maxCount) {
        mostCommonValue = parseInt(val);
        maxCount = count;
      }
    });

    return { name, mostCommonValue, count: maxCount };
  });

  return result;
}
