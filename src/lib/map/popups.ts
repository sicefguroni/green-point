import mapboxgl from "mapbox-gl";

export function createAQIPopup(p: any): string {
  const aqi = p?.aqi ?? 0;
  const color = aqi <= 50 ? "#2DC937" : aqi <= 100 ? "#E7B416" : "#CC3232";

  return `
    <div class="p-3 font-roboto">
      <h4 class="font-bold text-sm mb-1">Air Quality</h4>
      <p class="text-lg font-semibold" style="color:${color}">AQI ${aqi}</p>
      <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-neutral-600 mt-1">
        <span>PM2.5:</span><span class="font-medium">${p?.pm25 ?? "N/A"} µg/m³</span>
        <span>PM10:</span><span class="font-medium">${p?.pm10 ?? "N/A"} µg/m³</span>
        <span>NO₂:</span><span class="font-medium">${p?.no2 ?? "N/A"} µg/m³</span>
        <span>O₃:</span><span class="font-medium">${p?.o3 ?? "N/A"} µg/m³</span>
      </div>
    </div>
  `;
}

export function createLSTPopup(p: any): string {
  const temp = p?.temperature;
  const rawDate = p?.date as string | undefined;
  const dateStr = rawDate
    ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
    : "N/A";

  return `
    <div class="p-3 font-roboto">
      <h4 class="font-bold text-sm mb-1">Surface Temperature</h4>
      <p class="text-lg font-semibold" style="color:#b2182b">${temp}°C</p>
      <p class="text-xs text-neutral-500">Date: ${dateStr}</p>
      <p class="text-xs text-neutral-400">Source: NASA POWER</p>
    </div>
  `;
}

export function createNDVIPopup(p: any): string {
  const ndvi = p?.ndvi;
  const name = p?.name ?? "";
  const rating =
    ndvi >= 0.6 ? "Dense Vegetation" :
    ndvi >= 0.4 ? "Moderate Vegetation" :
    ndvi >= 0.2 ? "Sparse Vegetation" :
    ndvi >= 0 ? "Barren / Built-up" : "N/A";
  const color =
    ndvi >= 0.6 ? "#006837" :
    ndvi >= 0.4 ? "#66bd63" :
    ndvi >= 0.2 ? "#fee08b" : "#d73027";

  return `
    <div class="p-3 font-roboto">
      <h4 class="font-bold text-sm mb-1">${name ? name + " — " : ""}NDVI</h4>
      <p class="text-lg font-semibold" style="color:${color}">${ndvi?.toFixed(3) ?? "N/A"}</p>
      <p class="text-xs font-medium" style="color:${color}">${rating}</p>
      <p class="text-xs text-neutral-400 mt-1">Source: ${p?.source ?? "NASA"}</p>
    </div>
  `;
}

export function createGreeneryIndexPopup(p: any): string {
  const gi = p?.greeneryIndex;
  const level = p?.level ?? "N/A";
  const name = p?.name ?? "";
  const color =
    gi >= 0.7 ? "#1a9850" :
    gi >= 0.5 ? "#91cf60" :
    gi >= 0.3 ? "#fee08b" : "#d73027";

  return `
    <div class="p-3 font-roboto">
      <h4 class="font-bold text-sm mb-1">${name ? name + " — " : ""}Greenery Index</h4>
      <p class="text-lg font-semibold" style="color:${color}">${gi?.toFixed(3) ?? "N/A"}</p>
      <p class="text-xs font-medium" style="color:${color}">${level}</p>
      <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-neutral-600 mt-1.5">
        <span>NDVI:</span><span class="font-medium">${p?.ndvi?.toFixed(3) ?? "N/A"}</span>
        <span>LST:</span><span class="font-medium">${p?.lst?.toFixed(1) ?? "N/A"}°C</span>
        <span>Canopy:</span><span class="font-medium">${p?.treeCanopy ? (p.treeCanopy * 100).toFixed(1) + "%" : "N/A"}</span>
      </div>
    </div>
  `;
}

