/* eslint-disable @typescript-eslint/no-explicit-any */
import ee from "@google/earthengine";
import fs from "node:fs/promises";
import path from "node:path";

let geeInitialized = false;
let geeInitializing: Promise<void> | null = null;

export async function initializeGee(): Promise<void> {
  if (geeInitialized) return;
  if (geeInitializing) return geeInitializing;

  geeInitializing = new Promise(async (resolve, reject) => {
    try {
      const keyPath = path.join(process.cwd(), "gee-key.json");
      const keyFile = await fs.readFile(keyPath, "utf8");
      const privateKey = JSON.parse(keyFile);

      ee.data.authenticateViaPrivateKey(
        privateKey,
        () => {
          ee.initialize(
            null,
            null,
            () => {
              geeInitialized = true;
              resolve();
            },
            (err: any) => {
              reject(
                new Error(
                  `Earth Engine initialization failed: ${err?.message || JSON.stringify(err) || err}`,
                ),
              );
            },
            null,
            privateKey.project_id,
          );
        },
        (err: any) => {
          reject(
            new Error(
              `Earth Engine authentication failed: ${err?.message || JSON.stringify(err)}`,
            ),
          );
        },
      );
    } catch (err) {
      reject(new Error(`Failed to load or parse gee-key.json: ${err}`));
    }
  });

  return geeInitializing;
}

function buildGeeQuery(geometry: any): any /* ee.Image */ {
  const currentDate = new Date();
  const pastDate = new Date();
  pastDate.setFullYear(currentDate.getFullYear() - 1);
  const startD = pastDate.toISOString().split("T")[0];
  const endD = currentDate.toISOString().split("T")[0];

  // Sentinel-2 (10m resolution) median NDVI over the last year
  const s2 = ee
    .ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
    .filterBounds(geometry)
    .filterDate(startD, endD)
    .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
    .median();

  const ndviImg = s2.normalizedDifference(["B8", "B4"]).rename("NDVI");

  // MODIS (1km resolution) median LST over the last year
  // Unmask with a default 30┬░C so coastal polygons/water don't cause missing data (NaN)
  const modis = ee
    .ImageCollection("MODIS/061/MOD11A1")
    .filterBounds(geometry)
    .filterDate(startD, endD)
    .select("LST_Day_1km")
    .median()
    .multiply(0.02)
    .subtract(273.15)
    .unmask(30.0)
    .rename("LST");

  return ndviImg.addBands(modis);
}

export async function fetchGeeMetricsPoint(
  lat: number,
  lng: number,
): Promise<{ ndvi: number | null; lst: number | null }> {
  await initializeGee();

  return new Promise((resolve, reject) => {
    try {
      const point = ee.Geometry.Point([lng, lat]);
      const combined = buildGeeQuery(point);

      const sampled = combined.reduceRegion({
        reducer: ee.Reducer.first(),
        geometry: point,
        scale: 10, // Extract at highest resolution (Sentinel 10m)
      });

      sampled.evaluate((result: any, error: any) => {
        if (error) {
          reject(new Error(error));
          return;
        }
        resolve({
          ndvi:
            result?.NDVI !== undefined
              ? parseFloat(result.NDVI.toFixed(3))
              : null,
          lst:
            result?.LST !== undefined
              ? parseFloat(result.LST.toFixed(2))
              : null,
        });
      });
    } catch (err) {
      reject(err);
    }
  });
}

export async function fetchGeeMetricsBulk(
  coordinates: { name: string; lat: number; lng: number }[],
): Promise<Map<string, { ndvi: number | null; lst: number | null }>> {
  await initializeGee();

  return new Promise((resolve, reject) => {
    try {
      const features = coordinates.map((c) => {
        return ee.Feature(ee.Geometry.Point([c.lng, c.lat]), { name: c.name });
      });
      const fc = ee.FeatureCollection(features);

      const combined = buildGeeQuery(fc.geometry());

      const sampled = combined.reduceRegions({
        collection: fc,
        reducer: ee.Reducer.first(),
        scale: 10,
        tileScale: 4,
      });

      sampled.evaluate((result: any, error: any) => {
        if (error) {
          reject(new Error(error));
          return;
        }

        const map = new Map<
          string,
          { ndvi: number | null; lst: number | null }
        >();
        for (const f of result.features || []) {
          const name = f.properties?.name;
          if (!name) continue;

          let ndvi = f.properties?.NDVI;
          if (typeof ndvi === "number") {
            ndvi = parseFloat(ndvi.toFixed(3));
          } else {
            ndvi = null;
          }

          let lst = f.properties?.LST;
          if (typeof lst === "number") {
            lst = parseFloat(lst.toFixed(2));
          } else {
            lst = null;
          }

          map.set(name, { ndvi, lst });
        }
        resolve(map);
      });
    } catch (err) {
      reject(err);
    }
  });
}

function getMandaueBounds() {
  return ee.Geometry.Rectangle([123.9, 10.3, 123.99, 10.4]);
}

export async function getNdviTileUrl(): Promise<string> {
  await initializeGee();
  const bounds = getMandaueBounds();
  return new Promise((resolve, reject) => {
    try {
      const combined = buildGeeQuery(bounds).clip(bounds);
      const ndvi = combined.select("NDVI");
      ndvi.getMap(
        {
          min: -0.1,
          max: 0.9,
          palette: ["d73027", "fee08b", "d9ef8b", "66bd63", "1a9850", "006837"],
        },
        (mapObj: any, err: any) => {
          err ? reject(new Error(err)) : resolve(mapObj.urlFormat);
        },
      );
    } catch (err) {
      reject(err);
    }
  });
}

function computeCanopyAndGi(combined: any) {
  const ndvi = combined.select("NDVI");
  const lst = combined.select("LST");

  let canopy = ee
    .Image(0.0)
    .where(ndvi.gt(0.6), 0.8)
    .where(
      ndvi.gt(0.3).and(ndvi.lte(0.6)),
      ndvi.subtract(0.3).multiply(1.33).add(0.4),
    )
    .where(ndvi.gt(0.1).and(ndvi.lte(0.3)), ndvi.subtract(0.1).multiply(2.0));

  canopy = canopy
    .where(lst.gt(35).and(ndvi.lt(0.5)), canopy.multiply(0.8))
    .where(lst.gt(38).and(ndvi.lt(0.4)), canopy.multiply(0.5));

  const normLST = lst.subtract(20).divide(20).clamp(0, 1);
  const greenArea = ee.Image(0.0).where(ndvi.gt(0.2), 1.0);

  const gi = ndvi
    .multiply(0.35)
    .add(ee.Image(1.0).subtract(normLST).multiply(0.25))
    .add(canopy.multiply(0.25))
    .add(greenArea.multiply(0.15))
    .clamp(0, 1);

  return { canopy, gi };
}

export async function getCanopyTileUrl(): Promise<string> {
  await initializeGee();
  const bounds = getMandaueBounds();
  return new Promise((resolve, reject) => {
    try {
      const combined = buildGeeQuery(bounds).clip(bounds);
      const { canopy } = computeCanopyAndGi(combined);
      canopy.getMap(
        {
          min: 0,
          max: 0.8,
          palette: ["f7fcb1", "addd8e", "78c679", "31a354", "006837"],
        },
        (mapObj: any, err: any) => {
          err ? reject(new Error(err)) : resolve(mapObj.urlFormat);
        },
      );
    } catch (err) {
      reject(err);
    }
  });
}

export async function getGiTileUrl(): Promise<string> {
  await initializeGee();
  const bounds = getMandaueBounds();
  return new Promise((resolve, reject) => {
    try {
      const combined = buildGeeQuery(bounds).clip(bounds);
      const { gi } = computeCanopyAndGi(combined);
      gi.getMap(
        {
          min: 0.1,
          max: 0.85,
          palette: ["d73027", "fc8d59", "fee08b", "d9ef8b", "91cf60", "1a9850"],
        },
        (mapObj: any, err: any) => {
          err ? reject(new Error(err)) : resolve(mapObj.urlFormat);
        },
      );
    } catch (err) {
      reject(err);
    }
  });
}

export async function getLstTileUrl(): Promise<string> {
  await initializeGee();
  const bounds = getMandaueBounds();
  return new Promise((resolve, reject) => {
    try {
      const combined = buildGeeQuery(bounds).clip(bounds);
      const lst = combined.select("LST");
      lst.getMap(
        {
          min: 24,
          max: 36,
          palette: [
            "313695",
            "4575b4",
            "abd9e9",
            "fee090",
            "f46d43",
            "d73027",
            "a50026",
          ],
        },
        (mapObj: any, err: any) => {
          err ? reject(new Error(err)) : resolve(mapObj.urlFormat);
        },
      );
    } catch (err) {
      reject(err);
    }
  });
}
