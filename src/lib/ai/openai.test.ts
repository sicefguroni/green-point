import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create } };
  },
}));

const request = {
  feature: "chat" as const,
  systemPrompt: "system",
  userPrompt: "user",
  temperature: 0.4,
  topP: 0.9,
};

function completion(content: string) {
  return { choices: [{ message: { content } }] };
}

describe("generateJsonWithOpenAI", () => {
  beforeEach(() => {
    vi.resetModules();
    create.mockReset();
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_CHAT_MODEL = "gpt-5-test";
  });

  it("retries without sampling params when the model rejects temperature", async () => {
    create
      .mockRejectedValueOnce(
        Object.assign(
          new Error(
            "400 Unsupported value: 'temperature' does not support 0.4 with this model. Only the default (1) value is supported.",
          ),
          { status: 400 },
        ),
      )
      .mockResolvedValueOnce(completion('{"reply":"hi"}'))
      .mockResolvedValueOnce(completion('{"reply":"again"}'));

    const { generateJsonWithOpenAI } = await import("./openai");

    await expect(generateJsonWithOpenAI(request)).resolves.toMatchObject({
      rawText: '{"reply":"hi"}',
    });
    expect(create.mock.calls[0][0]).toMatchObject({ temperature: 0.4, top_p: 0.9 });
    expect(create.mock.calls[1][0]).not.toHaveProperty("temperature");
    expect(create.mock.calls[1][0]).not.toHaveProperty("top_p");

    // Subsequent calls for the same model skip the doomed first attempt.
    await generateJsonWithOpenAI(request);
    expect(create).toHaveBeenCalledTimes(3);
    expect(create.mock.calls[2][0]).not.toHaveProperty("temperature");
  });

  it("does not retry unrelated 400 errors", async () => {
    create.mockRejectedValueOnce(
      Object.assign(new Error("400 Invalid model"), { status: 400 }),
    );

    const { generateJsonWithOpenAI } = await import("./openai");

    await expect(generateJsonWithOpenAI(request)).rejects.toThrow("Invalid model");
    expect(create).toHaveBeenCalledTimes(1);
  });
});
