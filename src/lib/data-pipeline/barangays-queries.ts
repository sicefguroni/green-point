import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  CACHE_TAG_BARANGAYS,
  REVALIDATE_BARANGAYS_LIST,
  REVALIDATE_BARANGAY_BY_ID,
} from "@/lib/data-pipeline/constants";

export async function getCachedBarangaysWithMetrics(cityId: string | null) {
  const key = cityId ?? "all";
  return unstable_cache(
    async () =>
      cityId
        ? prisma.barangay.findMany({
            where: { cityID: cityId },
            include: { metrics: true, greeneryIndex: true },
          })
        : prisma.barangay.findMany({
            include: { metrics: true, greeneryIndex: true },
          }),
    ["data-pipeline", "barangays-list", key],
    {
      revalidate: REVALIDATE_BARANGAYS_LIST,
      tags: [CACHE_TAG_BARANGAYS],
    },
  )();
}

export async function getCachedBarangayDetailById(id: string) {
  return unstable_cache(
    async () =>
      prisma.barangay.findUnique({
        where: { id },
        include: {
          metrics: true,
          greeneryIndex: true,
          hazardExposures: true,
          points: true,
        },
      }),
    ["data-pipeline", "barangay-detail", id],
    {
      revalidate: REVALIDATE_BARANGAY_BY_ID,
      tags: [CACHE_TAG_BARANGAYS],
    },
  )();
}
