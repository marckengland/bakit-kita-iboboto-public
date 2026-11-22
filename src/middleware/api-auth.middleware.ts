/**
 * API Authentication Middleware
 *
 * Middleware for authenticating and rate limiting public API requests.
 *
 * **Validates: Requirements 34.2, 34.4, 34.6**
 */

import { NextRequest, NextResponse } from "next/server";
import {
  validateApiKey,
  checkApiRateLimit,
  recordApiRequest,
  logApiUsage,
  ApiKey,
} from "@/services/api-key.service";

// ============================================
// Types
// ============================================

export interface ApiAuthResult {
  authenticated: boolean;
  apiKey?: ApiKey;
  error?: string;
  statusCode?: number;
}

export interface ApiRequestContext {
  apiKey: ApiKey;
  startTime: number;
}

// ============================================
// Constants
// ============================================

const API_KEY_HEADER = "X-API-Key";
const API_KEY_QUERY_PARAM = "api_key";

// ============================================
// Middleware Functions
// ============================================

/**
 * Extract API key from request
 * Supports both header and query parameter
 */
export function extractApiKey(request: NextRequest): string | null {
  // Check header first
  const headerKey = request.headers.get(API_KEY_HEADER);
  if (headerKey) {
    return headerKey;
  }

  // Check query parameter
  const url = new URL(request.url);
  const queryKey = url.searchParams.get(API_KEY_QUERY_PARAM);
  if (queryKey) {
    return queryKey;
  }

  // Check Authorization header (Bearer token)
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  return null;
}

/**
 * Authenticate API request
 * Validates: Requirement 34.2 - API key authentication
 */
export function authenticateApiRequest(request: NextRequest): ApiAuthResult {
  const apiKey = extractApiKey(request);

  if (!apiKey) {
    return {
      authenticated: false,
      error:
        "API key is required. Provide it via X-API-Key header, api_key query parameter, or Authorization: Bearer header.",
      statusCode: 401,
    };
  }

  const validation = validateApiKey(apiKey);

  if (!validation.valid) {
    return {
      authenticated: false,
      error: validation.error,
      statusCode: 401,
    };
  }

  return {
    authenticated: true,
    apiKey: validation.apiKey,
  };
}

/**
 * Check rate limit for authenticated request
 * Validates: Requirement 34.4 - Rate limiting
 */
export function checkRateLimit(apiKeyId: string): {
  allowed: boolean;
  headers: Record<string, string>;
  error?: string;
} {
  const status = checkApiRateLimit(apiKeyId);

  const headers: Record<string, string> = {
    "X-RateLimit-Limit": status.limit.toString(),
    "X-RateLimit-Remaining": status.remaining.toString(),
    "X-RateLimit-Reset": Math.floor(status.resetAt.getTime() / 1000).toString(),
  };

  if (!status.allowed) {
    return {
      allowed: false,
      headers,
      error: `Rate limit exceeded. Try again after ${status.resetAt.toISOString()}`,
    };
  }

  return { allowed: true, headers };
}

/**
 * Create error response with proper headers
 */
export function createApiErrorResponse(
  error: string,
  statusCode: number,
  headers?: Record<string, string>
): NextResponse {
  const response = NextResponse.json(
    {
      error: {
        code: getErrorCode(statusCode),
        message: error,
        timestamp: new Date().toISOString(),
      },
    },
    { status: statusCode }
  );

  // Add rate limit headers if provided
  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }
  }

  // Add standard API headers
  response.headers.set("Content-Type", "application/json");
  response.headers.set("X-API-Version", "v1");

  return response;
}

/**
 * Get error code from status code
 */
function getErrorCode(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 429:
      return "RATE_LIMIT_EXCEEDED";
    case 500:
      return "INTERNAL_ERROR";
    default:
      return "ERROR";
  }
}

/**
 * Add standard API response headers
 */
export function addApiResponseHeaders(
  response: NextResponse,
  rateLimitHeaders?: Record<string, string>
): NextResponse {
  response.headers.set("Content-Type", "application/json");
  response.headers.set("X-API-Version", "v1");

  if (rateLimitHeaders) {
    for (const [key, value] of Object.entries(rateLimitHeaders)) {
      response.headers.set(key, value);
    }
  }

  return response;
}

/**
 * Full API authentication and rate limiting middleware
 * Returns null if request is valid, or an error response if not
 */
export async function apiAuthMiddleware(request: NextRequest): Promise<{
  response: NextResponse | null;
  apiKey?: ApiKey;
  rateLimitHeaders?: Record<string, string>;
}> {
  // Authenticate
  const authResult = authenticateApiRequest(request);

  if (!authResult.authenticated || !authResult.apiKey) {
    return {
      response: createApiErrorResponse(
        authResult.error ?? "Authentication failed",
        authResult.statusCode ?? 401
      ),
    };
  }

  // Check rate limit
  const rateLimitResult = checkRateLimit(authResult.apiKey.id);

  if (!rateLimitResult.allowed) {
    return {
      response: createApiErrorResponse(
        rateLimitResult.error ?? "Rate limit exceeded",
        429,
        rateLimitResult.headers
      ),
    };
  }

  // Record the request
  recordApiRequest(authResult.apiKey.id);

  return {
    response: null,
    apiKey: authResult.apiKey,
    rateLimitHeaders: rateLimitResult.headers,
  };
}

/**
 * Log API request completion
 * Validates: Requirement 34.6 - Log usage for analytics
 */
export function logApiRequestCompletion(
  apiKeyId: string,
  request: NextRequest,
  statusCode: number,
  startTime: number
): void {
  const responseTimeMs = Date.now() - startTime;
  const url = new URL(request.url);

  logApiUsage({
    apiKeyId,
    endpoint: url.pathname,
    method: request.method,
    statusCode,
    responseTimeMs,
    timestamp: new Date(),
    ip: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown",
    userAgent: request.headers.get("user-agent") ?? undefined,
  });
}

/**
 * Wrapper for API route handlers with authentication and rate limiting
 */
export function withApiAuth<T>(
  handler: (request: NextRequest, apiKey: ApiKey) => Promise<NextResponse<T>>
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now();

    // Run authentication middleware
    const { response: errorResponse, apiKey, rateLimitHeaders } = await apiAuthMiddleware(request);

    if (errorResponse) {
      return errorResponse;
    }

    if (!apiKey) {
      return createApiErrorResponse("Authentication failed", 401);
    }

    try {
      // Execute the handler
      const response = await handler(request, apiKey);

      // Add rate limit headers
      if (rateLimitHeaders) {
        for (const [key, value] of Object.entries(rateLimitHeaders)) {
          response.headers.set(key, value);
        }
      }

      // Log the request
      logApiRequestCompletion(apiKey.id, request, response.status, startTime);

      return response;
    } catch (error) {
      console.error("API handler error:", error);

      // Log the error
      logApiRequestCompletion(apiKey.id, request, 500, startTime);

      return createApiErrorResponse("Internal server error", 500, rateLimitHeaders);
    }
  };
}
