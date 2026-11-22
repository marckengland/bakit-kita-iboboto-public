/**
 * Bills API Route
 *
 * GET /api/politicians/[id]/bills
 * Returns bills authored by a politician with filtering and sorting.
 * Requirements: 3.1, 3.2, 3.4, 3.5, 3.6, 3.7
 */

import { NextRequest, NextResponse } from "next/server";
import { BillStatus, BillAuthorRole } from "@prisma/client";
import { getBills, BillFilters, BillSortField, SortOrder } from "@/services/legislative.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: politicianId } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Parse pagination
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);

    // Parse filters - Requirement 3.5
    const filters: BillFilters = {};

    const status = searchParams.get("status");
    if (status && Object.values(BillStatus).includes(status as BillStatus)) {
      filters.status = status as BillStatus;
    }

    const authorRole = searchParams.get("authorRole");
    if (authorRole && Object.values(BillAuthorRole).includes(authorRole as BillAuthorRole)) {
      filters.authorRole = authorRole as BillAuthorRole;
    }

    // Parse sorting - Requirement 3.6
    const sortField = searchParams.get("sortField") as BillSortField | null;
    const sortOrder = searchParams.get("sortOrder") as SortOrder | null;

    const sort = sortField ? { field: sortField, order: sortOrder || "desc" } : undefined;

    const result = await getBills(politicianId, filters, sort, { page, pageSize });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching bills:", error);
    return NextResponse.json({ error: "Failed to fetch bills" }, { status: 500 });
  }
}
