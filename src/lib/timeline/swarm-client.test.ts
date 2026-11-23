import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { generateAgentTimeline } from "./swarm-client";
import { SwarmUnavailableError } from "./swarm-errors";

const fetchMock = vi.fn();
const input = { threadId: "t1", ragMetadata: {} };

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("generateAgentTimeline error classification", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("treats a connection failure as a cold start that never ran", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    const error = await generateAgentTimeline(input).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SwarmUnavailableError);
    expect(error).toMatchObject({ requestMayHaveRun: false });
  });

  it("treats a timeout as unavailable but possibly still running", async () => {
    fetchMock.mockRejectedValueOnce(
      new DOMException("The operation was aborted due to timeout", "TimeoutError"),
    );

    const error = await generateAgentTimeline(input).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SwarmUnavailableError);
    expect(error).toMatchObject({ requestMayHaveRun: true });
  });

  it("treats a proxy 502 without a FastAPI detail body as a cold start", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Bad Gateway", { status: 502 }));

    await expect(generateAgentTimeline(input)).rejects.toBeInstanceOf(
      SwarmUnavailableError,
    );
  });

  it("keeps app errors with a detail (e.g. LLM_UNAVAILABLE) as regular failures", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(503, { detail: "LLM_UNAVAILABLE: OPENAI_API_KEY is missing" }),
    );

    const error = await generateAgentTimeline(input).catch((e: unknown) => e);

    expect(error).not.toBeInstanceOf(SwarmUnavailableError);
    expect(error).toMatchObject({ message: "LLM_UNAVAILABLE: OPENAI_API_KEY is missing" });
  });
});
