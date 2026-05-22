/**
 * Persistent localStorage cache for AI-generated greening recommendations.
 *
 * Stores the raw API response (GreeningRecommendation[]) keyed by location,
 * so returning to a previously analysed location shows results instantly
 * without re-hitting the generate endpoint.
 *
 * The create / update timestamps in each recommendation are stripped before
 * storing so they do not consume quota; they are re-populated on load.
 * React nodes (the `icon` field on UIRecommendation) are never stored —
 * the caller re-enriches raw data on retrieval.
 */

import type { GreeningRecommendation } from "@/types/schema";

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_PREFIX = "gp_recs_";
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_CACHED_KEYS = 20;
const SOFT_QUOTA_BYTES = 1_024 * 256; // 256 kB per key; keys exceeding this are silently dropped on write

interface CacheEntry {
  /** ISO-8601 timestamp of when the entry was written. */
  cachedAt: string;
  /** Raw recommendations from the API, without any React nodes. */
  data: GreeningRecommendation[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function prefixedKey(locationKey: string): string {
  return `${STORAGE_PREFIX}${locationKey}`;
}

function isExpired(entry: CacheEntry, ttlMs: number = DEFAULT_TTL_MS): boolean {
  const age = Date.now() - new Date(entry.cachedAt).getTime();
  return age > ttlMs;
}

/**
 * Strip ephemeral fields (dates, client-generated IDs) before persisting to
 * save quota.  `recommendationID` and `name` are kept because they are used
 * for deduplication and UI display.
 */
function sanitizeForStorage(recs: GreeningRecommendation[]): GreeningRecommendation[] {
  return recs.map((r) => {
    const createdAt = r.createdAt ? new Date(r.createdAt).toISOString() : undefined;
    const updatedAt = r.updatedAt ? new Date(r.updatedAt).toISOString() : undefined;
    return { ...r, createdAt, updatedAt } as unknown as GreeningRecommendation;
  });
}

function approximateByteSize(obj: unknown): number {
  return new TextEncoder().encode(JSON.stringify(obj)).length;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Retrieve cached recommendations for a given cache key.
 * Returns `null` when there is no entry, it is expired, or JSON parsing fails.
 */
export function getCachedRecommendations(
  locationKey: string,
  ttlMs?: number,
): GreeningRecommendation[] | null {
  try {
    const raw = localStorage.getItem(prefixedKey(locationKey));
    if (!raw) return null;

    const entry: CacheEntry = JSON.parse(raw);
    if (!entry.data || !Array.isArray(entry.data)) return null;
    if (isExpired(entry, ttlMs)) {
      localStorage.removeItem(prefixedKey(locationKey));
      return null;
    }

    return entry.data;
  } catch {
    // Corrupt entry — remove it silently.
    try {
      localStorage.removeItem(prefixedKey(locationKey));
    } catch { /* noop */ }
    return null;
  }
}

/**
 * Persist recommendations to localStorage under `locationKey`.
 *
 * Strips React-unfriendly data, enforces a per-key soft quota, and evicts
 * the oldest entries when the key count exceeds `MAX_CACHED_KEYS`.
 */
export function setCachedRecommendations(
  locationKey: string,
  recs: GreeningRecommendation[],
): void {
  try {
    const entry: CacheEntry = {
      cachedAt: new Date().toISOString(),
      data: sanitizeForStorage(recs),
    };

    // Soft quota — skip excessively large entries (shouldn't happen in practice).
    if (approximateByteSize(entry) > SOFT_QUOTA_BYTES) {
      return; // silently skip rather than risk blowing localStorage quota
    }

    // Evict oldest keys when over the limit.
    const allKeys = Object.keys(localStorage).filter((k) =>
      k.startsWith(STORAGE_PREFIX),
    );
    if (allKeys.length >= MAX_CACHED_KEYS) {
      const entries = allKeys
        .map((k) => {
          try {
            const raw = localStorage.getItem(k);
            if (!raw) return null;
            return { key: k, cachedAt: JSON.parse(raw).cachedAt ?? "" };
          } catch {
            return { key: k, cachedAt: "" };
          }
        })
        .filter((e): e is NonNullable<typeof e> => e !== null)
        .sort((a, b) => a.cachedAt.localeCompare(b.cachedAt));
      const toRemove = entries.slice(0, allKeys.length - MAX_CACHED_KEYS + 1);
      for (const { key } of toRemove) {
        localStorage.removeItem(key);
      }
    }

    localStorage.setItem(prefixedKey(locationKey), JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable — silently ignore.
  }
}

