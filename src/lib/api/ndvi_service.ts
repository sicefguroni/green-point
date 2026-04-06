const GIBS_WMS_BASE = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi";
const MODIS_NDVI_LAYER = "MODIS_Terra_NDVI_8Day";

interface NdviResult {
  ndvi: number | null;
  source: string;
  date: string;
}

function getRecentNdviDate(): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - 10);
  return now.toISOString().split("T")[0];
}

export async function fetchNdviAtPoint(
  lat: number,
  lng: number,
): Promise<NdviResult> {
  const date = getRecentNdviDate();
  const delta = 0.005;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;

  const params = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.1.1",
    REQUEST: "GetFeatureInfo",
    LAYERS: MODIS_NDVI_LAYER,
    QUERY_LAYERS: MODIS_NDVI_LAYER,
    SRS: "EPSG:4326",
    BBOX: bbox,
    WIDTH: "3",
    HEIGHT: "3",
    X: "1",
    Y: "1",
    INFO_FORMAT: "text/xml",
    TIME: date,
  });

  try {
    const res = await fetch(`${GIBS_WMS_BASE}?${params}`, { next: { revalidate: 86400 } });
    if (!res.ok) {
      return await fetchNdviFromPowerFallback(lat, lng, date);
    }

    const text = await res.text();
    const ndviMatch = text.match(/NDVI[^>]*>([0-9.-]+)/i) ?? text.match(/value[^>]*>([0-9.-]+)/i);

    if (ndviMatch) {
      let raw = parseFloat(ndviMatch[1]);
      if (raw > 1) raw = raw / 10000;
      if (raw >= -1 && raw <= 1) {
        return { ndvi: parseFloat(raw.toFixed(3)), source: "NASA GIBS MODIS", date };
      }
    }

    return await fetchNdviFromPowerFallback(lat, lng, date);
  } catch {
    return await fetchNdviFromPowerFallback(lat, lng, date);
  }
}

async function fetchNdviFromPowerFallback(
  lat: number,
  lng: number,
  date: string,
): Promise<NdviResult> {
  try {
    const dateStr = date.replace(/-/g, "");
    const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,RH2M,PRECTOTCORR&community=AG&longitude=${lng}&latitude=${lat}&start=${dateStr}&end=${dateStr}&format=JSON`;

    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return { ndvi: null, source: "unavailable", date };

    const json = await res.json();
    const params = json?.properties?.parameter;
    const t2m = params?.T2M?.[dateStr];
    const rh = params?.RH2M?.[dateStr];
    const precip = params?.PRECTOTCORR?.[dateStr];

    if (t2m == null || t2m === -999) return { ndvi: null, source: "unavailable", date };

    const tempFactor = Math.min(1, Math.max(0, (t2m - 10) / 25));
    const moistureFactor = rh && rh !== -999 ? Math.min(1, rh / 100) : 0.5;
    const precipBonus = precip && precip !== -999 ? Math.min(0.1, precip / 50) : 0;

    const estimatedNdvi = parseFloat(
      (0.1 + tempFactor * 0.4 + moistureFactor * 0.3 + precipBonus).toFixed(3),
    );

    return {
      ndvi: Math.min(0.9, Math.max(0.05, estimatedNdvi)),
      source: "NASA POWER (estimated from climate variables)",
      date,
    };
  } catch {
    return { ndvi: null, source: "unavailable", date };
  }
}

export async function fetchNdviBulk(
  coordinates: { lat: number; lng: number; name: string }[],
): Promise<Map<string, NdviResult>> {
  const results = new Map<string, NdviResult>();
  const promises = coordinates.map(async (coord) => {
    const data = await fetchNdviAtPoint(coord.lat, coord.lng);
    results.set(coord.name, data);
  });
  await Promise.allSettled(promises);
  return results;
}
