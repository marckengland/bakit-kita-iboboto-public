import { legacySourceSelect } from "./public-research.service";
/**
 * Legislative Service
 *
 * Service for managing bills, voting records, and session attendance.
 * Implements requirements: 3.1, 3.2, 3.4, 3.5, 3.6, 3.7, 5.1, 5.2, 5.3, 5.4, 5.5
 * Implements caching per Requirement 44.3
 */

import {
  Prisma,
  BillStatus,
  BillAuthorRole,
  VoteType,
  AttendanceStatus,
  Chamber,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  releaseData,
  getReleasedFiling,
  getReleasedProfile,
  type ReleasedFilingContext,
  type ReleasedProfileContext,
} from "@/lib/release-data";
import {
  PaginationParams,
  PaginatedResult,
  getPrismaPageOptions,
  createPaginatedResult,
} from "@/lib/pagination";
import { getVerifiedSenateFilings, matchesApprovedSenateFiling } from "./senate-chat.service";
import { DataSourceAttribution } from "./politician.service";
import { enhancedCache, cacheKeyGenerators, EXTENDED_CACHE_TTL } from "@/lib/cache-service";

// ============================================
// Types and Interfaces
// ============================================

/**
 * Filters for listing bills
 * Validates: Requirements 3.5, 3.7
 */
export interface BillFilters {
  status?: BillStatus;
  authorRole?: BillAuthorRole;
  chamber?: Chamber;
  congress?: number;
  session?: number;
}

/**
 * Sorting options for bills
 * Validates: Requirement 3.6
 */
export type BillSortField = "filingDate" | "status" | "title";
export type SortOrder = "asc" | "desc";

export interface BillSortOptions {
  field: BillSortField;
  order: SortOrder;
}

/**
 * Bill author information
 * Validates: Requirement 3.7
 */
export interface BillAuthorInfo {
  politicianId: string;
  politicianName: string;
  role: BillAuthorRole;
}

/**
 * Bill summary for list display
 * Validates: Requirements 3.1, 3.2, 3.4, 3.7
 */
export interface BillSummary {
  id: string;
  billNumber: string;
  title: string;
  summary: string | null;
  filingDate: Date | null;
  status: BillStatus | null;
  republicActNumber: string | null;
  chamber: Chamber;
  congress: number;
  session: number | null;
  authorRole: BillAuthorRole;
  reviewedBatch?: ReleasedFilingContext;
}

/**
 * Full bill details
 * Validates: Requirements 3.2, 3.3, 3.4
 */
export interface BillDetails extends BillSummary {
  fullText: string | null;
  authors: BillAuthorInfo[];
  sources: DataSourceAttribution[];
}

/**
 * Voting record entry
 * Validates: Requirements 5.1, 5.2
 */
export interface VotingRecordEntry {
  id: string;
  billId: string;
  billNumber: string;
  billTitle: string;
  vote: VoteType;
  voteDate: Date;
  sources: DataSourceAttribution[];
}

/**
 * Session attendance entry
 * Validates: Requirements 5.3, 5.4, 5.5
 */
export interface AttendanceEntry {
  id: string;
  sessionDate: Date;
  chamber: Chamber;
  status: AttendanceStatus;
  sources: DataSourceAttribution[];
}

/**
 * Attendance statistics
 * Validates: Requirements 5.3, 5.4, 5.5
 */
export interface AttendanceStats {
  totalSessions: number;
  sessionsAttended: number;
  sessionsAbsentExcused: number;
  sessionsAbsentUnexcused: number;
  attendancePercentage: number;
  byChember: {
    chamber: Chamber;
    totalSessions: number;
    sessionsAttended: number;
    attendancePercentage: number;
  }[];
}

// ============================================
// Helper Functions
// ============================================

/**
 * Transforms a source attribution from Prisma to the service interface
 */
function transformSourceAttribution(source: {
  sourceType: string;
  sourceName: string;
  sourceUrl: string | null;
  documentDate: Date | null;
  retrievedAt: Date;
  confidence: Prisma.Decimal | null;
  isAIProcessed: boolean;
  originalDocumentId: string | null;
}): DataSourceAttribution {
  return {
    sourceType: source.sourceType as DataSourceAttribution["sourceType"],
    sourceName: source.sourceName,
    sourceUrl: source.sourceUrl,
    documentDate: source.documentDate,
    retrievedAt: source.retrievedAt,
    confidence: source.confidence === null ? null : Number(source.confidence),
    isAIProcessed: source.isAIProcessed,
    originalDocumentId: source.originalDocumentId,
  };
}

/**
 * Build Prisma orderBy clause from sort options
 * Validates: Requirement 3.6
 */
function buildBillOrderBy(sort?: BillSortOptions): Prisma.BillOrderByWithRelationInput {
  if (!sort) {
    // Default: sort by filing date descending
    return { filingDate: "desc" };
  }

  switch (sort.field) {
    case "filingDate":
      return { filingDate: sort.order };
    case "status":
      return { status: sort.order };
    case "title":
      return { title: sort.order };
    default:
      return { filingDate: "desc" };
  }
}

// ============================================
// Service Implementation
// ============================================

/**
 * Get bills authored by a politician with filtering and sorting
 * Validates: Requirements 3.1, 3.2, 3.4, 3.5, 3.6, 3.7
 */
export async function getBills(
  politicianId: string,
  filters: BillFilters = {},
  sort?: BillSortOptions,
  pagination: PaginationParams = { page: 1, pageSize: 20 }
): Promise<PaginatedResult<BillSummary> & { reviewedBatch?: ReleasedProfileContext }> {
  const { skip, take } = getPrismaPageOptions(pagination);

  // Build where clause for BillAuthor
  const authorWhere: Prisma.BillAuthorWhereInput = {
    politicianId,
    ...(filters.authorRole && { role: filters.authorRole }),
  };

  // Build where clause for Bill
  const billWhere: Prisma.BillWhereInput = {
    BillAuthor: { some: authorWhere },
    ...(filters.status && { status: filters.status }),
    ...(filters.chamber && { chamber: filters.chamber }),
    ...(filters.congress && { congress: filters.congress }),
    ...(filters.session && { session: filters.session }),
  };

  const reviewedBatch = getReleasedProfile(politicianId, null);
  const order = sort?.order === "asc" ? "asc" : "desc";
  const unknownsLast = { sort: order, nulls: "last" } as const;
  let orderBy: Prisma.BillOrderByWithRelationInput | Prisma.BillOrderByWithRelationInput[];
  if (!reviewedBatch) {
    orderBy = buildBillOrderBy(sort);
  } else {
    const primary: Prisma.BillOrderByWithRelationInput =
      sort?.field === "title"
        ? { title: order }
        : sort?.field === "status"
          ? { status: unknownsLast }
          : { filingDate: unknownsLast };
    orderBy = [primary, { id: "asc" }];
  }

  // Execute count and find in parallel
  const [totalCount, bills] = await Promise.all([
    prisma.bill.count({ where: billWhere }),
    prisma.bill.findMany({
      where: billWhere,
      skip,
      take,
      orderBy,
      include: {
        BillAuthor: {
          where: { politicianId },
          select: { role: true },
        },
      },
    }),
  ]);

  // Read the same live, identity-checked rows used by reviewed-record chat.
  const verified = await getVerifiedSenateFilings(
    bills.filter((bill) => getReleasedFiling(bill.id)?.refresh).map((bill) => bill.id)
  );

  // Transform to summary format
  const items: BillSummary[] = bills.map((bill) => {
    const approved = verified.get(bill.id);
    const reviewedBatch =
      approved &&
      matchesApprovedSenateFiling(
        {
          ...bill,
          BillAuthor: bill.BillAuthor.map((author) => ({ politicianId, role: author.role })),
        },
        approved
      )
        ? approved
        : getReleasedFiling(bill.id, false);
    return {
      id: bill.id,
      billNumber: bill.billNumber,
      title: bill.title,
      summary: bill.summary,
      filingDate: bill.filingDate,
      status: bill.status,
      republicActNumber: bill.republicActNumber,
      chamber: bill.chamber,
      congress: bill.congress,
      session: bill.session,
      authorRole: bill.BillAuthor[0]?.role ?? BillAuthorRole.co_author,
      ...(reviewedBatch && { reviewedBatch }),
    };
  });

  return {
    ...createPaginatedResult(items, totalCount, pagination),
    ...(reviewedBatch && { reviewedBatch }),
  };
}

/**
 * Get a bill by ID with full details
 * Validates: Requirements 3.2, 3.3, 3.4
 * Implements caching per Requirement 44.3
 */
export async function getBillById(billId: string): Promise<BillDetails | null> {
  const cacheKey = cacheKeyGenerators.bill(billId);

  const detail = await enhancedCache.getOrFetch<BillDetails | null>(
    cacheKey,
    async () => {
      const bill = await prisma.bill.findUnique({
        where: { id: billId },
        include: {
          BillAuthor: {
            include: {
              Politician: {
                select: { id: true, fullName: true },
              },
            },
          },
          SourceAttribution: { select: legacySourceSelect },
        },
      });

      if (!bill) {
        return null;
      }

      // Transform authors
      const authors: BillAuthorInfo[] = bill.BillAuthor.map((author) => ({
        politicianId: author.Politician.id,
        politicianName: author.Politician.fullName,
        role: author.role,
      }));

      // Transform sources
      const sources = bill.SourceAttribution.map(transformSourceAttribution);
      const reviewedBatch = getReleasedFiling(bill.id, false);

      return {
        id: bill.id,
        billNumber: bill.billNumber,
        title: bill.title,
        summary: bill.summary,
        fullText: bill.fullText,
        filingDate: bill.filingDate,
        status: bill.status,
        republicActNumber: bill.republicActNumber,
        chamber: bill.chamber,
        congress: bill.congress,
        session: bill.session,
        authorRole: authors[0]?.role ?? BillAuthorRole.co_author,
        authors,
        sources,
        ...(reviewedBatch && { reviewedBatch }),
      };
    },
    EXTENDED_CACHE_TTL.BILL_DATA
  );
  if (!detail) {
    return null;
  }
  const approved = getReleasedFiling(billId);
  if (!approved) {
    return detail;
  }
  // Reproject cached values: a previous cache entry may contain now-stale evidence.
  let reviewedBatch = getReleasedFiling(billId, false)!;
  if (
    approved.refresh &&
    detail.authors[0]?.politicianName ===
      releaseData.profiles.find((profile) => profile.id === approved.introducedBy.profileId)
        ?.displayName &&
    matchesApprovedSenateFiling(
      {
        ...detail,
        BillAuthor: detail.authors.map((author) => ({
          politicianId: author.politicianId,
          role: author.role,
        })),
      },
      approved
    )
  ) {
    const history = await getVerifiedSenateFilings([billId]);
    reviewedBatch = history.get(billId) ?? reviewedBatch;
  }
  return { ...detail, reviewedBatch };
}

/**
 * Get voting records for a politician
 * Validates: Requirements 5.1, 5.2
 */
export async function getVotingRecords(
  politicianId: string,
  pagination: PaginationParams = { page: 1, pageSize: 20 }
): Promise<PaginatedResult<VotingRecordEntry>> {
  const { skip, take } = getPrismaPageOptions(pagination);

  const where: Prisma.VotingRecordWhereInput = { politicianId };

  const [totalCount, records] = await Promise.all([
    prisma.votingRecord.count({ where }),
    prisma.votingRecord.findMany({
      where,
      skip,
      take,
      orderBy: { voteDate: "desc" },
      include: {
        Bill: {
          select: { id: true, billNumber: true, title: true },
        },
        SourceAttribution: { select: legacySourceSelect },
      },
    }),
  ]);

  const items: VotingRecordEntry[] = records.map((record) => ({
    id: record.id,
    billId: record.Bill.id,
    billNumber: record.Bill.billNumber,
    billTitle: record.Bill.title,
    vote: record.vote,
    voteDate: record.voteDate,
    sources: record.SourceAttribution.map(transformSourceAttribution),
  }));

  return createPaginatedResult(items, totalCount, pagination);
}

/**
 * Get attendance statistics for a politician
 * Validates: Requirements 5.3, 5.4, 5.5
 */
export async function getAttendanceStats(politicianId: string): Promise<AttendanceStats> {
  // Get all attendance records for the politician
  const records = await prisma.sessionAttendance.findMany({
    where: { politicianId },
    select: { chamber: true, status: true },
  });

  const totalSessions = records.length;
  const sessionsAttended = records.filter((r) => r.status === AttendanceStatus.present).length;
  const sessionsAbsentExcused = records.filter(
    (r) => r.status === AttendanceStatus.absent_excused
  ).length;
  const sessionsAbsentUnexcused = records.filter(
    (r) => r.status === AttendanceStatus.absent_unexcused
  ).length;

  const attendancePercentage = totalSessions > 0 ? (sessionsAttended / totalSessions) * 100 : 0;

  // Calculate stats by chamber
  const chambers: Chamber[] = [Chamber.senate, Chamber.house];
  const byChember = chambers
    .map((chamber) => {
      const chamberRecords = records.filter((r) => r.chamber === chamber);
      const chamberTotal = chamberRecords.length;
      const chamberAttended = chamberRecords.filter(
        (r) => r.status === AttendanceStatus.present
      ).length;

      return {
        chamber,
        totalSessions: chamberTotal,
        sessionsAttended: chamberAttended,
        attendancePercentage: chamberTotal > 0 ? (chamberAttended / chamberTotal) * 100 : 0,
      };
    })
    .filter((c) => c.totalSessions > 0);

  return {
    totalSessions,
    sessionsAttended,
    sessionsAbsentExcused,
    sessionsAbsentUnexcused,
    attendancePercentage,
    byChember,
  };
}

/**
 * Get attendance records for a politician with pagination
 * Validates: Requirements 5.3, 5.4, 5.5
 */
export async function getAttendanceRecords(
  politicianId: string,
  pagination: PaginationParams = { page: 1, pageSize: 20 }
): Promise<PaginatedResult<AttendanceEntry>> {
  const { skip, take } = getPrismaPageOptions(pagination);

  const where: Prisma.SessionAttendanceWhereInput = { politicianId };

  const [totalCount, records] = await Promise.all([
    prisma.sessionAttendance.count({ where }),
    prisma.sessionAttendance.findMany({
      where,
      skip,
      take,
      orderBy: { sessionDate: "desc" },
      include: {
        SourceAttribution: { select: legacySourceSelect },
      },
    }),
  ]);

  const items: AttendanceEntry[] = records.map((record) => ({
    id: record.id,
    sessionDate: record.sessionDate,
    chamber: record.chamber,
    status: record.status,
    sources: record.SourceAttribution.map(transformSourceAttribution),
  }));

  return createPaginatedResult(items, totalCount, pagination);
}
