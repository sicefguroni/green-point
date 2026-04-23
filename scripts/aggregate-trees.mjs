import fs from "fs";
import path from "path";

const baseDir = "./resources/mandaue-tree-inventory";
const outputDir = "./public/data";
const outputFile = path.join(outputDir, "tagged-trees.json");

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const features = [];

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (file.endsWith(".gpx")) {
      parseGPX(fullPath);
    } else if (file.endsWith(".kml")) {
      parseKML(fullPath);
    }
  }
}

function parseGPX(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const wptRegex = /<wpt lat="([^"]+)" lon="([^"]+)">[\s\S]*?<name>([^<]+)<\/name>/g;
  let match;
  while ((match = wptRegex.exec(content)) !== null) {
    features.push({
      type: "Feature",
      properties: {
        id: match[3],
        source: path.basename(filePath),
        type: "tree",
      },
      geometry: {
        type: "Point",
        coordinates: [parseFloat(match[2]), parseFloat(match[1])],
      },
    });
  }
}

function parseKML(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  // Simple Placemark parser for KML
  const placemarkRegex = /<Placemark>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<coordinates>([^<]+)<\/coordinates>/g;
  let match;
  while ((match = placemarkRegex.exec(content)) !== null) {
    const coords = match[2].trim().split(",");
    if (coords.length >= 2) {
      features.push({
        type: "Feature",
        properties: {
          id: match[1],
          source: path.basename(filePath),
          type: "tree",
        },
        geometry: {
          type: "Point",
          coordinates: [parseFloat(coords[0]), parseFloat(coords[1])],
        },
      });
    }
  }
}

console.log("Aggregating tree tagging data...");
walk(baseDir);

const geojson = {
  type: "FeatureCollection",
  features: features,
};

fs.writeFileSync(outputFile, JSON.stringify(geojson, null, 2));
console.log(`Successfully aggregated ${features.length} trees into ${outputFile}`);
