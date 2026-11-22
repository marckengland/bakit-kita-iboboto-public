/**
 * Public API - Bill Detail Endpoint
 *
 * GET /api/v1/bills/[id]
 * Returns detailed information about a specific bill.
 *
 * **Validates: Requirements 34.1, 34.3, 34.7**
 */

import { NextRequest, NextResponse } from "next/server";
import { apiSourceMetadata } from "@/lib/release-api";
import { withApiAuth, addApiResponseHeaders } from "@/middleware/api-auth.middleware";
import { getBillById } from "@/services/legislative.service";
import { ApiKey } from "@/services/api-key.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/bills/[id]
 *
 * Returns full bill details including:
 * - Bill number, title, summary
 * - Full text (if available)
 * - Filing date and status
 * - Authors (principal and co-authors)
 * - Source attributions
 */
async function handler(
  _request: NextRequest,
  _apiKey: ApiKey,
  { params }: RouteParams
): Promise<NextResponse> {
  const { id } = await params;

  try {
    const bill = await getBillById(id);

    if (!bill) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Bill with ID '${id}' not found`,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 404 }
      );
    }

    const response = NextResponse.json({
      data: bill,
      meta: {
        apiVersion: "v1",
        timestamp: new Date().toISOString(),
        ...apiSourceMetadata(!!bill.reviewedBatch),
      },
    });

    return addApiResponseHeaders(response);
  } catch (error) {
    console.error("Error fetching bill:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch bill",
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest, context: RouteParams): Promise<NextResponse> {
  const wrappedHandler = withApiAuth((req, apiKey) => handler(req, apiKey, context));
  return wrappedHandler(request);
}
