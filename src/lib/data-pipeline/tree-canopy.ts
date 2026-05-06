import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { REVALIDATE_BARANGAY_GEE_BUNDLE } from "@/lib/data-pipeline/constants";

export type TreeInventoryRecord = {
  latitude: number;
  longitude: number;
  dbhCm: number | null;
  heightFt: number | null;
  barangay: string | null;
};

const POINT_SEARCH_RADIUS_M = 150;

function crownRadiusM(dbhCm: number, heightFt: number | null): number {
  const h = heightFt != null ? heightFt * 0.3048 : null;
  return h != null
    ? 0.5 * Math.pow(dbhCm, 0.6) * Math.pow(h, 0.3)
    : 1.5 + 0.04 * dbhCm;
}

function crownAreaM2(dbhCm: number, heightFt: number | null): number {
  const r = crownRadiusM(dbhCm, heightFt);
  return Math.PI * r * r;
}

export function computeInventoryCanopyFraction(
  trees: TreeInventoryRecord[],
  areaM2: number,
): number {
  if (trees.length === 0 || areaM2 <= 0) return 0;
  const totalCrownArea = trees.reduce(
    (sum, t) => sum + crownAreaM2(t.dbhCm ?? 15, t.heightFt),
    0,
  );
  return Math.min(1, totalCrownArea / areaM2);
}

export function blendCanopy(
  inventoryCanopy: number,
  spectralCanopy: number,
  hasInventory: boolean,
): number {
  const discountedSpectral = parseFloat((spectralCanopy * 0.4).toFixed(3));
  if (!hasInventory) return discountedSpectral;
  return parseFloat(
    Math.min(1, Math.max(inventoryCanopy, discountedSpectral)).toFixed(3),
  );
}

function degreesToRadians(d: number) {
  return (d * Math.PI) / 180;
}

function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const dLat = degreesToRadians(lat2 - lat1);
  const dLng = degreesToRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(degreesToRadians(lat1)) *
      Math.cos(degreesToRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function computePointInventoryCanopy(
  lat: number,
  lng: number,
  trees: TreeInventoryRecord[],
): number {
  const nearby = trees.filter(
    (t) =>
      haversineM(lat, lng, t.latitude, t.longitude) <= POINT_SEARCH_RADIUS_M,
  );
  if (nearby.length === 0) return 0;
  return computeInventoryCanopyFraction(
    nearby,
    Math.PI * POINT_SEARCH_RADIUS_M ** 2,
  );
}

async function loadAllTaggedTrees(): Promise<TreeInventoryRecord[]> {
  return prisma.taggedTree.findMany({
    select: {
      latitude: true,
      longitude: true,
      dbhCm: true,
      heightFt: true,
      barangay: true,
    },
  });
}

export const getCachedTaggedTrees = unstable_cache(
  loadAllTaggedTrees,
  ["data-pipeline", "tagged-trees-all"],
  { revalidate: REVALIDATE_BARANGAY_GEE_BUNDLE, tags: ["tagged-trees"] },
);

export function groupTreesByBarangay(
  trees: TreeInventoryRecord[],
): Record<string, TreeInventoryRecord[]> {
  const record: Record<string, TreeInventoryRecord[]> = {};
  for (const t of trees) {
    const key = t.barangay?.trim() ?? "";
    if (!key) continue;
    (record[key] ??= []).push(t);
  }
  return record;
}
