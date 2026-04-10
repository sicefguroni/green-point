/**
 * Deduplicates concurrent GET /api/data?resource=greeneryIndex (city metrics hook + choroplet + explore).
 */

export type GreeneryIndexResourceResult =
  | { ok: true; data: GeoJSON.FeatureCollection }
  | { ok: false; status: number };

let inFlight: Promise<GreeneryIndexResourceResult> | null = null;

export function invalidateGreeneryIndexResourceDeduped(): void {
  inFlight = null;
}

async function loadGreeneryIndexOnce(): Promise<GreeneryIndexResourceResult> {
  const res = await fetch("/api/data?resource=greeneryIndex");
  const json = (await res.json()) as {
    ok?: boolean;
    data?: GeoJSON.FeatureCollection;
  };
  if (!res.ok || !json.ok || !json.data) {
    return { ok: false, status: res.status };
  }
  return { ok: true, data: json.data };
}

export async function fetchGreeneryIndexResourceDeduped(): Promise<GreeneryIndexResourceResult> {
  if (!inFlight) {
    const p = loadGreeneryIndexOnce();
    inFlight = p.finally(() => {
      if (inFlight === p) inFlight = null;
    });
  }
  return inFlight;
}
