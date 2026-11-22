import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
afterEach(() => {
  vi.unstubAllEnvs();
});

it("returns an unavailable response when no provider is configured", async () => {
  for (const key of [
    "GOOGLE_AI_API_KEY",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "OPENROUTER_API_KEY",
    "DEEPSEEK_API_KEY",
    "TOKENROUTER_API_KEY",
  ]) {
    vi.stubEnv(key, "");
  }
  const response = await POST(
    new NextRequest("https://example.test/api/chatbot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Synthetic civic question" }),
    })
  );
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    error: "Assistant temporarily unavailable",
    code: "AI_UNAVAILABLE",
  });
});
