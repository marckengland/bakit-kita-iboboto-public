/**
 * AI Chatbot Service
 *
 * Handles AI-powered chatbot interactions with source citation and verification.
 * Provider-agnostic: Gemini (default, free tier), Claude (Anthropic), OpenAI,
 * DeepSeek, or OpenRouter (open-weight models). Admin switches provider/model
 * via the AI Config service.
 *
 * **Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5, 14.6**
 */

import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  getChatbotModelConfig,
  getProviderKind,
  getAPIEndpoint,
  getAPIKeyEnvVar,
  formatProviderRequest,
  parseProviderResponse,
} from "./ai-config.service";

// ============================================
// Types and Interfaces
// ============================================

export interface DataSource {
  type: "official_government" | "court_document" | "legislative_record" | "third_party_verified";
  name: string;
  url?: string;
  date?: Date;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  sources: DataSource[] | null;
  confidence: number | null;
  isVerified: boolean;
  createdAt: Date;
}

export interface ChatConversation {
  id: string;
  userId: string;
  ChatMessage: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatRequest {
  userId: string;
  conversationId?: string;
  message: string;
}

export interface ChatResponse {
  conversationId: string;
  message: ChatMessage;
  sources: DataSource[];
  confidence: number;
  isVerified: boolean;
  warning?: string;
}

export interface AIAnalysisResult {
  response: string;
  sources: DataSource[];
  confidence: number;
  isVerifiable: boolean;
  containsControversy: boolean;
}

// ============================================
// Error Classes
// ============================================

export class ChatbotError extends Error {
  constructor(
    message: string,
    public code:
      | "USER_NOT_FOUND"
      | "CONVERSATION_NOT_FOUND"
      | "RATE_LIMITED"
      | "UNVERIFIABLE_CLAIM"
      | "AI_ERROR"
  ) {
    super(message);
    this.name = "ChatbotError";
  }
}

// ============================================
// Constants
// ============================================

export const CONFIDENCE_THRESHOLD = 0.9;
export const MIN_SOURCES_FOR_VERIFICATION = 2;
export const MAX_CONVERSATION_MESSAGES = 50;

// Topics that require official sources only
export const SENSITIVE_TOPICS = [
  "controversy",
  "legal case",
  "corruption",
  "scandal",
  "criminal",
  "lawsuit",
  "conviction",
  "allegation",
];

// ============================================
// Helper Functions
// ============================================

/**
 * Check if a query contains sensitive topics
 */
export function containsSensitiveTopic(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  return SENSITIVE_TOPICS.some((topic) => lowerQuery.includes(topic));
}

/**
 * Validate that sources are from official channels for sensitive topics
 */
export function validateSourcesForSensitiveTopic(sources: DataSource[]): boolean {
  const officialTypes = ["official_government", "court_document", "legislative_record"];
  return sources.every((source) => officialTypes.includes(source.type));
}

/**
 * Calculate confidence score based on sources
 */
export function calculateConfidence(sources: DataSource[]): number {
  if (sources.length === 0) {
    return 0;
  }

  const weights: Record<DataSource["type"], number> = {
    official_government: 1.0,
    court_document: 0.95,
    legislative_record: 0.9,
    third_party_verified: 0.7,
  };

  const totalWeight = sources.reduce((sum, source) => sum + weights[source.type], 0);
  return Math.min(totalWeight / sources.length, 1.0);
}

/**
 * Format sources for citation
 */
export function formatSourceCitation(sources: DataSource[]): string {
  if (sources.length === 0) {
    return "";
  }

  const citations = sources.map((source, index) => {
    const date = source.date ? ` (${source.date.toLocaleDateString()})` : "";
    return `[${index + 1}] ${source.name}${date}`;
  });

  return "\n\nSources:\n" + citations.join("\n");
}

/**
 * Check if response is verifiable
 */
export function isResponseVerifiable(sources: DataSource[], confidence: number): boolean {
  return sources.length >= MIN_SOURCES_FOR_VERIFICATION && confidence >= CONFIDENCE_THRESHOLD;
}

// ============================================
// Mock AI Functions (integrates with Claude or Gemini based on config)
// ============================================

/** Extract citation provenance from Gemini's returned grounding metadata. */
function extractGeminiSources(data: Record<string, unknown>): DataSource[] {
  const candidates = data.candidates as
    | Array<{
        groundingMetadata?: {
          groundingChunks?: Array<{ web?: { uri?: unknown; title?: unknown } } | null>;
        };
      }>
    | undefined;
  const chunks = candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks)) {
    return [];
  }

  const sources: DataSource[] = [];
  const seen = new Set<string>();
  for (const chunk of chunks) {
    const web = chunk?.web;
    if (typeof web?.uri !== "string") {
      continue;
    }

    let url: URL;
    try {
      url = new URL(web.uri);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      continue;
    }
    // A homepage is not evidence. Root URLs must identify a document.
    const hasDocumentQuery = ["id", "p", "article", "document", "record", "bill", "case"].some(
      (key) => url.searchParams.get(key)?.trim()
    );
    if (url.pathname === "/" && !hasDocumentQuery) {
      continue;
    }
    url.hash = "";
    const documentUrl = new URL(url.href);
    // Tracking variants are one document; retain all record-identifying parameters.
    for (const key of [...documentUrl.searchParams.keys()]) {
      if (
        /^utm_/i.test(key) ||
        ["gclid", "dclid", "fbclid", "msclkid"].includes(key.toLowerCase())
      ) {
        documentUrl.searchParams.delete(key);
      }
    }
    documentUrl.searchParams.sort();
    if (seen.has(documentUrl.href)) {
      continue;
    }
    seen.add(documentUrl.href);

    const matchesDomain = (domain: string) =>
      url.hostname === domain || url.hostname.endsWith(`.${domain}`);
    const type: DataSource["type"] = matchesDomain("judiciary.gov.ph")
      ? "court_document"
      : matchesDomain("senate.gov.ph") || matchesDomain("congress.gov.ph")
        ? "legislative_record"
        : url.hostname.endsWith(".gov.ph")
          ? "official_government"
          : "third_party_verified";
    sources.push({
      type,
      name: typeof web.title === "string" && web.title.trim() ? web.title : url.hostname,
      url: url.href,
    });
  }
  return sources;
}

/**
 * Call the configured chatbot LLM — provider-agnostic.
 *
 * Honors the provider selected in the AI config (Claude / Gemini / OpenAI /
 * DeepSeek / OpenRouter). Anthropic uses its native `/v1/messages` contract,
 * Gemini its native `generateContent`, and the OpenAI-compatible providers
 * (OpenAI, DeepSeek, OpenRouter) the `/chat/completions` contract. Request
 * shaping and response parsing are delegated to the AI config service so all
 * three families stay in one place.
 */
async function callAI(
  prompt: string,
  systemPrompt: string
): Promise<{ text: string; sources: DataSource[] }> {
  const modelConfig = getChatbotModelConfig();
  const provider = modelConfig.provider;
  const kind = getProviderKind(provider);

  const keyEnv = getAPIKeyEnvVar(provider);
  const apiKey = process.env[keyEnv];
  if (!apiKey || apiKey.startsWith("your-")) {
    throw new Error(`${keyEnv} not configured`);
  }

  const body = formatProviderRequest(provider, prompt, systemPrompt, {
    temperature: 0.7,
    maxTokens: 2048,
  }) as Record<string, unknown>;

  let url = getAPIEndpoint(provider);
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (kind === "gemini") {
    // Gemini native: append model + :generateContent, key as query param,
    // and keep the safety settings from the original implementation.
    url = `${url}/${modelConfig.model}:generateContent?key=${apiKey}`;
    body.safetySettings = [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    ];
  } else if (kind === "anthropic") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
  } else {
    // OpenAI-compatible (OpenAI, DeepSeek, OpenRouter)
    headers["Authorization"] = `Bearer ${apiKey}`;
    if (provider === "openrouter") {
      headers["X-Title"] = "Bakit Kita Iboboto";
    }
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`${provider} API error:`, errorText);
    throw new Error(`${provider} API error: ${response.status}`);
  }

  const data = await response.json();
  const text = parseProviderResponse(provider, data as Record<string, unknown>);

  if (!text) {
    throw new Error(`No response from ${provider}`);
  }

  return {
    text,
    sources: kind === "gemini" ? extractGeminiSources(data as Record<string, unknown>) : [],
  };
}

/**
 * AI analysis using the configured provider and its returned citation metadata.
 */
export async function analyzeQuery(
  query: string,
  _context: ChatMessage[]
): Promise<AIAnalysisResult> {
  const containsControversy = containsSensitiveTopic(query);

  // System prompt for the AI
  const systemPrompt = `You are a helpful AI assistant for "Bakit Kita Iboboto?" - a Philippine politician transparency platform.

Your role:
- Provide factual, accurate information about Philippine politicians, government, and politics
- Always be neutral and non-partisan
- Cite official sources when possible (COMELEC, Senate, House of Representatives, Supreme Court, etc.)
- For controversies or legal matters, only reference official court documents or government records
- Support both Filipino and English languages
- Be concise but informative

Important guidelines:
- Do NOT make up information about politicians
- If you don't know something, say so honestly
- For SALN (Statement of Assets, Liabilities, and Net Worth), refer users to official records
- For bills and laws, reference the official legislative records
- Be respectful and professional at all times

Respond in the same language the user uses (Filipino or English).`;

  try {
    const { text: aiResponse, sources } = await callAI(query, systemPrompt);

    const confidence = calculateConfidence(sources);

    return {
      response: aiResponse,
      sources,
      confidence,
      isVerifiable:
        sources.length >= MIN_SOURCES_FOR_VERIFICATION && confidence >= CONFIDENCE_THRESHOLD,
      containsControversy,
    };
  } catch (error) {
    console.error("AI query error:", error);

    // Fallback response if AI fails
    return {
      response:
        "I apologize, but I'm having trouble processing your request right now. Please try again in a moment, or rephrase your question.",
      sources: [],
      confidence: 0,
      isVerifiable: false,
      containsControversy,
    };
  }
}

// ============================================
// Core Chatbot Functions
// ============================================

/**
 * Create or get a conversation
 */
export async function getOrCreateConversation(
  userId: string,
  conversationId?: string
): Promise<ChatConversation> {
  if (conversationId) {
    const conversation = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: {
        ChatMessage: {
          orderBy: { createdAt: "asc" },
          take: MAX_CONVERSATION_MESSAGES,
        },
      },
    });

    if (!conversation) {
      throw new ChatbotError("Conversation not found", "CONVERSATION_NOT_FOUND");
    }

    if (conversation.userId !== userId) {
      throw new ChatbotError("Conversation not found", "CONVERSATION_NOT_FOUND");
    }

    return conversation as unknown as ChatConversation;
  }

  // Create new conversation with generated ID
  const conversation = await prisma.chatConversation.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      updatedAt: new Date(),
    },
    include: {
      ChatMessage: true,
    },
  });

  return conversation as unknown as ChatConversation;
}

/**
 * Process a chat message and generate response
 */
export async function processMessage(request: ChatRequest): Promise<ChatResponse> {
  const { userId, conversationId, message } = request;

  // For anonymous users (starting with "anon_"), skip database storage
  const isAnonymous = userId.startsWith("anon_");

  if (isAnonymous) {
    // For anonymous users, just process the message without storing in database
    const analysis = await analyzeQuery(message, []);

    let warning: string | undefined;
    if (!analysis.isVerifiable) {
      warning = "This response could not be fully verified against official sources.";
    }

    if (analysis.containsControversy && !validateSourcesForSensitiveTopic(analysis.sources)) {
      throw new ChatbotError(
        "Cannot provide unverified information about controversies",
        "UNVERIFIABLE_CLAIM"
      );
    }

    const responseWithCitations = analysis.response + formatSourceCitation(analysis.sources);

    return {
      conversationId: conversationId || `anon_conv_${Date.now()}`,
      message: {
        id: crypto.randomUUID(),
        conversationId: conversationId || `anon_conv_${Date.now()}`,
        role: "assistant",
        content: responseWithCitations,
        sources: analysis.sources,
        confidence: analysis.confidence,
        isVerified: analysis.isVerifiable,
        createdAt: new Date(),
      },
      sources: analysis.sources,
      confidence: analysis.confidence,
      isVerified: analysis.isVerifiable,
      warning,
    };
  }

  // For authenticated users, check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ChatbotError("User not found", "USER_NOT_FOUND");
  }

  // Get or create conversation
  const conversation = await getOrCreateConversation(userId, conversationId);

  // Save user message
  await prisma.chatMessage.create({
    data: {
      id: crypto.randomUUID(),
      conversationId: conversation.id,
      role: "user",
      content: message,
      isVerified: false,
    },
  });

  // Analyze query with AI
  const analysis = await analyzeQuery(message, conversation.ChatMessage);

  // Handle unverifiable claims
  let warning: string | undefined;
  if (!analysis.isVerifiable) {
    warning = "This response could not be fully verified against official sources.";
  }

  // For controversy topics, ensure only official sources
  if (analysis.containsControversy && !validateSourcesForSensitiveTopic(analysis.sources)) {
    throw new ChatbotError(
      "Cannot provide unverified information about controversies",
      "UNVERIFIABLE_CLAIM"
    );
  }

  // Add source citations to response
  const responseWithCitations = analysis.response + formatSourceCitation(analysis.sources);

  // Save assistant message
  const assistantMessage = await prisma.chatMessage.create({
    data: {
      id: crypto.randomUUID(),
      conversationId: conversation.id,
      role: "assistant",
      content: responseWithCitations,
      sources: analysis.sources as unknown as Prisma.InputJsonValue,
      confidence: analysis.confidence,
      isVerified: analysis.isVerifiable,
    },
  });

  return {
    conversationId: conversation.id,
    message: assistantMessage as unknown as ChatMessage,
    sources: analysis.sources,
    confidence: analysis.confidence,
    isVerified: analysis.isVerifiable,
    warning,
  };
}

/**
 * Get conversation history
 */
export async function getConversationHistory(
  userId: string,
  conversationId: string
): Promise<ChatMessage[]> {
  const conversation = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    include: {
      ChatMessage: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!conversation || conversation.userId !== userId) {
    throw new ChatbotError("Conversation not found", "CONVERSATION_NOT_FOUND");
  }

  return conversation.ChatMessage as unknown as ChatMessage[];
}

/**
 * Get all conversations for a user
 */
export async function getUserConversations(userId: string): Promise<ChatConversation[]> {
  const conversations = await prisma.chatConversation.findMany({
    where: { userId },
    include: {
      ChatMessage: {
        orderBy: { createdAt: "desc" },
        take: 1, // Just get the last message for preview
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return conversations as unknown as ChatConversation[];
}

/**
 * Delete a conversation
 */
export async function deleteConversation(userId: string, conversationId: string): Promise<boolean> {
  const conversation = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation || conversation.userId !== userId) {
    throw new ChatbotError("Conversation not found", "CONVERSATION_NOT_FOUND");
  }

  await prisma.chatConversation.delete({
    where: { id: conversationId },
  });

  return true;
}
