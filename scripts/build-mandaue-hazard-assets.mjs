/**
 * Preprocesses Mandaue hazard KML under public/geo into Mapbox-friendly assets:
 * - Vector KML → GeoJSON with numeric `level` (1 = low, 2 = moderate, …)
 * - Super-overlay KML → overlays.json manifest for image sources
 */
import fs from "fs";
import path from "path";

const GEO_ROOT = path.join(process.cwd(), "public", "geo");

const VECTOR_SOURCES = [
  {
    folder: "MandaueLandslide",
    kml: "doc.kml",
    out: "susceptibility.geojson",
    levelFromName: (name) => {
      if (name === "LL") return 1;
      if (name === "ML") return 2;
      return 1;
    },
  },
];

const RASTER_SOURCES = [
  { folder: "liq_2018_072230000_01", kml: "doc.kml", out: "overlays.json" },
  { folder: "eil_2017_072230000_01", kml: "doc.kml", out: "overlays.json" },
];

function parseCoordTriplets(raw) {
  return raw
    .trim()
    .split(/\s+/)
    .map((chunk) => {
      const parts = chunk.split(",").map(Number);
      if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) {
        return null;
      }
      return [parts[0], parts[1]];
    })
    .filter(Boolean);
}

function ringFromCoordinatesBlock(block) {
  const coords = parseCoordTriplets(block);
  if (coords.length < 4) return null;
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coords.push([...first]);
  }
  return coords;
}

function parseVectorKml(content, levelFromName) {
  const features = [];
  const placemarkRegex = /<Placemark[^>]*>([\s\S]*?)<\/Placemark>/gi;
  let match;
  while ((match = placemarkRegex.exec(content)) !== null) {
    const block = match[1];
    const nameMatch = block.match(/<name>([^<]+)<\/name>/i);
    const name = nameMatch?.[1]?.trim() ?? "unknown";
    const level = levelFromName(name);

    const polygonRings = [];
    const coordRegex =
      /<(?:outerBoundaryIs|coordinates)>\s*<[^>]*>\s*<coordinates>([^<]+)<\/coordinates>|<coordinates>([^<]+)<\/coordinates>/gi;
    let coordMatch;
    while ((coordMatch = coordRegex.exec(block)) !== null) {
      const ring = ringFromCoordinatesBlock(coordMatch[1] ?? coordMatch[2]);
      if (ring) polygonRings.push(ring);
    }

    if (polygonRings.length === 0) continue;

    const geometry =
      polygonRings.length === 1
        ? { type: "Polygon", coordinates: polygonRings }
        : { type: "MultiPolygon", coordinates: polygonRings.map((r) => [r]) };

    features.push({
      type: "Feature",
      properties: { name, level, LndslideSu: name },
      geometry,
    });
  }

  return { type: "FeatureCollection", features };
}

/** Leaf tiles use maxLodPixels -1 in the parent Folder's Region. */
function parseSuperOverlayKml(content, baseUrlPath) {
  const overlays = [];
  const folderRegex = /<Folder>([\s\S]*?)<\/Folder>/gi;
  let folderMatch;
  while ((folderMatch = folderRegex.exec(content)) !== null) {
    const folder = folderMatch[1];
    if (!/<maxLodPixels>\s*-1\s*<\/maxLodPixels>/i.test(folder)) continue;

    const hrefMatch = folder.match(/<href>([^<]+)<\/href>/i);
    const boxMatch = folder.match(
      /<LatLonBox>[\s\S]*?<north>([^<]+)<\/north>[\s\S]*?<south>([^<]+)<\/south>[\s\S]*?<east>([^<]+)<\/east>[\s\S]*?<west>([^<]+)<\/west>/i,
    );
    if (!hrefMatch || !boxMatch) continue;

    const north = Number(boxMatch[1]);
    const south = Number(boxMatch[2]);
    const east = Number(boxMatch[3]);
    const west = Number(boxMatch[4]);
    const href = hrefMatch[1].trim();
    const id = href.replace(/\.[^.]+$/, "");

    overlays.push({
      id,
      url: `${baseUrlPath}/${encodeURI(href)}`,
      coordinates: [
        [west, north],
        [east, north],
        [east, south],
        [west, south],
      ],
    });
  }

  return { overlays };
}

function buildVectorAssets() {
  for (const { folder, kml, out, levelFromName } of VECTOR_SOURCES) {
    const dir = path.join(GEO_ROOT, folder);
    const kmlPath = path.join(dir, kml);
    if (!fs.existsSync(kmlPath)) {
      console.warn(`Skip vector (missing): ${kmlPath}`);
      continue;
    }
    const content = fs.readFileSync(kmlPath, "utf8");
    const geojson = parseVectorKml(content, levelFromName);
    const outPath = path.join(dir, out);
    fs.writeFileSync(outPath, JSON.stringify(geojson));
    console.log(`Wrote ${outPath} (${geojson.features.length} features)`);
  }
}

function buildRasterManifests() {
  for (const { folder, kml, out } of RASTER_SOURCES) {
    const dir = path.join(GEO_ROOT, folder);
    const kmlPath = path.join(dir, kml);
    if (!fs.existsSync(kmlPath)) {
      console.warn(`Skip raster (missing): ${kmlPath}`);
      continue;
    }
    const content = fs.readFileSync(kmlPath, "utf8");
    const baseUrlPath = `/geo/${folder}`;
    const manifest = parseSuperOverlayKml(content, baseUrlPath);
    const outPath = path.join(dir, out);
    fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));
    console.log(`Wrote ${outPath} (${manifest.overlays.length} overlays)`);
  }
}

buildVectorAssets();
buildRasterManifests();
