/**
 * Performance Monitoring Middleware
 * Tracks response times and request metrics for all API routes
 *
 * Validates: Requirements 44.1, 44.6
 * - 44.1: Load pages within 3 seconds under normal conditions
 * - 44.6: Monitor performance metrics and alert administrators
 */

import { NextRequest, NextResponse } from "next/server";
import {
  recordResponseTime,
  incrementRequestCount,
  recordMetric,
  isFeatureDegraded,
  DEGRADABLE_FEATURES,
} from "@/lib/monitoring-service";

// Feature to endpoint mapping for graceful degradation
const FEATURE_ENDPOINTS: Record<string, string[]> = {
  [DEGRADABLE_FEATURES.AI_CHATBOT]: ["/api/chatbot"],
  [DEGRADABLE_FEATURES.AUTOCOMPLETE]: ["/api/search/autocomplete"],
  [DEGRADABLE_FEATURES.COMPARISON_TOOL]: ["/api/compare"],
  [DEGRADABLE_FEATURES.PDF_EXPORT]: ["/api/compare/export", "/api/voting-list/export"],
  [DEGRADABLE_FEATURES.REAL_TIME_NOTIFICATIONS]: ["/api/notifications"],
  [DEGRADABLE_FEATURES.FAMILY_NETWORK_VISUALIZATION]: ["/api/politicians/*/family"],
  [DEGRADABLE_FEATURES.SENTIMENT_ANALYSIS]: ["/api/politicians/*/sentiment"],
  [DEGRADABLE_FEATURES.SOCIAL_SHARING]: ["/api/share"],
};

/**
 * Check if an endpoint is affected by a degraded feature
 */
function getAffectedFeature(pathname: string): string | null {
  for (const [feature, endpoints] of Object.entries(FEATURE_ENDPOINTS)) {
    for (const endpoint of endpoints) {
      // Handle wildcard patterns
      const pattern = endpoint.replace(/\*/g, "[^/]+");
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(pathname)) {
        return feature;
      }
    }
  }
  return null;
}

/**
 * Performance monitoring wrapper for API routes
 */
export async function withPerformanceMonitoring(
  request: NextRequest,
  handler: (request: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const startTime = Date.now();
  const pathname = request.nextUrl.pathname;

  // Check if this endpoint is affected by graceful degradation
  const affectedFeature = getAffectedFeature(pathname);
  if (affectedFeature) {
    const isDegraded = await isFeatureDegraded(affectedFeature);
    if (isDegraded) {
      return NextResponse.json(
        {
          success: false,
          error: "Service temporarily unavailable",
          code: "SERVICE_DEGRADED",
          message:
            "This feature is temporarily disabled due to high system load. Please try again later.",
        },
        { status: 503 }
      );
    }
  }

  try {
    // Execute the handler
    const response = await handler(request);

    // Record metrics
    const responseTime = Date.now() - startTime;
    await recordResponseTime(pathname, responseTime);
    await incrementRequestCount(pathname);

    // Record error rate if applicable
    if (response.status >= 500) {
      await recordMetric({
        type: "error_rate",
        value: 1,
        timestamp: Date.now(),
        endpoint: pathname,
        metadata: { statusCode: response.status },
      });
    }

    // Add performance headers
    const headers = new Headers(response.headers);
    headers.set("X-Response-Time", `${responseTime}ms`);
    headers.set("X-Request-Id", generateRequestId());

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    // Record error
    const responseTime = Date.now() - startTime;
    await recordResponseTime(pathname, responseTime);
    await recordMetric({
      type: "error_rate",
      value: 1,
      timestamp: Date.now(),
      endpoint: pathname,
      metadata: { error: error instanceof Error ? error.message : "Unknown error" },
    });

    throw error;
  }
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Higher-order function to wrap API route handlers with performance monitoring
 */
export function monitoredHandler(
  handler: (request: NextRequest) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    return withPerformanceMonitoring(request, handler);
  };
}

/**
 * Utility to check if a feature is available (not degraded)
 */
export async function checkFeatureAvailability(feature: string): Promise<{
  available: boolean;
  message?: string;
}> {
  const isDegraded = await isFeatureDegraded(feature);
  if (isDegraded) {
    return {
      available: false,
      message: "This feature is temporarily disabled due to high system load.",
    };
  }
  return { available: true };
}

export default {
  withPerformanceMonitoring,
  monitoredHandler,
  checkFeatureAvailability,
  getAffectedFeature,
};
