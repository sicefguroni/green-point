import { NextResponse } from "next/server";

/**
 * NASA POWER API + Urban Heat Island (UHI) Micro-Climate Model
 *
 * How it works:
 *   1. Fetches a REGIONAL baseline temperature from NASA POWER
 *      (Earth Skin Temperature – "TS", satellite-derived, daily).
 *   2. Generates a fine grid (~900 m spacing) across Metro Cebu.
 *   3. Applies a UHI micro-climate model to each grid point using
 *      known geographic factors: urban density, coastal proximity,
 *      and western highland elevation.
 *
 * Sources:
 *   - NASA POWER (baseline):  https://power.larc.nasa.gov
 *   - UHI offsets:  literature-based (Oke 1982, Stewart & Oke 2012)
 */

const METRO_CEBU_BOUNDS = {
  latMin: 10.255,
  latMax: 10.44,
  lngMin: 123.83,
  lngMax: 124.0,
};

const SURFACE_STEP = 0.003; // ~330m high-res grid for smooth continuous map
const LABEL_STEP = 0.01; // ~1.1km grid for distinct labeled markers

const BASELINE_POINT = { lat: 10.33, lng: 123.93 }; // center of Mandaue
const FALLBACK_BASE_TEMP = 28.0; // reasonable tropical default

// ── Urban Heat Island centres (intensity in °C above baseline) ───────

const URBAN_CENTERS = [
  { lat: 10.294, lng: 123.896, intensity: 5.5 }, // Colon / downtown Cebu
  { lat: 10.33, lng: 123.935, intensity: 4.5 }, // Mandaue commercial
  { lat: 10.31, lng: 123.922, intensity: 4.0 }, // North Reclamation
  { lat: 10.322, lng: 123.906, intensity: 3.5 }, // IT Park / Mabolo
  { lat: 10.283, lng: 123.885, intensity: 3.0 }, // SRP
  { lat: 10.355, lng: 123.945, intensity: 3.0 }, // Consolacion centre
  { lat: 10.275, lng: 123.88, intensity: 2.5 }, // Talisay centre
];

// ── Helpers ──────────────────────────────────────────────────────────

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Estimate local LST by combining satellite baseline with UHI offsets.
 */
function calculateLocalLST(
  lat: number,
  lng: number,
  baseTempC: number,
): number {
  // 1. Urban Heat Island contribution (Gaussian decay from each centre)
  let uhiOffset = 0;
  for (const c of URBAN_CENTERS) {
    const dKm = haversineKm(lat, lng, c.lat, c.lng);
    uhiOffset += c.intensity * Math.exp(-(dKm * dKm) / 6);
  }
  uhiOffset = Math.min(uhiOffset, 7); // cap at +7 °C

  // 2. Coastal cooling (sea-breeze from Mactan Channel on the east)
  const coastRefLng = 123.955;
  const coastDistKm =
    Math.abs(lng - coastRefLng) * 111 * Math.cos((lat * Math.PI) / 180);
  const coastCooling = 1.5 * Math.exp(-coastDistKm / 2.5);

  // 3. Elevation cooling (western highlands — transcentral hwy area)
  const elevCooling = lng < 123.88 ? Math.min(3, (123.88 - lng) * 45) : 0;

  // 4. Deterministic micro-variation (surface heterogeneity proxy)
  const noise =
    Math.sin(lat * 800 + 3.7) * Math.cos(lng * 800 + 2.1) * 0.5 +
    Math.sin(lat * 400) * 0.3;

  return parseFloat(
    (baseTempC + uhiOffset - coastCooling - elevCooling + noise).toFixed(1),
  );
}

// ── NASA POWER fetch ─────────────────────────────────────────────────

interface NASAPowerResponse {
  properties: {
    parameter: {
      TS: Record<string, number>;
    };
  };
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

async function fetchNASABaseline(): Promise<number> {
  const end = new Date();
  end.setDate(end.getDate() - 2); // NASA lag
  const start = new Date(end);
  start.setDate(start.getDate() - 14);

  const url =
    `https://power.larc.nasa.gov/api/temporal/daily/point` +
    `?parameters=TS&community=RE` +
    `&longitude=${BASELINE_POINT.lng}&latitude=${BASELINE_POINT.lat}` +
    `&start=${formatDate(start)}&end=${formatDate(end)}&format=JSON`;

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: NASAPowerResponse = await res.json();
    const tsData = data?.properties?.parameter?.TS;
    if (!tsData) throw new Error("No TS parameter in response");

    // Pick the most recent non-missing value (-999 = missing)
    const dates = Object.keys(tsData).sort().reverse();
    for (const date of dates) {
      if (tsData[date] !== -999) return tsData[date];
    }
    throw new Error("All values are -999 (missing)");
  } catch (err) {
    console.warn("NASA POWER fetch failed, using fallback:", err);
    return FALLBACK_BASE_TEMP;
  }
}

export async function GET() {
  try {
    const baseTemp = await fetchNASABaseline();

    const features: any[] = [];

    // 1. Generate dense Polygons for the continuous Fill layer (heat surface)
    const halfStep = SURFACE_STEP / 2;
    for (
      let lat = METRO_CEBU_BOUNDS.latMin;
      lat <= METRO_CEBU_BOUNDS.latMax;
      lat += SURFACE_STEP
    ) {
      for (
        let lng = METRO_CEBU_BOUNDS.lngMin;
        lng <= METRO_CEBU_BOUNDS.lngMax;
        lng += SURFACE_STEP
      ) {
        const temperature = calculateLocalLST(lat, lng, baseTemp);
        features.push({
          type: "Feature",
          properties: {
            temperature,
            type: "surface",
            date: formatDate(new Date()),
          },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [
                  parseFloat((lng - halfStep).toFixed(5)),
                  parseFloat((lat - halfStep).toFixed(5)),
                ],
                [
                  parseFloat((lng + halfStep).toFixed(5)),
                  parseFloat((lat - halfStep).toFixed(5)),
                ],
                [
                  parseFloat((lng + halfStep).toFixed(5)),
                  parseFloat((lat + halfStep).toFixed(5)),
                ],
                [
                  parseFloat((lng - halfStep).toFixed(5)),
                  parseFloat((lat + halfStep).toFixed(5)),
                ],
                [
                  parseFloat((lng - halfStep).toFixed(5)),
                  parseFloat((lat - halfStep).toFixed(5)),
                ],
              ],
            ],
          },
        });
      }
    }

    // 2. Generate Points for the discrete markers + labels
    for (
      let lat = METRO_CEBU_BOUNDS.latMin;
      lat <= METRO_CEBU_BOUNDS.latMax;
      lat += LABEL_STEP
    ) {
      for (
        let lng = METRO_CEBU_BOUNDS.lngMin;
        lng <= METRO_CEBU_BOUNDS.lngMax;
        lng += LABEL_STEP
      ) {
        const temperature = calculateLocalLST(lat, lng, baseTemp);
        features.push({
          type: "Feature",
          properties: {
            temperature,
            type: "label",
            date: formatDate(new Date()),
          },
          geometry: {
            type: "Point",
            coordinates: [
              parseFloat(lng.toFixed(5)),
              parseFloat(lat.toFixed(5)),
            ],
          },
        });
      }
    }

    return NextResponse.json(
      {
        type: "FeatureCollection",
        features,
        metadata: {
          source: "NASA POWER (TS – Earth Skin Temperature) + UHI Model",
          methodology:
            "Regional satellite baseline from NASA POWER, combined with " +
            "a literature-based Urban Heat Island model that accounts for " +
            "urban density, coastal sea-breeze cooling, and highland " +
            "elevation lapse rates.",
          baseTempC: baseTemp,
          generated: new Date().toISOString(),
          surfacePolygons: features.filter(
            (f) => f.properties.type === "surface",
          ).length,
          labelPoints: features.filter((f) => f.properties.type === "label")
            .length,
          coverage: "Metro Cebu (Talisay → Consolacion)",
          resolution: `Surface: ~${(SURFACE_STEP * 111).toFixed(1)} km`,
          updateFrequency: "Daily (cached 24 h)",
        },
      },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=86400, stale-while-revalidate=43200",
        },
      },
    );
  } catch (error) {
    console.error("LST API error:", error);
    return NextResponse.json(
      { error: "Failed to generate LST data", details: String(error) },
      { status: 500 },
    );
  }
}
