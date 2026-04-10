import { describe, expect, it } from "vitest";
import { ifNoneMatchMatches, parseIfNoneMatchList } from "./etag-match";

describe("parseIfNoneMatchList", () => {
  it("splits comma-separated tags", () => {
    expect(parseIfNoneMatchList('W/"a", W/"b"')).toEqual(['W/"a"', 'W/"b"']);
  });

  it("returns empty for null or blank", () => {
    expect(parseIfNoneMatchList(null)).toEqual([]);
    expect(parseIfNoneMatchList("")).toEqual([]);
  });
});

describe("ifNoneMatchMatches", () => {
  const etag = 'W/"map-env-2025-01-01"';

  it("matches identical weak tag", () => {
    expect(ifNoneMatchMatches(etag, etag)).toBe(true);
  });

  it("matches when listed among several", () => {
    expect(
      ifNoneMatchMatches(`W/"other", ${etag}, W/"x"`, etag),
    ).toBe(true);
  });

  it("does not match when absent", () => {
    expect(ifNoneMatchMatches('W/"nope"', etag)).toBe(false);
  });

  it("does not match empty header", () => {
    expect(ifNoneMatchMatches(null, etag)).toBe(false);
  });
});
