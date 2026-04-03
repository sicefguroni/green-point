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
