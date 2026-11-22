import { PublicResearchUnavailableError } from "@/services/public-research.service";
/**
 * Public API - Politicians Endpoint
 *
 * GET /api/v1/politicians
 * Returns a paginated list of politicians with filtering options.
 *
 * **Validates: Requirements 34.1, 34.3, 34.7**
 */

import { NextRequest, NextResponse } from "next/server";
import { apiSourceMetadata } from "@/lib/release-api";
import { GovernmentLevel } from "@prisma/client";
import { withApiAuth, addApiResponseHeaders } from "@/middleware/api-auth.middleware";
import { listPoliticians, PoliticianFilters } from "@/services/politician.service";
import { ApiKey } from "@/services/api-key.service";

/**
 * GET /api/v1/politicians
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - pageSize: Items per page (default: 20, max: 100)
 * - level: Government level filter (national, regional, provincial, city, municipal, barangay)
 * - region: Region filter
 * - province: Province filter
 * - city: City filter
 * - party: Political party filter
 * - position: Position type filter
 * - hasRedFlags: Filter by red flag status (true/false)
 */
async function handler(request: NextRequest, _apiKey: ApiKey): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);

  // Parse pagination
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));

  // Parse filters
  const filters: PoliticianFilters = {};

  const level = searchParams.get("level");
  if (level && isValidGovernmentLevel(level)) {
    filters.level = level as GovernmentLevel;
  }

  const region = searchParams.get("region");
  if (region) {
    filters.region = region;
  }

  const province = searchParams.get("province");
  if (province) {
    filters.province = province;
  }

  const city = searchParams.get("city");
  if (city) {
    filters.city = city;
  }

  const party = searchParams.get("party");
  if (party) {
    filters.party = party;
  }

  const position = searchParams.get("position");
  if (position) {
    filters.position = position;
  }

  const hasRedFlags = searchParams.get("hasRedFlags");
  if (hasRedFlags !== null) {
    filters.hasRedFlags = hasRedFlags === "true";
  }

  try {
    const result = await listPoliticians(filters, { page, pageSize });

    const response = NextResponse.json({
      data: result.items,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        totalItems: result.totalCount,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPreviousPage: result.hasPreviousPage,
      },
      meta: {
        apiVersion: "v1",
        timestamp: new Date().toISOString(),
        ...apiSourceMetadata(
          result.items.some((item) => !!item.reviewedBatch),
          result.items.some((item) => !item.reviewedBatch)
        ),
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
    console.error("Error fetching politicians:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch politicians",
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}

function isValidGovernmentLevel(level: string): boolean {
  return ["national", "regional", "provincial", "city", "municipal", "barangay"].includes(level);
}

export const GET = withApiAuth(handler);
