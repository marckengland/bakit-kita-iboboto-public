import { PublicResearchUnavailableError } from "@/services/public-research.service";
/**
 * Public API - Politician Detail Endpoint
 *
 * GET /api/v1/politicians/[id]
 * Returns detailed information about a specific politician.
 *
 * **Validates: Requirements 34.1, 34.3, 34.7**
 */

import { NextRequest, NextResponse } from "next/server";
import { apiSourceMetadata } from "@/lib/release-api";
import { withApiAuth, addApiResponseHeaders } from "@/middleware/api-auth.middleware";
import { getPolitician } from "@/services/politician.service";
import { ApiKey } from "@/services/api-key.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/politicians/[id]
 *
 * Returns full politician profile including:
 * - Personal information
 * - Position history
 * - Party affiliations
 * - Red flag indicators
 * - Source attributions
 */
async function handler(
  _request: NextRequest,
  _apiKey: ApiKey,
  { params }: RouteParams
): Promise<NextResponse> {
  const { id } = await params;

  try {
    const politician = await getPolitician(id);

    if (!politician) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Politician with ID '${id}' not found`,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 404 }
      );
    }

    const response = NextResponse.json({
      data: politician,
      meta: {
        apiVersion: "v1",
        timestamp: new Date().toISOString(),
        ...apiSourceMetadata(!!politician.reviewedBatch),
      },
    });

    return addApiResponseHeaders(response);
  } catch (error) {
    if (error instanceof PublicResearchUnavailableError) {
      return NextResponse.json(
        { error: "Reviewed research is temporarily unavailable" },
        { status: 503 }
      );
    }
    console.error("Error fetching politician:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch politician",
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}

// Wrap with auth middleware - need to handle params differently
export async function GET(request: NextRequest, context: RouteParams): Promise<NextResponse> {
  const wrappedHandler = withApiAuth((req, apiKey) => handler(req, apiKey, context));
  return wrappedHandler(request);
}
