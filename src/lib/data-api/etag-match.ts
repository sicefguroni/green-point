/**
 * RFC 9110 If-None-Match handling for weak ETags (W/"...").
 * Splits on commas that separate entity-tags (opaque tags here never contain commas).
 */
export function parseIfNoneMatchList(header: string | null): string[] {
  if (!header?.trim()) return [];
  return header
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * True if any tag in If-None-Match matches `etag` using weak comparison.
 * Both must be weak tags (W/"...") for a positive match in our usage.
 */
export function ifNoneMatchMatches(
  ifNoneMatchHeader: string | null,
  etag: string,
): boolean {
  if (!ifNoneMatchHeader?.trim()) return false;
  const candidates = parseIfNoneMatchList(ifNoneMatchHeader);
  const want = normalizeWeakEtag(etag);
  if (!want) return false;
  for (const c of candidates) {
    if (normalizeWeakEtag(c) === want) return true;
  }
  return false;
}

function normalizeWeakEtag(tag: string): string {
  const t = tag.trim();
  const weak = /^W\//i.test(t);
  const rest = weak ? t.slice(2).trim() : t;
  const quoted = rest.match(/^"(.*)"$/);
  const opaque = quoted ? quoted[1] : rest;
  return weak ? `W/"${opaque}"` : `"${opaque}"`;
}
