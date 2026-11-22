/**
 * Public API - Bills Endpoint
 *
 * GET /api/v1/bills
 * Returns a paginated list of bills with filtering options.
 *
 * **Validates: Requirements 34.1, 34.3, 34.7**
 */

import { NextRequest, NextResponse } from "next/server";
import { apiSourceMetadata } from "@/lib/release-api";
import { BillStatus, BillAuthorRole, Chamber } from "@prisma/client";
import { withApiAuth, addApiResponseHeaders } from "@/middleware/api-auth.middleware";
import {
  getBills,
  BillFilters,
  BillSortOptions,
  BillSortField,
  SortOrder,
} from "@/services/legislative.service";
import { ApiKey } from "@/services/api-key.service";

/**
 * GET /api/v1/bills
 *
 * Query Parameters:
 * - politicianId: Filter by politician (required)
 * - page: Page number (default: 1)
 * - pageSize: Items per page (default: 20, max: 100)
 * - status: Bill status filter (pending, passed, vetoed, lapsed, withdrawn)
 * - authorRole: Author role filter (principal_author, co_author, introduced_by)
 * - chamber: Chamber filter (senate, house)
 * - congress: Congress number filter
 * - session: Session number filter
 * - sortBy: Sort field (filingDate, status, title)
 * - sortOrder: Sort order (asc, desc)
 */
async function handler(request: NextRequest, _apiKey: ApiKey): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);

  // Politician ID is required
  const politicianId = searchParams.get("politicianId");
  if (!politicianId) {
    return NextResponse.json(
      {
        error: {
          code: "BAD_REQUEST",
          message: "politicianId query parameter is required",
          timestamp: new Date().toISOString(),
        },
      },
      { status: 400 }
    );
  }

  // Parse pagination
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));

  // Parse filters
  const filters: BillFilters = {};

  const status = searchParams.get("status");
  if (status && isValidBillStatus(status)) {
    filters.status = status as BillStatus;
  }

  const authorRole = searchParams.get("authorRole");
  if (authorRole && isValidAuthorRole(authorRole)) {
    filters.authorRole = authorRole as BillAuthorRole;
  }

  const chamber = searchParams.get("chamber");
  if (chamber && isValidChamber(chamber)) {
    filters.chamber = chamber as Chamber;
  }

  const congress = searchParams.get("congress");
  if (congress) {
    const congressNum = parseInt(congress, 10);
    if (!isNaN(congressNum)) {
      filters.congress = congressNum;
    }
  }

  const session = searchParams.get("session");
  if (session) {
    const sessionNum = parseInt(session, 10);
    if (!isNaN(sessionNum)) {
      filters.session = sessionNum;
    }
  }

  // Parse sorting
  let sort: BillSortOptions | undefined;
  const sortBy = searchParams.get("sortBy");
  const sortOrder = searchParams.get("sortOrder");

  if (sortBy && isValidSortField(sortBy)) {
    sort = {
      field: sortBy as BillSortField,
      order: (sortOrder === "asc" ? "asc" : "desc") as SortOrder,
    };
  }

  try {
    const result = await getBills(politicianId, filters, sort, { page, pageSize });

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
        ...(result.reviewedBatch && { reviewedBatch: result.reviewedBatch }),
        timestamp: new Date().toISOString(),
        ...apiSourceMetadata(
          !!result.reviewedBatch || result.items.some((item) => !!item.reviewedBatch),
          result.items.some((item) => !item.reviewedBatch)
        ),
      },
    });

    return addApiResponseHeaders(response);
  } catch (error) {
    console.error("Error fetching bills:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch bills",
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}

function isValidBillStatus(status: string): boolean {
  return ["pending", "passed", "vetoed", "lapsed", "withdrawn"].includes(status);
}

function isValidAuthorRole(role: string): boolean {
  return Object.values(BillAuthorRole).includes(role as BillAuthorRole);
}

function isValidChamber(chamber: string): boolean {
  return ["senate", "house"].includes(chamber);
}

function isValidSortField(field: string): boolean {
  return ["filingDate", "status", "title"].includes(field);
}

export const GET = withApiAuth(handler);
