/**
 * Attendance Records API Route
 *
 * GET /api/politicians/[id]/attendance/records
 * Returns attendance records for a politician with pagination.
 * Requirements: 5.3, 5.4, 5.5
 */

import { NextRequest, NextResponse } from "next/server";
import { getAttendanceRecords } from "@/services/legislative.service";

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

    const result = await getAttendanceRecords(politicianId, { page, pageSize });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching attendance records:", error);
    return NextResponse.json({ error: "Failed to fetch attendance records" }, { status: 500 });
  }
}
