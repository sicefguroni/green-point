import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  readStaticBarangayMetrics,
  generateAIBarangayRecs,
} from "@/lib/recommendations/barangay-backfill";

const CONCURRENCY = 3;

/**
 * POST /api/recommendations/backfill
 *
 * Runs the full AI/RAG pipeline for every Mandaue barangay that does not
 * already have cached recommendations in the GreeningRecommendation table.
 * This is a batch background job — it may take several minutes depending on
 * how many barangays need generation.
 *
 * Request body (optional):
 *   { force?: boolean }  — re-generate even for barangays that already have recs
 *
 * Returns a summary of how many barangays were processed and how many failed.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      force?: boolean;
    };
    const force = body.force === true;

    const staticMetrics = readStaticBarangayMetrics();
    if (staticMetrics.length === 0) {
      return NextResponse.json(
        { success: false, error: "No static barangay metrics found." },
        { status: 500 },
      );
    }

    // Fetch existing recs to skip already-generated barangays
    const existing = await prisma.greeningRecommendation.findMany({
      where: {
        source: "AI Engine",
        barangayID: { not: null },
      },
      include: {
        barangay: { select: { barangayName: true } },
      },
    });

    const existingNames = new Set(
      existing
        .map((r) => r.barangay?.barangayName?.trim().toLowerCase())
        .filter((n): n is string => !!n),
    );

    // Filter barangays that need generation
    const todo = staticMetrics.filter(
      (m) => force || !existingNames.has(m.name.trim().toLowerCase()),
    );

    if (todo.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All barangays already have cached recommendations.",
        processed: 0,
        total: staticMetrics.length,
      });
    }

    // Process with concurrency limit
    const failed: string[] = [];
    let completed = 0;
    let cursor = 0;

    const processNext = async (): Promise<void> => {
      while (cursor < todo.length) {
        const idx = cursor++;
        const row = todo[idx];
        try {
          await generateAIBarangayRecs(row.name, {
            ndvi: row.ndvi,
            lst: row.lst,
            treeCanopy: row.tree_canopy,
            greeneryIndex: row.greenery_index,
            floodExposure: row.flood_exposure,
            currentIntervention: row.current_intervention,
          });
          completed++;
        } catch (err) {
          console.error(`[backfill] Failed for ${row.name}:`, err);
          failed.push(row.name);
        }
      }
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY, todo.length) }, () =>
      processNext(),
    );
    await Promise.all(workers);

    return NextResponse.json({
      success: true,
      message: `Processed ${completed} of ${todo.length} barangays via AI/RAG pipeline.${failed.length > 0 ? ` ${failed.length} failed: ${failed.join(", ")}.` : ""}`,
      processed: completed,
      failed: failed.length,
      total: staticMetrics.length,
    });
  } catch (error) {
    console.error("Error in backfill endpoint:", error);
    return NextResponse.json(
      { success: false, error: "Backfill job failed." },
      { status: 500 },
    );
  }
}
