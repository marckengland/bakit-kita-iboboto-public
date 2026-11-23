/**
 * AI Chatbot Rate Limit API Route
 *
 * Returns the current rate limit status for the user.
 * Requirement: 37.6
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "@/services/auth.service";
import { getRateLimitStatus, RATE_LIMITS } from "@/services/rate-limit.service";
import { getPublicRequestBudget, PublicBudgetUnavailableError } from "@/lib/public-request-budget";

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
 * GET /api/chatbot/rate-limit
 * Get current rate limit status - Requirement 37.6
 */
export async function GET(request: NextRequest) {
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
      // Continue as anonymous
    }
  }

  let shared;
  try {
    shared = await getPublicRequestBudget(request, "records", userId);
  } catch (error) {
    if (error instanceof PublicBudgetUnavailableError) {
      return NextResponse.json(
        { error: "Request budget temporarily unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
    throw error;
  }
  const status = shared ?? getRateLimitStatus(userId, ip, isAuthenticated);
  const config = isAuthenticated ? RATE_LIMITS.authenticated : RATE_LIMITS.anonymous;

  return NextResponse.json(
    {
      rateLimitStatus: {
        remaining: status.remaining,
        resetAt: status.resetAt.toISOString(),
        isBlocked: status.isBlocked,
        maxRequests: shared?.maxRequests ?? config?.maxRequests ?? 20,
        windowMs: shared?.windowMs ?? config?.windowMs ?? 3600000,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
