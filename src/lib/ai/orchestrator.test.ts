import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create } };
  },
}));

const fetchMock = vi.fn();

function geminiReply(text: string) {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function openaiReply(content: string) {
  return { choices: [{ message: { content } }] };
}

const baseRequest = {
  feature: "recommendations" as const,
  systemPrompt: "system",
  userPrompt: "user",
  parse: (raw: string) => JSON.parse(raw) as { ok: boolean },
};

describe("generateJsonWithFallback", () => {
  beforeEach(() => {
    vi.resetModules();
    create.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.AI_PRIMARY_PROVIDER = "openai";
    process.env.AI_FALLBACK_PROVIDER = "gemini";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.OPENAI_CHAT_MODEL = "gpt-test";
    process.env.GEMINI_API_KEY = "test-gemini-key";
    process.env.GEMINI_CHAT_MODEL = "gemini-test";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("falls back to Gemini when OpenAI rejects the key (401)", async () => {
    create.mockRejectedValueOnce(
      Object.assign(new Error("401 Incorrect API key provided: sk-proj-****abcd"), {
        status: 401,
      }),
    );
    fetchMock.mockResolvedValueOnce(geminiReply('{"ok":true}'));

    const { generateJsonWithFallback } = await import("./orchestrator");
    const result = await generateJsonWithFallback(baseRequest);

    expect(result).toMatchObject({ provider: "gemini", model: "gemini-test", value: { ok: true } });
    expect(fetchMock.mock.calls[0][0]).toContain("/models/gemini-test:generateContent");
  });

  it("falls back when the primary answers with something the caller cannot parse", async () => {
    create.mockResolvedValueOnce(openaiReply("not json"));
    fetchMock.mockResolvedValueOnce(geminiReply('{"ok":true}'));

    const { generateJsonWithFallback } = await import("./orchestrator");

    await expect(generateJsonWithFallback(baseRequest)).resolves.toMatchObject({
      provider: "gemini",
      value: { ok: true },
    });
  });

  it("falls back when the primary is not configured", async () => {
    delete process.env.OPENAI_CHAT_MODEL;
    fetchMock.mockResolvedValueOnce(geminiReply('{"ok":true}'));

    const { generateJsonWithFallback } = await import("./orchestrator");

    await expect(generateJsonWithFallback(baseRequest)).resolves.toMatchObject({
      provider: "gemini",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("rethrows the fallback's error when both providers fail", async () => {
    create.mockRejectedValueOnce(Object.assign(new Error("503 overloaded"), { status: 503 }));
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "model retired" } }), { status: 404 }),
    );

    const { generateJsonWithFallback } = await import("./orchestrator");

    await expect(generateJsonWithFallback(baseRequest)).rejects.toMatchObject({
      name: "AIProviderRequestError",
      provider: "gemini",
      status: 404,
    });
  });

  it("reports the primary's failure when the fallback is not configured", async () => {
    delete process.env.GEMINI_CHAT_MODEL;
    create.mockRejectedValueOnce(Object.assign(new Error("401 bad key"), { status: 401 }));

    const { generateJsonWithFallback } = await import("./orchestrator");

    await expect(generateJsonWithFallback(baseRequest)).rejects.toMatchObject({
      name: "AIProviderRequestError",
      provider: "openai",
      status: 401,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports not-configured only when no provider is configured", async () => {
    delete process.env.OPENAI_CHAT_MODEL;
    delete process.env.GEMINI_CHAT_MODEL;

    const { generateJsonWithFallback } = await import("./orchestrator");

    await expect(generateJsonWithFallback(baseRequest)).rejects.toMatchObject({
      name: "AIProviderConfigError",
    });
  });

  it("sends images to both providers in their own format", async () => {
    create.mockRejectedValueOnce(Object.assign(new Error("500"), { status: 500 }));
    fetchMock.mockResolvedValueOnce(geminiReply('{"ok":true}'));

    const { generateJsonWithFallback } = await import("./orchestrator");
    await generateJsonWithFallback({
      ...baseRequest,
      feature: "visionAnalysis",
      images: [{ mimeType: "image/jpeg", base64: "QUJD" }],
    });

    const openaiUser = create.mock.calls[0][0].messages[1];
    expect(openaiUser.content).toEqual([
      { type: "text", text: "user" },
      { type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJD", detail: "low" } },
    ]);

    const geminiBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(geminiBody.contents[0].parts).toEqual([
      { text: "user" },
      { inlineData: { mimeType: "image/jpeg", data: "QUJD" } },
    ]);
  });

  it("leaves sampling and output limits to the provider unless the caller sets them", async () => {
    create.mockRejectedValueOnce(Object.assign(new Error("500"), { status: 500 }));
    fetchMock.mockResolvedValueOnce(geminiReply('{"ok":true}'));

    const { generateJsonWithFallback } = await import("./orchestrator");
    await generateJsonWithFallback(baseRequest);

    const openaiParams = create.mock.calls[0][0];
    expect(openaiParams).not.toHaveProperty("temperature");
    expect(openaiParams).not.toHaveProperty("top_p");
    expect(openaiParams).not.toHaveProperty("max_completion_tokens");

    const { generationConfig } = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(generationConfig).toEqual({ responseMimeType: "application/json" });
  });

  it("passes sampling and output limits through when the caller sets them (chat)", async () => {
    create.mockResolvedValueOnce(openaiReply('{"ok":true}'));

    const { generateJsonWithFallback } = await import("./orchestrator");
    await generateJsonWithFallback({
      ...baseRequest,
      feature: "chat",
      temperature: 0.4,
      topP: 0.9,
      maxOutputTokens: 1024,
    });

    expect(create.mock.calls[0][0]).toMatchObject({
      temperature: 0.4,
      top_p: 0.9,
      max_completion_tokens: 1024,
    });
  });
});
