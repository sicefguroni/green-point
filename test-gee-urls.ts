import { getCanopyTileUrl, getGiTileUrl, getNdviTileUrl } from "./src/lib/api/gee_service";

async function testLinks() {
  try {
    const ndvi = await getNdviTileUrl();
    console.log("NDVI URL:", ndvi);
    const canopy = await getCanopyTileUrl();
    console.log("CANOPY URL:", canopy);
    const gi = await getGiTileUrl();
    console.log("GI URL:", gi);
  } catch (err) {
    console.error("FAILED:", err);
  }
}
testLinks();
