import { prisma } from "@/lib/prisma";

const TTL_MS = 10 * 60 * 1000;
let cache: { titles: string[]; at: number } | null = null;

/**
 * Titles of every study in the corpus (`ResearchStudy`). Cached rows are grounded
 * against these, since the chunks retrieved when they were generated are gone.
 * Returns `undefined` when the corpus can't be read, so callers leave citations
 * alone instead of stripping all of them.
 */
export async function loadStudyTitles(): Promise<string[] | undefined> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.titles;
  try {
    const rows = await prisma.researchStudy.findMany({ select: { title: true } });
    cache = { titles: rows.map((r) => r.title), at: Date.now() };
    return cache.titles;
  } catch (error) {
    console.error("[recommendations] Could not load study titles:", error);
    return undefined;
  }
}
