/**
 * Public API - SALN Detail Endpoint
 *
 * GET /api/v1/saln/[id]
 * Returns detailed information about a specific SALN record.
 *
 * **Validates: Requirements 34.1, 34.3, 34.7**
 */

import { NextRequest, NextResponse } from "next/server";
import { withApiAuth, addApiResponseHeaders } from "@/middleware/api-auth.middleware";
import { getSALNRecord } from "@/services/saln.service";
import { ApiKey } from "@/services/api-key.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/saln/[id]
 *
 * Returns full SALN record details including:
 * - Total assets, liabilities, net worth
 * - Real properties
 * - Personal properties
 * - Investments
 * - Anomaly detection results
 * - Source attributions
 */
async function handler(
  _request: NextRequest,
  _apiKey: ApiKey,
  { params }: RouteParams
): Promise<NextResponse> {
  const { id } = await params;

  try {
    const salnRecord = await getSALNRecord(id);

    if (!salnRecord) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `SALN record with ID '${id}' not found`,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 404 }
      );
    }

    const response = NextResponse.json({
      data: salnRecord,
      meta: {
        apiVersion: "v1",
        timestamp: new Date().toISOString(),
        attribution:
          "Data sourced from official SALN filings. Attribution required for publication.",
      },
    });

    return addApiResponseHeaders(response);
  } catch (error) {
    console.error("Error fetching SALN record:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch SALN record",
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
