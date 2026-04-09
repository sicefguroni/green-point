interface BarangayCentroid {
  name: string;
  lat: number;
  lng: number;
}

export function computeBarangayCentroids(geoJson: GeoJSON.FeatureCollection): BarangayCentroid[] {
  const results: BarangayCentroid[] = [];

  for (const f of geoJson.features) {
    const geom = f.geometry;
    if (!geom) continue;

    let ring: number[][] | undefined;

    if (geom.type === "Polygon") {
      ring = geom.coordinates[0];
    } else if (geom.type === "MultiPolygon") {
      ring = geom.coordinates[0][0];
    }

    if (!ring || ring.length === 0) continue;

    let sumLat = 0;
    let sumLng = 0;
    for (const [lng, lat] of ring) {
      sumLat += lat;
      sumLng += lng;
    }

    results.push({
      name: f.properties?.name ?? "Unknown",
      lat: sumLat / ring.length,
      lng: sumLng / ring.length,
    });
  }

  return results;
}
