type PopupMetrics = {
  aqi?: number;
  pm25?: number;
  pm10?: number;
  no2?: number;
  o3?: number;
  temperature?: number;
  date?: string;
  ndvi?: number;
  source?: string;
  greeneryIndex?: number;
  level?: string;
  name?: string;
  lst?: number;
  treeCanopy?: number;
  species?: string;
  id?: string;
  dbh_cm?: number;
  height_ft?: number;
  barangay?: string;
  remarks?: string;
};

export function createAQIPopup(p: PopupMetrics): string {
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

export function createLSTPopup(p: PopupMetrics): string {
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

export function createNDVIPopup(p: PopupMetrics): string {
  const ndvi = typeof p?.ndvi === "number" ? p.ndvi : null;
  const name = p?.name ?? "";
  const rating =
    ndvi !== null && ndvi >= 0.6
      ? "Dense Vegetation"
      : ndvi !== null && ndvi >= 0.4
        ? "Moderate Vegetation"
        : ndvi !== null && ndvi >= 0.2
          ? "Sparse Vegetation"
          : ndvi !== null && ndvi >= 0
            ? "Barren / Built-up"
            : "N/A";
  const color =
    ndvi !== null && ndvi >= 0.6
      ? "#006837"
      : ndvi !== null && ndvi >= 0.4
        ? "#66bd63"
        : ndvi !== null && ndvi >= 0.2
          ? "#fee08b"
          : "#d73027";

  return `
    <div class="p-3 font-roboto">
      <h4 class="font-bold text-sm mb-1">${name ? name + " — " : ""}NDVI</h4>
      <p class="text-lg font-semibold" style="color:${color}">${ndvi?.toFixed(3) ?? "N/A"}</p>
      <p class="text-xs font-medium" style="color:${color}">${rating}</p>
      <p class="text-xs text-neutral-400 mt-1">Source: ${p?.source ?? "NASA"}</p>
    </div>
  `;
}

export function createGreeneryIndexPopup(p: PopupMetrics): string {
  const gi = typeof p?.greeneryIndex === "number" ? p.greeneryIndex : null;
  const level = p?.level ?? "N/A";
  const name = p?.name ?? "";
  const color =
    gi !== null && gi >= 0.7
      ? "#1a9850"
      : gi !== null && gi >= 0.5
        ? "#91cf60"
        : gi !== null && gi >= 0.3
          ? "#fee08b"
          : "#d73027";

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

export function createTreePopup(p: PopupMetrics): string {
  const species = p?.species ?? "Unknown Species";
  const barangay = p?.barangay ?? "Unknown Barangay";
  const id = p?.id ?? "N/A";
  const dbh = p?.dbh_cm ? `${p.dbh_cm} cm` : "N/A";
  const height = p?.height_ft ? `${p.height_ft} ft` : "N/A";

  return `
    <div class="p-4 font-roboto min-w-[200px]">
      <div class="flex items-center gap-2 mb-2">
        <div class="w-2 h-2 rounded-full bg-emerald-500"></div>
        <h4 class="font-bold text-base text-neutral-800 leading-tight capitalize">${species}</h4>
      </div>
      
      <div class="space-y-1.5 text-sm">
        <div class="flex justify-between border-b border-neutral-100 pb-1">
          <span class="text-neutral-500">Tree ID:</span>
          <span class="font-medium text-neutral-700">${id}</span>
        </div>
        <div class="flex justify-between border-b border-neutral-100 pb-1">
          <span class="text-neutral-500">Barangay:</span>
          <span class="font-medium text-neutral-700">${barangay}</span>
        </div>
        <div class="flex justify-between border-b border-neutral-100 pb-1">
          <span class="text-neutral-500">DBH:</span>
          <span class="font-medium text-neutral-700">${dbh}</span>
        </div>
        <div class="flex justify-between border-b border-neutral-100 pb-1">
          <span class="text-neutral-500">Height:</span>
          <span class="font-medium text-neutral-700">${height}</span>
        </div>
        ${
          p.remarks
            ? `
        <div class="mt-2 pt-1">
          <span class="text-xs text-neutral-400 uppercase font-bold tracking-wider">Remarks</span>
          <p class="text-xs text-neutral-600 italic mt-0.5">${p.remarks}</p>
        </div>
        `
            : ""
        }
      </div>
      
      <div class="mt-3 text-[10px] text-neutral-400 flex items-center justify-between">
        <span>Survey Data</span>
        <span>Source: ${p?.source?.replace(".xlsx", "") || "Inventory"}</span>
      </div>
    </div>
  `;
}
