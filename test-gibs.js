const GIBS_WMS_BASE = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi";
const MODIS_NDVI_LAYER = "MODIS_Terra_NDVI_8Day";

async function test() {
  const lat = 10.3333;
  const lng = 123.9333; // Mandaue coords
  const delta = 0.005;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - 10);
  const date = now.toISOString().split("T")[0];

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

  const url = `${GIBS_WMS_BASE}?${params}`;
  console.log("Fetching url:", url);
  try {
    const res = await fetch(url);
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response text:", text);
  } catch (e) {
    console.error(e);
  }
}

test();
