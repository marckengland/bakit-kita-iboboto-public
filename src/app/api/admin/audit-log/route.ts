/**
 * Admin Audit Log API Route
 *
 * Provides searchable audit log interface for administrators.
 * Supports filtering by action, data type, actor, data ID, and time range.
 *
 * Requirements: 36.6, 36.10, 39.5
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getAuditLog,
  getEntriesByAction,
  getEntriesByDataType,
  getEntriesByActor,
  getEntriesByDataId,
  getEntriesInTimeRange,
  type AuditEntry,
  type AuditAction,
  type DataType,
} from "@/services/blockchain-audit.service";

// Valid admin roles that can access audit logs
const ALLOWED_ROLES = ["super_admin", "auditor"];

/**
 * GET /api/admin/audit-log
 *
 * Fetch audit log entries with optional filtering and pagination.
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin role
    const adminRole = request.headers.get("x-admin-role");
    if (!adminRole || !ALLOWED_ROLES.includes(adminRole)) {
      return NextResponse.json(
        { error: "Unauthorized. Auditor or Super Admin role required." },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;

    // Pagination parameters
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    // Filter parameters
    const action = searchParams.get("action") as AuditAction | null;
    const dataType = searchParams.get("dataType") as DataType | null;
    const actor = searchParams.get("actor");
    const dataId = searchParams.get("dataId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Get all entries
    let entries: AuditEntry[] = getAuditLog();

    // Apply filters
    if (action) {
      const actionEntries = getEntriesByAction(action);
      const actionIds = new Set(actionEntries.map((e) => e.id));
      entries = entries.filter((e) => actionIds.has(e.id));
    }

    if (dataType) {
      const typeEntries = getEntriesByDataType(dataType);
      const typeIds = new Set(typeEntries.map((e) => e.id));
      entries = entries.filter((e) => typeIds.has(e.id));
    }

    if (actor) {
      const actorEntries = getEntriesByActor(actor);
      const actorIds = new Set(actorEntries.map((e) => e.id));
      entries = entries.filter((e) => actorIds.has(e.id));
    }

    if (dataId) {
      const dataIdEntries = getEntriesByDataId(dataId);
      const dataIdIds = new Set(dataIdEntries.map((e) => e.id));
      entries = entries.filter((e) => dataIdIds.has(e.id));
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const timeEntries = getEntriesInTimeRange(start, end);
      const timeIds = new Set(timeEntries.map((e) => e.id));
      entries = entries.filter((e) => timeIds.has(e.id));
    } else if (startDate) {
      const start = new Date(startDate);
      entries = entries.filter((e) => new Date(e.timestamp) >= start);
    } else if (endDate) {
      const end = new Date(endDate);
      entries = entries.filter((e) => new Date(e.timestamp) <= end);
    }

    // Sort by timestamp descending (most recent first)
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Calculate pagination
    const total = entries.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedEntries = entries.slice(startIndex, endIndex);

    return NextResponse.json({
      entries: paginatedEntries,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
