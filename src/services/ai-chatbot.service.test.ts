/**
 * Unit Tests for AI Chatbot Service
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
    chatConversation: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    chatMessage: {
      create: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { getAIConfig, setChatbotProvider } from "./ai-config.service";
import {
  containsSensitiveTopic,
  validateSourcesForSensitiveTopic,
  calculateConfidence,
  formatSourceCitation,
  isResponseVerifiable,
  analyzeQuery,
  getOrCreateConversation,
  processMessage,
  getConversationHistory,
  getUserConversations,
  deleteConversation,
  DataSource,
  CONFIDENCE_THRESHOLD,
} from "./ai-chatbot.service";

const mockFetch = vi.fn<typeof fetch>();
const originalProvider = getAIConfig().chatbot;

function geminiResponse(text: string, groundingChunks?: unknown[]): Response {
  return Response.json({
    candidates: [
      {
        content: { role: "model", parts: [{ text }] },
        ...(groundingChunks ? { groundingMetadata: { groundingChunks } } : {}),
        finishReason: "STOP",
      },
    ],
  });
}

const groundedResponse = () =>
  geminiResponse("This politician has a legislative record.", [
    {
      web: {
        uri: "https://senate.gov.ph/lis/bill_res.aspx?congress=19&q=SBN-1",
        title: "Senate bill record",
      },
    },
    {
      web: {
        uri: "https://www.officialgazette.gov.ph/2024/01/01/republic-act/",
        title: "Published law",
      },
    },
  ]);

describe("AI Chatbot Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset().mockResolvedValue(geminiResponse("Hello, how can I help?"));
    vi.stubGlobal("fetch", mockFetch);
    vi.stubEnv("GOOGLE_AI_API_KEY", "test-chatbot-key");
    setChatbotProvider("gemini");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    setChatbotProvider(originalProvider);
  });

  describe("containsSensitiveTopic", () => {
    it("should detect sensitive topics", () => {
      expect(containsSensitiveTopic("Tell me about the controversy")).toBe(true);
      expect(containsSensitiveTopic("What legal case is pending?")).toBe(true);
      expect(containsSensitiveTopic("Is there any corruption allegation?")).toBe(true);
    });

    it("should not flag non-sensitive queries", () => {
      expect(containsSensitiveTopic("What bills did they author?")).toBe(false);
      expect(containsSensitiveTopic("Show me their voting record")).toBe(false);
      expect(containsSensitiveTopic("What is their position?")).toBe(false);
    });

    it("should be case-insensitive", () => {
      expect(containsSensitiveTopic("CONTROVERSY")).toBe(true);
      expect(containsSensitiveTopic("Scandal")).toBe(true);
    });
  });

  describe("validateSourcesForSensitiveTopic", () => {
    it("should accept official sources", () => {
      const sources: DataSource[] = [
        { type: "official_government", name: "COMELEC" },
        { type: "court_document", name: "Supreme Court" },
      ];
      expect(validateSourcesForSensitiveTopic(sources)).toBe(true);
    });

    it("should reject third-party sources for sensitive topics", () => {
      const sources: DataSource[] = [
        { type: "official_government", name: "COMELEC" },
        { type: "third_party_verified", name: "News Outlet" },
      ];
      expect(validateSourcesForSensitiveTopic(sources)).toBe(false);
    });

    it("should accept empty sources", () => {
      expect(validateSourcesForSensitiveTopic([])).toBe(true);
    });
  });

  describe("calculateConfidence", () => {
    it("should return 0 for no sources", () => {
      expect(calculateConfidence([])).toBe(0);
    });

    it("should return 1.0 for official government source", () => {
      const sources: DataSource[] = [{ type: "official_government", name: "COMELEC" }];
      expect(calculateConfidence(sources)).toBe(1.0);
    });

    it("should return lower confidence for third-party sources", () => {
      const sources: DataSource[] = [{ type: "third_party_verified", name: "News" }];
      expect(calculateConfidence(sources)).toBe(0.7);
    });

    it("should average confidence for multiple sources", () => {
      const sources: DataSource[] = [
        { type: "official_government", name: "COMELEC" },
        { type: "third_party_verified", name: "News" },
      ];
      const confidence = calculateConfidence(sources);
      expect(confidence).toBeCloseTo(0.85, 2);
    });
  });

  describe("formatSourceCitation", () => {
    it("should return empty string for no sources", () => {
      expect(formatSourceCitation([])).toBe("");
    });

    it("should format single source", () => {
      const sources: DataSource[] = [{ type: "official_government", name: "COMELEC" }];
      const citation = formatSourceCitation(sources);
      expect(citation).toContain("[1] COMELEC");
    });

    it("should format multiple sources", () => {
      const sources: DataSource[] = [
        { type: "official_government", name: "COMELEC" },
        { type: "legislative_record", name: "Senate" },
      ];
      const citation = formatSourceCitation(sources);
      expect(citation).toContain("[1] COMELEC");
      expect(citation).toContain("[2] Senate");
    });

    it("should include date if provided", () => {
      const sources: DataSource[] = [
        { type: "official_government", name: "COMELEC", date: new Date("2024-01-15") },
      ];
      const citation = formatSourceCitation(sources);
      expect(citation).toContain("COMELEC");
    });
  });

  describe("isResponseVerifiable", () => {
    it("should return true when sources and confidence meet threshold", () => {
      const sources: DataSource[] = [
        { type: "official_government", name: "COMELEC" },
        { type: "legislative_record", name: "Senate" },
      ];
      expect(isResponseVerifiable(sources, 0.9)).toBe(true);
    });

    it("should return false when no sources", () => {
      expect(isResponseVerifiable([], 0.9)).toBe(false);
    });

    it("should return false when only one source (below two-source minimum)", () => {
      const sources: DataSource[] = [{ type: "official_government", name: "COMELEC" }];
      expect(isResponseVerifiable(sources, 1.0)).toBe(false);
    });

    it("should return false when confidence below threshold", () => {
      const sources: DataSource[] = [
        { type: "official_government", name: "COMELEC" },
        { type: "legislative_record", name: "Senate" },
      ];
      expect(isResponseVerifiable(sources, 0.5)).toBe(false);
    });
  });

  describe("analyzeQuery", () => {
    it("should analyze politician queries", async () => {
      mockFetch.mockResolvedValueOnce(groundedResponse());
      const result = await analyzeQuery("Tell me about this politician", []);
      expect(result.response).toContain("politician");
      expect(result.sources.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should analyze bill queries", async () => {
      mockFetch.mockResolvedValueOnce(groundedResponse());
      const result = await analyzeQuery("What bills were filed?", []);
      expect(result.response).toContain("legislative");
      expect(result.sources.length).toBeGreaterThan(0);
    });

    it("should handle controversy queries with official sources", async () => {
      mockFetch.mockResolvedValueOnce(groundedResponse());
      const result = await analyzeQuery("Tell me about the controversy", []);
      expect(result.containsControversy).toBe(true);
      expect(result.sources.every((s) => s.type !== "third_party_verified")).toBe(true);
    });

    it("should return low confidence for generic queries", async () => {
      const result = await analyzeQuery("Hello", []);
      expect(result.confidence).toBeLessThan(CONFIDENCE_THRESHOLD);
    });

    it("should not invent citations for topic keywords without grounding metadata", async () => {
      const result = await analyzeQuery("Show senator SALN, election results and bills", []);

      expect(result.response).toBe("Hello, how can I help?");
      expect(result.sources).toEqual([]);
      expect(result.confidence).toBe(0);
      expect(result.isVerifiable).toBe(false);
    });

    it("should retain actual grounding citations and calculate their confidence", async () => {
      mockFetch.mockResolvedValueOnce(groundedResponse());

      const result = await analyzeQuery("Tell me about this politician", []);

      expect(result.sources).toEqual([
        {
          type: "legislative_record",
          name: "Senate bill record",
          url: "https://senate.gov.ph/lis/bill_res.aspx?congress=19&q=SBN-1",
        },
        {
          type: "official_government",
          name: "Published law",
          url: "https://www.officialgazette.gov.ph/2024/01/01/republic-act/",
        },
      ]);
      expect(result.confidence).toBeCloseTo(0.95);
      expect(result.isVerifiable).toBe(true);
    });

    it("should deduplicate normalized citations and ignore malformed or non-HTTP URLs", async () => {
      mockFetch.mockResolvedValueOnce(
        geminiResponse("One cited document.", [
          { web: { uri: "https://SENATE.gov.ph:443/lis/record#one", title: "Senate record" } },
          { web: { uri: "https://senate.gov.ph/lis/record#two", title: "Duplicate record" } },
          { web: { uri: "not a URL", title: "Invalid" } },
          { web: { uri: "javascript:alert(1)", title: "Unsafe" } },
          { web: { uri: "file:///tmp/record", title: "Local file" } },
          { web: { title: "Missing URI" } },
          { web: null },
          null,
        ])
      );

      const result = await analyzeQuery("What does the record show?", []);

      expect(result.sources).toEqual([
        {
          type: "legislative_record",
          name: "Senate record",
          url: "https://senate.gov.ph/lis/record",
        },
      ]);
      expect(result.isVerifiable).toBe(false);
    });

    it("should count tracking variants of one document only once for verification", async () => {
      mockFetch.mockResolvedValueOnce(
        geminiResponse("One document linked twice.", [
          {
            web: {
              uri: "https://www.officialgazette.gov.ph/2024/01/01/republic-act/?utm_source=google&fbclid=first",
              title: "Published law",
            },
          },
          {
            web: {
              uri: "https://www.officialgazette.gov.ph/2024/01/01/republic-act/?utm_source=gemini&gclid=second",
              title: "Same published law",
            },
          },
        ])
      );

      const result = await analyzeQuery("Show the law", []);

      expect(result.sources).toEqual([
        {
          type: "official_government",
          name: "Published law",
          url: "https://www.officialgazette.gov.ph/2024/01/01/republic-act/?utm_source=google&fbclid=first",
        },
      ]);
      expect(result.confidence).toBe(1);
      expect(result.isVerifiable).toBe(false);
    });

    it("should count reordered query parameters for the same bill only once", async () => {
      mockFetch.mockResolvedValueOnce(
        geminiResponse("One Senate bill.", [
          {
            web: {
              uri: "https://senate.gov.ph/lis/bill_res.aspx?congress=19&q=SBN-1&utm_source=google",
              title: "Senate bill",
            },
          },
          {
            web: {
              uri: "https://senate.gov.ph/lis/bill_res.aspx?q=SBN-1&congress=19&utm_source=gemini",
              title: "Same Senate bill",
            },
          },
        ])
      );

      const result = await analyzeQuery("Show this bill", []);

      expect(result.sources).toEqual([
        {
          type: "legislative_record",
          name: "Senate bill",
          url: "https://senate.gov.ph/lis/bill_res.aspx?congress=19&q=SBN-1&utm_source=google",
        },
      ]);
      expect(result.isVerifiable).toBe(false);
    });

    it("should preserve document identifiers when deduplicating citations", async () => {
      mockFetch.mockResolvedValueOnce(
        geminiResponse("Two different bills.", [
          {
            web: {
              uri: "https://senate.gov.ph/lis/bill_res.aspx?congress=19&q=SBN-1&utm_source=google",
              title: "First bill",
            },
          },
          {
            web: {
              uri: "https://senate.gov.ph/lis/bill_res.aspx?congress=19&q=SBN-2&utm_source=gemini",
              title: "Second bill",
            },
          },
        ])
      );

      const result = await analyzeQuery("Show both bills", []);

      expect(result.sources.map((source) => source.url)).toEqual([
        "https://senate.gov.ph/lis/bill_res.aspx?congress=19&q=SBN-1&utm_source=google",
        "https://senate.gov.ph/lis/bill_res.aspx?congress=19&q=SBN-2&utm_source=gemini",
      ]);
      expect(result.isVerifiable).toBe(true);
    });

    it("should not count homepage or tracking-only URLs as citation evidence", async () => {
      mockFetch.mockResolvedValueOnce(
        geminiResponse("Homepage references.", [
          { web: { uri: "https://senate.gov.ph", title: "Senate" } },
          { web: { uri: "https://www.gov.ph/", title: "Government portal" } },
          { web: { uri: "https://www.ombudsman.gov.ph/?utm_source=chatbot", title: "Ombudsman" } },
        ])
      );

      const result = await analyzeQuery("Show senator SALN records", []);

      expect(result.sources).toEqual([]);
      expect(result.confidence).toBe(0);
      expect(result.isVerifiable).toBe(false);
    });

    it("should retain a root URL that identifies a document by query", async () => {
      mockFetch.mockResolvedValueOnce(
        geminiResponse("An identified record.", [
          { web: { uri: "https://www.ombudsman.gov.ph/?id=saln-2024", title: "SALN document" } },
        ])
      );

      const result = await analyzeQuery("Show the SALN record", []);

      expect(result.sources).toEqual([
        {
          type: "official_government",
          name: "SALN document",
          url: "https://www.ombudsman.gov.ph/?id=saln-2024",
        },
      ]);
      expect(result.confidence).toBe(1);
      expect(result.isVerifiable).toBe(false);
    });

    it("should classify court and government subdomains by their actual hostname", async () => {
      mockFetch.mockResolvedValueOnce(
        geminiResponse("Official records.", [
          {
            web: {
              uri: "https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/1/1",
              title: "Court decision",
            },
          },
          { web: { uri: "https://records.ombudsman.gov.ph/saln/2024", title: "SALN record" } },
        ])
      );

      const result = await analyzeQuery("Show official records", []);

      expect(result.sources.map((source) => source.type)).toEqual([
        "court_document",
        "official_government",
      ]);
      expect(result.confidence).toBeCloseTo(0.975);
      expect(result.isVerifiable).toBe(true);
    });

    it("should not treat spoofed or redirect URLs as official based on their titles", async () => {
      mockFetch.mockResolvedValueOnce(
        geminiResponse("External sources.", [
          {
            web: { uri: "https://senate.gov.ph.evil.test/record", title: "Senate official record" },
          },
          {
            web: {
              uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/example",
              title: "senate.gov.ph",
            },
          },
        ])
      );

      const result = await analyzeQuery("Show senator bills", []);

      expect(result.sources.map((source) => source.type)).toEqual([
        "third_party_verified",
        "third_party_verified",
      ]);
      expect(result.confidence).toBeCloseTo(0.7);
      expect(result.isVerifiable).toBe(false);
    });

    it.each([
      ["claude", "ANTHROPIC_API_KEY", { content: [{ type: "text", text: "Provider answer" }] }],
      [
        "openai",
        "OPENAI_API_KEY",
        { choices: [{ message: { role: "assistant", content: "Provider answer" } }] },
      ],
      [
        "deepseek",
        "DEEPSEEK_API_KEY",
        { choices: [{ message: { role: "assistant", content: "Provider answer" } }] },
      ],
      [
        "openrouter",
        "OPENROUTER_API_KEY",
        { choices: [{ message: { role: "assistant", content: "Provider answer" } }] },
      ],
      [
        "tokenrouter",
        "TOKENROUTER_API_KEY",
        { choices: [{ message: { role: "assistant", content: "Provider answer" } }] },
      ],
    ] as const)(
      "should preserve %s text without claiming verification",
      async (provider, key, payload) => {
        setChatbotProvider(provider);
        vi.stubEnv(key, "test-provider-key");
        mockFetch.mockResolvedValueOnce(Response.json(payload));

        const result = await analyzeQuery("Tell me about senator bills", []);

        expect(result.response).toBe("Provider answer");
        expect(result.sources).toEqual([]);
        expect(result.confidence).toBe(0);
        expect(result.isVerifiable).toBe(false);
      }
    );

    it("should preserve the unverified fallback when the provider fails", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      mockFetch.mockResolvedValueOnce(new Response("Provider unavailable", { status: 503 }));

      const result = await analyzeQuery("Tell me about a controversy", []);

      expect(result.response).toContain("trouble processing your request");
      expect(result.sources).toEqual([]);
      expect(result.confidence).toBe(0);
      expect(result.isVerifiable).toBe(false);
      expect(result.containsControversy).toBe(true);
    });
  });

  describe("getOrCreateConversation", () => {
    it("should return existing conversation", async () => {
      const mockConversation = {
        id: "conv-1",
        userId: "user-1",
        ChatMessage: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.chatConversation.findUnique).mockResolvedValue(mockConversation as any);

      const result = await getOrCreateConversation("user-1", "conv-1");
      expect(result.id).toBe("conv-1");
    });

    it("should throw error if conversation not found", async () => {
      vi.mocked(prisma.chatConversation.findUnique).mockResolvedValue(null);

      await expect(getOrCreateConversation("user-1", "conv-1")).rejects.toThrow(
        "Conversation not found"
      );
    });

    it("should throw error if conversation belongs to different user", async () => {
      const mockConversation = {
        id: "conv-1",
        userId: "user-2",
        ChatMessage: [],
      };

      vi.mocked(prisma.chatConversation.findUnique).mockResolvedValue(mockConversation as any);

      await expect(getOrCreateConversation("user-1", "conv-1")).rejects.toThrow(
        "Conversation not found"
      );
    });

    it("should create new conversation if no ID provided", async () => {
      const mockConversation = {
        id: "conv-new",
        userId: "user-1",
        ChatMessage: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.chatConversation.create).mockResolvedValue(mockConversation as any);

      const result = await getOrCreateConversation("user-1");
      expect(result.id).toBe("conv-new");
    });
  });

  describe("processMessage", () => {
    it("should process message and return response", async () => {
      mockFetch.mockResolvedValueOnce(groundedResponse());
      const mockUser = { id: "user-1" };
      const mockConversation = {
        id: "conv-1",
        userId: "user-1",
        ChatMessage: [],
      };
      const mockUserMessage = {
        id: "msg-1",
        conversationId: "conv-1",
        role: "user",
        content: "Tell me about politicians",
      };
      const mockAssistantMessage = {
        id: "msg-2",
        conversationId: "conv-1",
        role: "assistant",
        content: "Response",
        sources: [],
        confidence: 0.9,
        isVerified: true,
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.chatConversation.create).mockResolvedValue(mockConversation as any);
      vi.mocked(prisma.chatMessage.create)
        .mockResolvedValueOnce(mockUserMessage as any)
        .mockResolvedValueOnce(mockAssistantMessage as any);

      const result = await processMessage({
        userId: "user-1",
        message: "Tell me about politicians",
      });

      expect(result.conversationId).toBe("conv-1");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should throw error if user not found", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(
        processMessage({
          userId: "user-1",
          message: "Hello",
        })
      ).rejects.toThrow("User not found");
    });
  });

  describe("getConversationHistory", () => {
    it("should return conversation messages", async () => {
      const mockConversation = {
        id: "conv-1",
        userId: "user-1",
        ChatMessage: [
          { id: "msg-1", role: "user", content: "Hello" },
          { id: "msg-2", role: "assistant", content: "Hi" },
        ],
      };

      vi.mocked(prisma.chatConversation.findUnique).mockResolvedValue(mockConversation as any);

      const result = await getConversationHistory("user-1", "conv-1");
      expect(result).toHaveLength(2);
    });

    it("should throw error if conversation not found", async () => {
      vi.mocked(prisma.chatConversation.findUnique).mockResolvedValue(null);

      await expect(getConversationHistory("user-1", "conv-1")).rejects.toThrow(
        "Conversation not found"
      );
    });
  });

  describe("getUserConversations", () => {
    it("should return user conversations", async () => {
      const mockConversations = [
        { id: "conv-1", userId: "user-1", ChatMessage: [] },
        { id: "conv-2", userId: "user-1", ChatMessage: [] },
      ];

      vi.mocked(prisma.chatConversation.findMany).mockResolvedValue(mockConversations as any);

      const result = await getUserConversations("user-1");
      expect(result).toHaveLength(2);
    });
  });

  describe("deleteConversation", () => {
    it("should delete conversation", async () => {
      const mockConversation = { id: "conv-1", userId: "user-1" };

      vi.mocked(prisma.chatConversation.findUnique).mockResolvedValue(mockConversation as any);
      vi.mocked(prisma.chatConversation.delete).mockResolvedValue({} as any);

      const result = await deleteConversation("user-1", "conv-1");
      expect(result).toBe(true);
    });

    it("should throw error if conversation not found", async () => {
      vi.mocked(prisma.chatConversation.findUnique).mockResolvedValue(null);

      await expect(deleteConversation("user-1", "conv-1")).rejects.toThrow(
        "Conversation not found"
      );
    });

    it("should throw error if conversation belongs to different user", async () => {
      const mockConversation = { id: "conv-1", userId: "user-2" };

      vi.mocked(prisma.chatConversation.findUnique).mockResolvedValue(mockConversation as any);

      await expect(deleteConversation("user-1", "conv-1")).rejects.toThrow(
        "Conversation not found"
      );
    });
  });
});
