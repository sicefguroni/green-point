import { beforeEach, describe, expect, it, vi } from "vitest";

const { embeddingsCreate, queryRawUnsafe } = vi.hoisted(() => ({
  embeddingsCreate: vi.fn(),
  queryRawUnsafe: vi.fn(),
}));

vi.mock("openai", () => ({
  default: class {
    embeddings = { create: embeddingsCreate };
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRawUnsafe: queryRawUnsafe } }));

import { retrieveRelevantChunksByQuery } from "./rag";

describe("retrieveRelevantChunksByQuery", () => {
  beforeEach(() => {
    embeddingsCreate.mockReset();
    queryRawUnsafe.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns no studies, flagged, when the embedding call fails", async () => {
    embeddingsCreate.mockRejectedValueOnce(
      Object.assign(new Error("401 Incorrect API key provided"), { status: 401 }),
    );

    await expect(retrieveRelevantChunksByQuery("shade trees", 4)).resolves.toEqual({
      chunks: [],
      query: "shade trees",
      searchUnavailable: true,
    });
    expect(queryRawUnsafe).not.toHaveBeenCalled();
  });

  it("returns no studies, flagged, when the database query fails", async () => {
    embeddingsCreate.mockResolvedValueOnce({ data: [{ embedding: [0.1, 0.2] }] });
    queryRawUnsafe.mockRejectedValueOnce(new Error("connection refused"));

    await expect(retrieveRelevantChunksByQuery("shade trees", 4)).resolves.toMatchObject({
      chunks: [],
      searchUnavailable: true,
    });
  });

  it("does not flag a search that simply found nothing", async () => {
    embeddingsCreate.mockResolvedValueOnce({ data: [{ embedding: [0.1, 0.2] }] });
    queryRawUnsafe.mockResolvedValueOnce([]);

    const result = await retrieveRelevantChunksByQuery("shade trees", 4);

    expect(result).toEqual({ chunks: [], query: "shade trees" });
  });
});
