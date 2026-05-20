const NASA_POWER_BASE = "https://power.larc.nasa.gov/api/temporal/daily/point";

interface NasaPowerDailyResult {
  lst: number | null;
  t2m: number | null;
  humidity: number | null;
  precipitation: number | null;
  timestamp: string;
}

function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const d = `${date.getUTCDate()}`.padStart(2, "0");
  return `${y}${m}${d}`;
}

function getRecentDate(daysBack: number = 5): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d;
}

export async function fetchNasaPowerPoint(
  lat: number,
  lng: number,
): Promise<NasaPowerDailyResult> {
  const date = getRecentDate();
  const dateStr = formatDate(date);

  const url = new URL(NASA_POWER_BASE);
  url.searchParams?.set("parameters", "TS,T2M,RH2M,PRECTOTCORR");
  url.searchParams?.set("community", "AG");
  url.searchParams?.set("longitude", lng.toString());
  url.searchParams?.set("latitude", lat.toString());
  url.searchParams?.set("start", dateStr);
  url.searchParams?.set("end", dateStr);
  url.searchParams?.set("format", "JSON");

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
    if (!res.ok) {
      console.error("NASA POWER request failed:", res.statusText);
      return {
        lst: null,
        t2m: null,
        humidity: null,
        precipitation: null,
        timestamp: dateStr,
      };
    }

    const json = await res.json();
    const params = json?.properties?.parameter;

    const ts = params?.TS?.[dateStr];
    const t2m = params?.T2M?.[dateStr];
    const rh = params?.RH2M?.[dateStr];
    const precip = params?.PRECTOTCORR?.[dateStr];

    return {
      lst: ts && ts !== -999 ? parseFloat(ts.toFixed(2)) : null,
      t2m: t2m && t2m !== -999 ? parseFloat(t2m.toFixed(2)) : null,
      humidity: rh && rh !== -999 ? parseFloat(rh.toFixed(1)) : null,
      precipitation:
        precip && precip !== -999 ? parseFloat(precip.toFixed(2)) : null,
      timestamp: dateStr,
    };
  } catch (error) {
    console.error("NASA POWER fetch error:", error);
    return {
      lst: null,
      t2m: null,
      humidity: null,
      precipitation: null,
      timestamp: dateStr,
    };
  }
}

export async function fetchNasaPowerBulk(
  coordinates: { lat: number; lng: number; name: string }[],
): Promise<Map<string, NasaPowerDailyResult>> {
  const results = new Map<string, NasaPowerDailyResult>();
  const promises = coordinates.map(async (coord) => {
    const data = await fetchNasaPowerPoint(coord.lat, coord.lng);
    results.set(coord.name, data);
  });
  await Promise.allSettled(promises);
  return results;
}
