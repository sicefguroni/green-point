export interface WaqiComponents {
  pm25?: number;
  pm10?: number;
  o3?: number;
  no2?: number;
  so2?: number;
  co?: number;
  nh3?: number;
}

export interface WaqiResult {
  city: string;
  aqi: number | null;
  dominantPollutant?: string;
  components: WaqiComponents;
}

/**
 * Fetches live air quality from the WAQI API for the nearest monitoring station
 * to the given coordinate.
 *
 * Requires NEXT_PUBLIC_WAQI_TOKEN to be configured; returns null when missing
 * or when the remote service is unavailable.
 */
export async function fetchWaqiAtPoint(
  latitude: number,
  longitude: number,
): Promise<WaqiResult | null> {
  const token = process.env.NEXT_PUBLIC_WAQI_TOKEN;
  if (!token) {
    console.warn(
      "WAQI token missing. Set NEXT_PUBLIC_WAQI_TOKEN to enable live AQI data.",
    );
    return null;
  }

  const url = `https://api.waqi.info/feed/geo:${latitude};${longitude}/?token=${encodeURIComponent(
    token,
  )}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error("WAQI request failed:", response.statusText);
      return null;
    }
    const json = (await response.json()) as {
      status?: string;
      data?: {
        aqi?: number;
        dominentpol?: string;
        city?: { name?: string };
        iaqi?: Record<string, { v?: number }>;
      };
    };

    if (json.status !== "ok" || !json.data) {
      console.error("Unexpected WAQI response:", json);
      return null;
    }

    const componentsRaw = json.data.iaqi ?? {};
    const components: WaqiComponents = {
      pm25: componentsRaw.pm25?.v,
      pm10: componentsRaw.pm10?.v,
      o3: componentsRaw.o3?.v,
      no2: componentsRaw.no2?.v,
      so2: componentsRaw.so2?.v,
      co: componentsRaw.co?.v,
      nh3: componentsRaw.nh3?.v,
    };

    return {
      city: json.data.city?.name ?? "Nearest station",
      aqi: typeof json.data.aqi === "number" ? json.data.aqi : null,
      dominantPollutant: json.data.dominentpol,
      components,
    };
  } catch (error) {
    console.error("WAQI fetch error:", error);
    return null;
  }
}
