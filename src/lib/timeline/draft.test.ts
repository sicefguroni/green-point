import { describe, expect, it } from "vitest";
import { isDraftStale } from "./draft";

describe("timeline draft recency", () => {
  it("marks drafts older than baseline as stale", () => {
    expect(
      isDraftStale({
        baselineGeneratedAt: "2024-04-10T12:00:00.000Z",
        draftSavedAt: Date.parse("2024-04-09T12:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("keeps drafts newer than baseline", () => {
    expect(
      isDraftStale({
        baselineGeneratedAt: "2024-04-10T12:00:00.000Z",
        draftSavedAt: Date.parse("2024-04-11T12:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("keeps drafts without timestamps", () => {
    expect(
      isDraftStale({
        baselineGeneratedAt: "2024-04-10T12:00:00.000Z",
      }),
    ).toBe(false);
  });
});
