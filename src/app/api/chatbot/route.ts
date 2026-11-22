/**
 * AI Chatbot API Route
 *
 * Handles AI chatbot interactions with rate limiting and source citations.
 * Requirements: 14.1, 14.2, 14.3, 14.4, 37.6
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "@/services/auth.service";
import {
  processMessage,
  getConversationHistory,
  getUserConversations,
  deleteConversation,
  ChatbotError,
} from "@/services/ai-chatbot.service";
import { checkRateLimit, recordRequest, getRateLimitStatus } from "@/services/rate-limit.service";
import { getAPIKeyEnvVar, getChatbotModelConfig } from "@/services/ai-config.service";

/**
 * Helper to get client IP
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
}

/**
 * POST /api/chatbot
 * Send a message to the AI chatbot
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    const ip = getClientIP(request);

    let userId: string | null = null;
    let isAuthenticated = false;

    if (token) {
      try {
        const session = await validateSession(token);
        userId = session.userId;
        isAuthenticated = true;
      } catch {
        // Continue as anonymous user
      }
    }

    // Check rate limit - Requirement 37.6
    const rateLimitCheck = checkRateLimit(userId, ip, isAuthenticated);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          rateLimitStatus: {
            remaining: rateLimitCheck.remaining,
            resetAt: rateLimitCheck.resetAt.toISOString(),
            isBlocked: rateLimitCheck.isBlocked,
          },
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { message, conversationId } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: "Message too long (max 2000 characters)" },
        { status: 400 }
      );
    }

    const providerKey = process.env[getAPIKeyEnvVar(getChatbotModelConfig().provider)];
    if (!providerKey || providerKey.startsWith("your-")) {
      return NextResponse.json(
        { error: "Assistant temporarily unavailable", code: "AI_UNAVAILABLE" },
        { status: 503 }
      );
    }

    // For anonymous users, we need to create a temporary user ID
    const effectiveUserId = userId || `anon_${ip}`;

    // Record the request for rate limiting
    recordRequest(userId, ip, isAuthenticated, message);

    // Process the message
    const response = await processMessage({
      userId: effectiveUserId,
      conversationId,
      message,
    });

    // Get updated rate limit status
    const updatedRateLimitStatus = getRateLimitStatus(userId, ip, isAuthenticated);

    return NextResponse.json({
      conversationId: response.conversationId,
      message: {
        id: response.message.id,
        role: response.message.role,
        content: response.message.content,
        createdAt: response.message.createdAt,
      },
      sources: response.sources,
      confidence: response.confidence,
      isVerified: response.isVerified,
      warning: response.warning,
      rateLimitStatus: {
        remaining: updatedRateLimitStatus.remaining,
        resetAt: updatedRateLimitStatus.resetAt.toISOString(),
        isBlocked: updatedRateLimitStatus.isBlocked,
      },
    });
  } catch (error) {
    if (error instanceof ChatbotError) {
      const statusMap: Record<string, number> = {
        USER_NOT_FOUND: 404,
        CONVERSATION_NOT_FOUND: 404,
        RATE_LIMITED: 429,
        UNVERIFIABLE_CLAIM: 400,
        AI_ERROR: 500,
      };
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusMap[error.code] || 500 }
      );
    }

    console.error("Chatbot error:", error);
    return NextResponse.json({ error: "Failed to process message" }, { status: 500 });
  }
}

/**
 * GET /api/chatbot
 * Get conversation history or list conversations
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    const ip = getClientIP(request);

    let userId: string | null = null;

    if (token) {
      try {
        const session = await validateSession(token);
        userId = session.userId;
      } catch {
        // Continue as anonymous
      }
    }

    const effectiveUserId = userId || `anon_${ip}`;
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");

    if (conversationId) {
      // Get specific conversation history
      const messages = await getConversationHistory(effectiveUserId, conversationId);
      return NextResponse.json({ messages });
    } else {
      // List all conversations
      const conversations = await getUserConversations(effectiveUserId);
      return NextResponse.json({ conversations });
    }
  } catch (error) {
    if (error instanceof ChatbotError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 404 });
    }

    console.error("Error fetching conversations:", error);
    return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
  }
}

/**
 * DELETE /api/chatbot
 * Delete a conversation
 */
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    const ip = getClientIP(request);

    let userId: string | null = null;

    if (token) {
      try {
        const session = await validateSession(token);
        userId = session.userId;
      } catch {
        // Continue as anonymous
      }
    }

    const effectiveUserId = userId || `anon_${ip}`;
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json({ error: "Conversation ID is required" }, { status: 400 });
    }

    await deleteConversation(effectiveUserId, conversationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ChatbotError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 404 });
    }

    console.error("Error deleting conversation:", error);
    return NextResponse.json({ error: "Failed to delete conversation" }, { status: 500 });
  }
}
