/* eslint-disable @typescript-eslint/no-explicit-any */
import ee from "@google/earthengine";
import fs from "node:fs/promises";
import path from "node:path";

let geeInitialized = false;
let geeInitializing: Promise<void> | null = null;
let geeCredentialSourceLogged = false;

type GeePrivateKey = {
  project_id: string;
  [key: string]: unknown;
};

function isGeePrivateKey(value: unknown): value is GeePrivateKey {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { project_id?: unknown }).project_id === "string"
  );
}

async function loadGeePrivateKey(): Promise<GeePrivateKey> {
  const envJson = process.env.GEE_SERVICE_ACCOUNT_JSON?.trim();
  if (envJson) {
    try {
      const parsed = JSON.parse(envJson) as unknown;
      if (!isGeePrivateKey(parsed)) {
        throw new Error("project_id is missing");
      }
      return parsed;
    } catch (err) {
      throw new Error(`Failed to parse GEE_SERVICE_ACCOUNT_JSON: ${err}`);
    }
  }

  if (process.env.VERCEL === "1" || process.env.VERCEL_ENV) {
    throw new Error(
      "GEE_SERVICE_ACCOUNT_JSON is required in Vercel. gee-key.json is not available in the deployed runtime.",
    );
  }

  const keyPath = path.join(process.cwd(), "gee-key.json");
  try {
    const keyFile = await fs.readFile(keyPath, "utf8");
    const parsed = JSON.parse(keyFile) as unknown;
    if (!isGeePrivateKey(parsed)) {
      throw new Error("project_id is missing");
    }
    return parsed;
  } catch (err) {
    throw new Error(
      `Failed to load Earth Engine credentials. Set GEE_SERVICE_ACCOUNT_JSON or provide gee-key.json: ${err}`,
    );
  }
}

export async function initializeGee(): Promise<void> {
  if (geeInitialized) return;
  if (geeInitializing) return geeInitializing;

  geeInitializing = new Promise(async (resolve, reject) => {
    try {
      const privateKey = await loadGeePrivateKey();

      if (!geeCredentialSourceLogged) {
        geeCredentialSourceLogged = true;
        console.info(
          `[gee] Initializing Earth Engine with ${process.env.GEE_SERVICE_ACCOUNT_JSON?.trim() ? "GEE_SERVICE_ACCOUNT_JSON" : "gee-key.json"}`,
        );
      }

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
      reject(
        err instanceof Error
          ? err
          : new Error(`Failed to initialize Earth Engine: ${err}`),
      );
    }
  });

  return geeInitializing;
}

function buildGeeQuery(geometry: any, endDate?: Date): any {
  const currentDate = endDate || new Date();
  const pastDate = new Date(currentDate);
  pastDate.setFullYear(currentDate.getFullYear() - 1);
  const startD = pastDate.toISOString().split("T")[0];
  const endD = currentDate.toISOString().split("T")[0];

  const s2 = ee
    .ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
    .filterBounds(geometry)
    .filterDate(startD, endD)
    .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
    .median();

  const ndviImg = s2.normalizedDifference(["B8", "B4"]).rename("NDVI");

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
  endDate?: Date,
): Promise<{ ndvi: number | null; lst: number | null }> {
  await initializeGee();

  return new Promise((resolve, reject) => {
    try {
      const point = ee.Geometry.Point([lng, lat]);
      const combined = buildGeeQuery(point, endDate);

      const sampled = combined.reduceRegion({
        reducer: ee.Reducer.first(),
        geometry: point,
        scale: 10,
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

export type BarangayPolygon = {
  name: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
};

export type PolygonMetrics = { ndvi: number | null; lst: number | null };

/** The bundled type declarations cover only part of the Earth Engine API. */
const eeAny = ee as any;

/** Minimum clean MODIS days per pixel in a window. */
const MIN_LST_DAYS = 3;

/**
 * Cloud Score+ threshold for Sentinel-2 pixels (0-1, higher = clearer).
 * Google's recommended range is 0.5-0.65. Unlike the SCL band, Cloud Score+
 * also catches thin cloud and haze, which pulled monthly NDVI down to ~0.04
 * (Dec 2024) when only SCL was used.
 */
const CLOUD_SCORE_PLUS_MIN = 0.6;

/**
 * NDVI and daytime LST over a date window, with no fill values: pixels with no
 * usable observation stay masked, so a polygon with no data reduces to null.
 * Fully masked placeholder images are merged in so an empty window yields
 * masked bands rather than an error.
 */
function buildWindowQuery(geometry: any, start: Date, end: Date): any {
  const startD = start.toISOString().split("T")[0];
  const endD = end.toISOString().split("T")[0];

  const emptyS2 = eeAny.Image.constant([0, 0])
    .rename(["B4", "B8"])
    .toFloat()
    .updateMask(0);
  const s2 = eeAny
    .ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
    .filterBounds(geometry)
    .filterDate(startD, endD)
    .linkCollection(
      eeAny.ImageCollection("GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED"),
      ["cs_cdf"],
    )
    .map((img: any) =>
      img
        .select(["B4", "B8"])
        .toFloat()
        .updateMask(img.select("cs_cdf").gte(CLOUD_SCORE_PLUS_MIN)),
    )
    .merge(eeAny.ImageCollection([emptyS2]))
    .median();
  const ndvi = s2.normalizedDifference(["B8", "B4"]).rename("NDVI");

  const emptyLst = eeAny.Image.constant(0)
    .rename("LST_Day_1km")
    .toFloat()
    .updateMask(0);
  const lstDays = eeAny
    .ImageCollection("MODIS/061/MOD11A1")
    .filterBounds(geometry)
    .filterDate(startD, endD)
    // QC_Day: keep "good quality" (bits 0-1 = 00), or "other quality" (01)
    // with an average LST error of at most 2 K (bits 6-7 <= 01). Unfiltered,
    // cloud-edge retrievals read 15-20 °C in rainy months.
    .map((img: any) => {
      const qc = img.select("QC_Day");
      const mandatory = qc.bitwiseAnd(3);
      const error = qc.rightShift(6).bitwiseAnd(3);
      const ok = mandatory.eq(0).or(mandatory.eq(1).and(error.lte(1)));
      return img.select("LST_Day_1km").toFloat().updateMask(ok);
    })
    .merge(eeAny.ImageCollection([emptyLst]));
  // A pixel needs at least MIN_LST_DAYS clean days in the window; one or two
  // stray retrievals otherwise decide a month (e.g. 17.6 °C in Oct 2026).
  const lst = lstDays
    .median()
    .updateMask(lstDays.count().gte(MIN_LST_DAYS))
    .multiply(0.02)
    .subtract(273.15)
    .rename("LST");

  return ndvi.addBands(lst);
}

/**
 * Mean NDVI and LST over each barangay polygon for a date window (area-weighted
 * at 10 m). Replaces sampling one pixel at each centroid, where a single roof
 * or river pixel decided the barangay's value. Values are null when the window
 * has no usable imagery for that polygon.
 */
export async function fetchGeeMetricsForPolygons(
  polygons: BarangayPolygon[],
  window: { start: Date; end: Date },
): Promise<Map<string, PolygonMetrics>> {
  await initializeGee();

  return new Promise((resolve, reject) => {
    try {
      const fc = eeAny.FeatureCollection(
        polygons.map((p) =>
          eeAny.Feature(eeAny.Geometry(p.geometry), { name: p.name }),
        ),
      );
      const image = buildWindowQuery(fc.geometry(), window.start, window.end);
      const reduced = image.reduceRegions({
        collection: fc,
        reducer: eeAny.Reducer.mean(),
        scale: 10,
        tileScale: 4,
      });

      reduced.evaluate((result: any, error: any) => {
        if (error) {
          reject(new Error(error));
          return;
        }
        const map = new Map<string, PolygonMetrics>();
        for (const f of result?.features ?? []) {
          const name = f.properties?.name;
          if (typeof name !== "string") continue;
          const ndvi = f.properties?.NDVI;
          const lst = f.properties?.LST;
          map.set(name, {
            ndvi: typeof ndvi === "number" ? parseFloat(ndvi.toFixed(3)) : null,
            lst: typeof lst === "number" ? parseFloat(lst.toFixed(2)) : null,
          });
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
          if (err) {
            reject(new Error(err));
            return;
          }
          resolve(mapObj.urlFormat);
        },
      );
    } catch (err) {
      reject(err);
    }
  });
}

export type TreePoint = { lat: number; lng: number; dbhCm?: number | null };

function buildTreeDensityImage(treePoints: TreePoint[]): any | null {
  if (treePoints.length === 0) return null;

  const features = treePoints.map((t) => {
    const r = Math.min(15, 1.5 + 0.04 * (t.dbhCm ?? 15));

    return ee.Feature((ee.Geometry.Point([t.lng, t.lat]) as any).buffer(r), {
      canopySignal: 0.65,
    });
  });

  const fc = ee.FeatureCollection(features);

  const painted = (fc as any).reduceToImage(
    ["canopySignal"],
    (ee.Reducer as any).max(),
  );

  return painted.unmask(0);
}

function computeCanopyAndGi(combined: any, treePoints?: TreePoint[]) {
  const ndvi = combined.select("NDVI");
  const lst = combined.select("LST");

  const spectralRaw = (ee.Image(0.0) as any)
    .updateMask(ndvi.mask())
    .where(ndvi.gt(0.6), 0.45)
    .where(ndvi.gt(0.4).and(ndvi.lte(0.6)), ndvi.subtract(0.4).multiply(2.25))
    .where(ndvi.gt(0.35).and(ndvi.lte(0.4)), ndvi.subtract(0.35).multiply(1.0));

  const spectralAdjusted = spectralRaw
    .where(lst.gt(35).and(ndvi.lt(0.5)), spectralRaw.multiply(0.5))
    .where(lst.gt(38), spectralRaw.multiply(0.2));

  const spectralCanopy = spectralAdjusted.multiply(0.7);

  const treeDensity = buildTreeDensityImage(treePoints ?? []);

  const canopy = treeDensity
    ? (treeDensity as any).updateMask(ndvi.mask()).max(spectralCanopy)
    : spectralCanopy;

  const normLST = lst.subtract(20).divide(20).clamp(0, 1);
  const greenArea = (ee.Image(0.0) as any)
    .updateMask(ndvi.mask())
    .where(ndvi.gt(0.2), 1.0);

  const gi = ndvi
    .multiply(0.35)
    .add(
      (ee.Image(1.0) as any)
        .updateMask(ndvi.mask())
        .subtract(normLST)
        .multiply(0.25),
    )
    .add(canopy.multiply(0.25))
    .add(greenArea.multiply(0.15))
    .clamp(0, 1);

  return { canopy, gi };
}

export async function getCanopyTileUrl(
  treePoints?: TreePoint[],
): Promise<string> {
  await initializeGee();
  const bounds = getMandaueBounds();
  return new Promise((resolve, reject) => {
    try {
      const combined = buildGeeQuery(bounds).clip(bounds);
      const { canopy } = computeCanopyAndGi(combined, treePoints);
      canopy.getMap(
        {
          min: 0,
          max: 0.8,
          palette: ["f7fcb1", "addd8e", "78c679", "31a354", "006837"],
        },
        (mapObj: any, err: any) => {
          if (err) {
            reject(new Error(err));
            return;
          }
          resolve(mapObj.urlFormat);
        },
      );
    } catch (err) {
      reject(err);
    }
  });
}

export async function getGiTileUrl(treePoints?: TreePoint[]): Promise<string> {
  await initializeGee();
  const bounds = getMandaueBounds();
  return new Promise((resolve, reject) => {
    try {
      const combined = buildGeeQuery(bounds).clip(bounds);
      const { gi } = computeCanopyAndGi(combined, treePoints);
      gi.getMap(
        {
          min: 0.1,
          max: 0.85,
          palette: ["d73027", "fc8d59", "fee08b", "d9ef8b", "91cf60", "1a9850"],
        },
        (mapObj: any, err: any) => {
          if (err) {
            reject(new Error(err));
            return;
          }
          resolve(mapObj.urlFormat);
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
          if (err) {
            reject(new Error(err));
            return;
          }
          resolve(mapObj.urlFormat);
        },
      );
    } catch (err) {
      reject(err);
    }
  });
}
