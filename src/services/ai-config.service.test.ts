/**
 * Unit Tests for AI Configuration Service
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach } from "vitest";
import {
  getAIConfig,
  getModelConfig,
  getChatbotModelConfig,
  getVerifierModelConfig,
  setChatbotProvider,
  setVerifierProvider,
  setAIProviders,
  resetAIConfig,
  getAvailableProviders,
  isValidProvider,
  getAPIEndpoint,
  getAPIKeyEnvVar,
  formatProviderRequest,
  parseProviderResponse,
  AI_MODELS,
} from "./ai-config.service";

describe("AI Configuration Service", () => {
  beforeEach(() => {
    resetAIConfig();
  });

  describe("getAIConfig", () => {
    it("should return default config", () => {
      const config = getAIConfig();
      expect(config.chatbot).toBe("gemini");
      expect(config.verifier).toBe("gemini");
    });
  });

  describe("getModelConfig", () => {
    it("should return Claude config", () => {
      const config = getModelConfig("claude");
      expect(config.provider).toBe("claude");
      expect(config.displayName).toBe("Claude Opus 4.5");
      expect(config.model).toContain("claude");
    });

    it("should return Gemini config", () => {
      const config = getModelConfig("gemini");
      expect(config.provider).toBe("gemini");
      expect(config.displayName).toBe("Gemini 3.1 Pro");
      expect(config.model).toContain("gemini");
    });
  });

  describe("getChatbotModelConfig", () => {
    it("should return current chatbot model config", () => {
      const config = getChatbotModelConfig();
      expect(config.provider).toBe("gemini");
    });

    it("should reflect provider changes", () => {
      setChatbotProvider("gemini");
      const config = getChatbotModelConfig();
      expect(config.provider).toBe("gemini");
    });
  });

  describe("getVerifierModelConfig", () => {
    it("should return current verifier model config", () => {
      const config = getVerifierModelConfig();
      expect(config.provider).toBe("gemini");
    });

    it("should reflect provider changes", () => {
      setVerifierProvider("gemini");
      const config = getVerifierModelConfig();
      expect(config.provider).toBe("gemini");
    });
  });

  describe("setChatbotProvider", () => {
    it("should set chatbot provider to Claude", () => {
      const config = setChatbotProvider("claude");
      expect(config.chatbot).toBe("claude");
    });

    it("should set chatbot provider to Gemini", () => {
      const config = setChatbotProvider("gemini");
      expect(config.chatbot).toBe("gemini");
    });

    it("should throw error for invalid provider", () => {
      expect(() => setChatbotProvider("invalid" as any)).toThrow();
    });

    it("should not affect verifier provider", () => {
      setChatbotProvider("claude");
      const config = getAIConfig();
      expect(config.chatbot).toBe("claude");
      expect(config.verifier).toBe("gemini");
    });
  });

  describe("setVerifierProvider", () => {
    it("should set verifier provider to Claude", () => {
      const config = setVerifierProvider("claude");
      expect(config.verifier).toBe("claude");
    });

    it("should set verifier provider to Gemini", () => {
      const config = setVerifierProvider("gemini");
      expect(config.verifier).toBe("gemini");
    });

    it("should throw error for invalid provider", () => {
      expect(() => setVerifierProvider("invalid" as any)).toThrow();
    });

    it("should not affect chatbot provider", () => {
      setVerifierProvider("claude");
      const config = getAIConfig();
      expect(config.chatbot).toBe("gemini");
      expect(config.verifier).toBe("claude");
    });
  });

  describe("setAIProviders", () => {
    it("should set both providers at once", () => {
      const config = setAIProviders({ chatbot: "gemini", verifier: "gemini" });
      expect(config.chatbot).toBe("gemini");
      expect(config.verifier).toBe("gemini");
    });

    it("should set only chatbot if specified", () => {
      const config = setAIProviders({ chatbot: "claude" });
      expect(config.chatbot).toBe("claude");
      expect(config.verifier).toBe("gemini");
    });

    it("should set only verifier if specified", () => {
      const config = setAIProviders({ verifier: "claude" });
      expect(config.chatbot).toBe("gemini");
      expect(config.verifier).toBe("claude");
    });

    it("should throw error for invalid chatbot provider", () => {
      expect(() => setAIProviders({ chatbot: "invalid" as any })).toThrow();
    });

    it("should throw error for invalid verifier provider", () => {
      expect(() => setAIProviders({ verifier: "invalid" as any })).toThrow();
    });
  });

  describe("resetAIConfig", () => {
    it("should reset to default config", () => {
      setChatbotProvider("claude");
      setVerifierProvider("claude");

      const config = resetAIConfig();
      expect(config.chatbot).toBe("gemini");
      expect(config.verifier).toBe("gemini");
    });
  });

  describe("getAvailableProviders", () => {
    it("should return all available providers", () => {
      const providers = getAvailableProviders();
      expect(providers.length).toBe(6);
      expect(providers.map((provider) => provider.provider)).toEqual([
        "claude",
        "gemini",
        "openai",
        "deepseek",
        "openrouter",
        "tokenrouter",
      ]);
      expect(providers.some((p) => p.provider === "claude")).toBe(true);
      expect(providers.some((p) => p.provider === "gemini")).toBe(true);
    });
  });

  describe("isValidProvider", () => {
    it("should return true for valid providers", () => {
      expect(isValidProvider("claude")).toBe(true);
      expect(isValidProvider("gemini")).toBe(true);
      expect(isValidProvider("openai")).toBe(true);
      expect(isValidProvider("deepseek")).toBe(true);
      expect(isValidProvider("openrouter")).toBe(true);
      expect(isValidProvider("tokenrouter")).toBe(true);
    });

    it("should return false for invalid providers", () => {
      expect(isValidProvider("mistral")).toBe(false);
      expect(isValidProvider("gpt4")).toBe(false);
      expect(isValidProvider("")).toBe(false);
    });
  });

  describe("getAPIEndpoint", () => {
    it("should return Anthropic endpoint for Claude", () => {
      const endpoint = getAPIEndpoint("claude");
      expect(endpoint).toContain("anthropic");
    });

    it("should return Google endpoint for Gemini", () => {
      const endpoint = getAPIEndpoint("gemini");
      expect(endpoint).toContain("google");
    });
  });

  describe("getAPIKeyEnvVar", () => {
    it("should return correct env var for Claude", () => {
      const envVar = getAPIKeyEnvVar("claude");
      expect(envVar).toBe("ANTHROPIC_API_KEY");
    });

    it("should return correct env var for Gemini", () => {
      const envVar = getAPIKeyEnvVar("gemini");
      expect(envVar).toBe("GOOGLE_AI_API_KEY");
    });
  });

  describe("formatProviderRequest", () => {
    it("should format Claude request correctly", () => {
      const request = formatProviderRequest("claude", "Hello", "You are helpful", {
        temperature: 0.5,
      }) as {
        model: string;
        system: string;
        messages: Array<{ content: string }>;
        temperature: number;
      };
      expect(request.model).toContain("claude");
      expect(request.system).toBe("You are helpful");
      expect(request.messages[0]!.content).toBe("Hello");
      expect(request.temperature).toBe(0.5);
    });

    it("should format Gemini request correctly", () => {
      const request = formatProviderRequest("gemini", "Hello", "You are helpful", {
        temperature: 0.5,
      }) as {
        contents: Array<{ parts: Array<{ text: string }> }>;
        generationConfig: { temperature: number };
      };
      expect(request.contents[0]!.parts[0]!.text).toContain("Hello");
      expect(request.generationConfig.temperature).toBe(0.5);
    });

    it("should use default temperature if not specified", () => {
      const request = formatProviderRequest("claude", "Hello", "System") as { temperature: number };
      expect(request.temperature).toBe(AI_MODELS.claude.temperature);
    });
  });

  describe("parseProviderResponse", () => {
    it("should parse Claude response", () => {
      const response = {
        content: [{ text: "Hello from Claude" }],
      };
      const text = parseProviderResponse("claude", response);
      expect(text).toBe("Hello from Claude");
    });

    it("should parse Gemini response", () => {
      const response = {
        candidates: [
          {
            content: {
              parts: [{ text: "Hello from Gemini" }],
            },
          },
        ],
      };
      const text = parseProviderResponse("gemini", response);
      expect(text).toBe("Hello from Gemini");
    });

    it("should return empty string for invalid response", () => {
      expect(parseProviderResponse("claude", {})).toBe("");
      expect(parseProviderResponse("gemini", {})).toBe("");
    });
  });
});
