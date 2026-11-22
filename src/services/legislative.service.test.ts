/**
 * Unit Tests for Legislative Service
 *
 * Tests the legislative service implementation for:
 * - getBills: Fetching bills with filtering and sorting
 * - getBillById: Fetching a single bill with full details
 * - getVotingRecords: Fetching voting records for a politician
 * - getAttendanceStats: Calculating attendance statistics
 * - getAttendanceRecords: Fetching attendance records with pagination
 *
 * **Validates: Requirements 3.1, 3.2, 3.4, 3.5, 3.6, 3.7, 5.1, 5.2, 5.3, 5.4, 5.5**
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  BillStatus,
  BillAuthorRole,
  VoteType,
  AttendanceStatus,
  Chamber,
  SourceType,
  Prisma,
} from "@prisma/client";

// Mock Prisma before importing the service
vi.mock("@/lib/prisma", () => ({
  default: {
    bill: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    votingRecord: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    sessionAttendance: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import {
  getBills,
  getBillById,
  getVotingRecords,
  getAttendanceStats,
  getAttendanceRecords,
} from "./legislative.service";

// Helper to create mock source attribution
function createMockSourceAttribution(overrides = {}) {
  return {
    id: "source-1",
    sourceType: SourceType.legislative_record,
    sourceName: "Senate Records",
    sourceUrl: "https://senate.gov.ph",
    documentDate: new Date("2024-01-01"),
    retrievedAt: new Date("2024-01-15"),
    confidence: new Prisma.Decimal("0.95"),
    isAIProcessed: false,
    originalDocumentId: null,
    fieldName: "bill",
    createdAt: new Date(),
    ...overrides,
  };
}

// Helper to create mock bill data
function createMockBill(overrides = {}) {
  return {
    id: "bill-1",
    billNumber: "SB-1234",
    title: "An Act Providing for Free Education",
    summary: "This bill provides free education for all Filipinos.",
    fullText: "Full text of the bill...",
    filingDate: new Date("2024-01-15"),
    status: BillStatus.pending,
    republicActNumber: null,
    chamber: Chamber.senate,
    congress: 19,
    session: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Helper to create mock voting record
function createMockVotingRecord(overrides = {}) {
  return {
    id: "vr-1",
    politicianId: "pol-1",
    billId: "bill-1",
    vote: VoteType.yes,
    voteDate: new Date("2024-02-01"),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Helper to create mock attendance record
function createMockAttendance(overrides = {}) {
  return {
    id: "att-1",
    politicianId: "pol-1",
    sessionDate: new Date("2024-01-15"),
    chamber: Chamber.senate,
    status: AttendanceStatus.present,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("Legislative Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getBills", () => {
    /**
     * **Validates: Requirements 3.1, 3.2**
     * Display list of bills with bill number, title, filing date, status, summary
     */
    it("should return paginated list of bills for a politician", async () => {
      const mockBills = [
        createMockBill({
          BillAuthor: [{ role: BillAuthorRole.principal_author }],
        }),
        createMockBill({
          id: "bill-2",
          billNumber: "SB-5678",
          title: "Healthcare Reform Act",
          BillAuthor: [{ role: BillAuthorRole.co_author }],
        }),
      ];

      vi.mocked(prisma.bill.count).mockResolvedValue(2);
      vi.mocked(prisma.bill.findMany).mockResolvedValue(mockBills);

      const result = await getBills("pol-1");

      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.items[0]!.billNumber).toBe("SB-1234");
      expect(result.items[0]!.title).toBe("An Act Providing for Free Education");
      expect(result.items[0]!.summary).toBe("This bill provides free education for all Filipinos.");
      expect(result.items[0]!.filingDate).toEqual(new Date("2024-01-15"));
      expect(result.items[0]!.status).toBe(BillStatus.pending);
    });

    /**
     * **Validates: Requirement 3.4**
     * Bills that became law should show Republic Act number
     */
    it("should include Republic Act number for passed bills", async () => {
      const mockBills = [
        createMockBill({
          status: BillStatus.passed,
          republicActNumber: "RA-11931",
          BillAuthor: [{ role: BillAuthorRole.principal_author }],
        }),
      ];

      vi.mocked(prisma.bill.count).mockResolvedValue(1);
      vi.mocked(prisma.bill.findMany).mockResolvedValue(mockBills);

      const result = await getBills("pol-1");

      expect(result.items[0]!.status).toBe(BillStatus.passed);
      expect(result.items[0]!.republicActNumber).toBe("RA-11931");
    });

    /**
     * **Validates: Requirement 3.5**
     * Filter bills by status (pending, passed, vetoed, lapsed)
     */
    it("should filter bills by status", async () => {
      vi.mocked(prisma.bill.count).mockResolvedValue(0);
      vi.mocked(prisma.bill.findMany).mockResolvedValue([]);

      await getBills("pol-1", { status: BillStatus.passed });

      expect(prisma.bill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: BillStatus.passed,
          }),
        })
      );
    });

    /**
     * **Validates: Requirement 3.6**
     * Sort bills by date filed
     */
    it("should sort bills by filing date", async () => {
      vi.mocked(prisma.bill.count).mockResolvedValue(0);
      vi.mocked(prisma.bill.findMany).mockResolvedValue([]);

      await getBills("pol-1", {}, { field: "filingDate", order: "desc" });

      expect(prisma.bill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { filingDate: "desc" },
        })
      );
    });

    /**
     * **Validates: Requirement 3.6**
     * Sort bills by status
     */
    it("should sort bills by status", async () => {
      vi.mocked(prisma.bill.count).mockResolvedValue(0);
      vi.mocked(prisma.bill.findMany).mockResolvedValue([]);

      await getBills("pol-1", {}, { field: "status", order: "asc" });

      expect(prisma.bill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { status: "asc" },
        })
      );
    });

    /**
     * **Validates: Requirement 3.6**
     * Sort bills alphabetically by title
     */
    it("should sort bills alphabetically by title", async () => {
      vi.mocked(prisma.bill.count).mockResolvedValue(0);
      vi.mocked(prisma.bill.findMany).mockResolvedValue([]);

      await getBills("pol-1", {}, { field: "title", order: "asc" });

      expect(prisma.bill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { title: "asc" },
        })
      );
    });

    /**
     * **Validates: Requirement 3.7**
     * Distinguish between principal author and co-author
     */
    it("should filter bills by author role", async () => {
      vi.mocked(prisma.bill.count).mockResolvedValue(0);
      vi.mocked(prisma.bill.findMany).mockResolvedValue([]);

      await getBills("pol-1", { authorRole: BillAuthorRole.principal_author });

      expect(prisma.bill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            BillAuthor: {
              some: {
                politicianId: "pol-1",
                role: BillAuthorRole.principal_author,
              },
            },
          }),
        })
      );
    });

    /**
     * **Validates: Requirement 3.7**
     * Include author role in bill summary
     */
    it("should include author role in bill summary", async () => {
      const mockBills = [
        createMockBill({
          BillAuthor: [{ role: BillAuthorRole.principal_author }],
        }),
      ];

      vi.mocked(prisma.bill.count).mockResolvedValue(1);
      vi.mocked(prisma.bill.findMany).mockResolvedValue(mockBills);

      const result = await getBills("pol-1");

      expect(result.items[0]!.authorRole).toBe(BillAuthorRole.principal_author);
    });

    it("should use default sorting by filing date descending", async () => {
      vi.mocked(prisma.bill.count).mockResolvedValue(0);
      vi.mocked(prisma.bill.findMany).mockResolvedValue([]);

      await getBills("pol-1");

      expect(prisma.bill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { filingDate: "desc" },
        })
      );
    });

    it("should return empty result when no bills found", async () => {
      vi.mocked(prisma.bill.count).mockResolvedValue(0);
      vi.mocked(prisma.bill.findMany).mockResolvedValue([]);

      const result = await getBills("pol-1");

      expect(result.items).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });
  });

  describe("getBillById", () => {
    /**
     * **Validates: Requirements 3.2, 3.3**
     * Display bill details with full content
     */
    it("should return bill with full details", async () => {
      const mockBill = {
        ...createMockBill(),
        BillAuthor: [
          {
            id: "ba-1",
            billId: "bill-1",
            politicianId: "pol-1",
            role: BillAuthorRole.principal_author,
            createdAt: new Date(),
            Politician: { id: "pol-1", fullName: "Juan Dela Cruz" },
          },
        ],
        SourceAttribution: [createMockSourceAttribution()],
      };

      vi.mocked(prisma.bill.findUnique).mockResolvedValue(mockBill);

      const result = await getBillById("bill-1");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("bill-1");
      expect(result!.billNumber).toBe("SB-1234");
      expect(result!.fullText).toBe("Full text of the bill...");
      expect(result!.authors).toHaveLength(1);
      expect(result!.authors[0]!.politicianName).toBe("Juan Dela Cruz");
      expect(result!.authors[0]!.role).toBe(BillAuthorRole.principal_author);
    });

    it("should include source attributions", async () => {
      const mockBill = {
        ...createMockBill(),
        BillAuthor: [],
        SourceAttribution: [createMockSourceAttribution({ sourceName: "Senate Official Gazette" })],
      };

      vi.mocked(prisma.bill.findUnique).mockResolvedValue(mockBill);

      const result = await getBillById("bill-1");

      expect(result!.sources).toHaveLength(1);
      expect(result!.sources[0]!.sourceName).toBe("Senate Official Gazette");
    });

    it("should return null for non-existent bill", async () => {
      vi.mocked(prisma.bill.findUnique).mockResolvedValue(null);

      const result = await getBillById("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("getVotingRecords", () => {
    /**
     * **Validates: Requirements 5.1, 5.2**
     * Display voting record with bill, vote, and date
     */
    it("should return paginated voting records", async () => {
      const mockRecords = [
        {
          ...createMockVotingRecord(),
          Bill: { id: "bill-1", billNumber: "SB-1234", title: "Education Act" },
          SourceAttribution: [createMockSourceAttribution()],
        },
        {
          ...createMockVotingRecord({
            id: "vr-2",
            billId: "bill-2",
            vote: VoteType.no,
            voteDate: new Date("2024-01-15"),
          }),
          Bill: { id: "bill-2", billNumber: "SB-5678", title: "Tax Reform Act" },
          SourceAttribution: [],
        },
      ];

      vi.mocked(prisma.votingRecord.count).mockResolvedValue(2);
      vi.mocked(prisma.votingRecord.findMany).mockResolvedValue(mockRecords);

      const result = await getVotingRecords("pol-1");

      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.items[0]!.billNumber).toBe("SB-1234");
      expect(result.items[0]!.billTitle).toBe("Education Act");
      expect(result.items[0]!.vote).toBe(VoteType.yes);
      expect(result.items[0]!.voteDate).toEqual(new Date("2024-02-01"));
      expect(result.items[1]!.vote).toBe(VoteType.no);
    });

    it("should sort voting records by date descending", async () => {
      vi.mocked(prisma.votingRecord.count).mockResolvedValue(0);
      vi.mocked(prisma.votingRecord.findMany).mockResolvedValue([]);

      await getVotingRecords("pol-1");

      expect(prisma.votingRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { voteDate: "desc" },
        })
      );
    });

    it("should return empty result when no voting records found", async () => {
      vi.mocked(prisma.votingRecord.count).mockResolvedValue(0);
      vi.mocked(prisma.votingRecord.findMany).mockResolvedValue([]);

      const result = await getVotingRecords("pol-1");

      expect(result.items).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });
  });

  describe("getAttendanceStats", () => {
    /**
     * **Validates: Requirements 5.3, 5.4**
     * Display attendance statistics as percentage and counts
     */
    it("should calculate attendance statistics correctly", async () => {
      const mockRecords = [
        createMockAttendance({ status: AttendanceStatus.present }),
        createMockAttendance({ id: "att-2", status: AttendanceStatus.present }),
        createMockAttendance({ id: "att-3", status: AttendanceStatus.absent_excused }),
        createMockAttendance({ id: "att-4", status: AttendanceStatus.absent_unexcused }),
        createMockAttendance({ id: "att-5", status: AttendanceStatus.present }),
      ];

      vi.mocked(prisma.sessionAttendance.findMany).mockResolvedValue(mockRecords);

      const result = await getAttendanceStats("pol-1");

      expect(result.totalSessions).toBe(5);
      expect(result.sessionsAttended).toBe(3);
      expect(result.sessionsAbsentExcused).toBe(1);
      expect(result.sessionsAbsentUnexcused).toBe(1);
      expect(result.attendancePercentage).toBe(60); // 3/5 * 100
    });

    /**
     * **Validates: Requirement 5.5**
     * Indicate excused vs unexcused absences
     */
    it("should distinguish between excused and unexcused absences", async () => {
      const mockRecords = [
        createMockAttendance({ status: AttendanceStatus.absent_excused }),
        createMockAttendance({ id: "att-2", status: AttendanceStatus.absent_excused }),
        createMockAttendance({ id: "att-3", status: AttendanceStatus.absent_unexcused }),
      ];

      vi.mocked(prisma.sessionAttendance.findMany).mockResolvedValue(mockRecords);

      const result = await getAttendanceStats("pol-1");

      expect(result.sessionsAbsentExcused).toBe(2);
      expect(result.sessionsAbsentUnexcused).toBe(1);
    });

    it("should calculate stats by chamber", async () => {
      const mockRecords = [
        createMockAttendance({ chamber: Chamber.senate, status: AttendanceStatus.present }),
        createMockAttendance({
          id: "att-2",
          chamber: Chamber.senate,
          status: AttendanceStatus.present,
        }),
        createMockAttendance({
          id: "att-3",
          chamber: Chamber.senate,
          status: AttendanceStatus.absent_excused,
        }),
        createMockAttendance({
          id: "att-4",
          chamber: Chamber.house,
          status: AttendanceStatus.present,
        }),
        createMockAttendance({
          id: "att-5",
          chamber: Chamber.house,
          status: AttendanceStatus.absent_unexcused,
        }),
      ];

      vi.mocked(prisma.sessionAttendance.findMany).mockResolvedValue(mockRecords);

      const result = await getAttendanceStats("pol-1");

      expect(result.byChember).toHaveLength(2);

      const senateStats = result.byChember.find((c) => c.chamber === Chamber.senate);
      expect(senateStats!.totalSessions).toBe(3);
      expect(senateStats!.sessionsAttended).toBe(2);
      expect(senateStats!.attendancePercentage).toBeCloseTo(66.67, 1);

      const houseStats = result.byChember.find((c) => c.chamber === Chamber.house);
      expect(houseStats!.totalSessions).toBe(2);
      expect(houseStats!.sessionsAttended).toBe(1);
      expect(houseStats!.attendancePercentage).toBe(50);
    });

    it("should return zero percentage when no sessions", async () => {
      vi.mocked(prisma.sessionAttendance.findMany).mockResolvedValue([]);

      const result = await getAttendanceStats("pol-1");

      expect(result.totalSessions).toBe(0);
      expect(result.sessionsAttended).toBe(0);
      expect(result.attendancePercentage).toBe(0);
      expect(result.byChember).toHaveLength(0);
    });

    it("should only include chambers with sessions in byChember", async () => {
      const mockRecords = [
        createMockAttendance({ chamber: Chamber.senate, status: AttendanceStatus.present }),
      ];

      vi.mocked(prisma.sessionAttendance.findMany).mockResolvedValue(mockRecords);

      const result = await getAttendanceStats("pol-1");

      expect(result.byChember).toHaveLength(1);
      expect(result.byChember[0]!.chamber).toBe(Chamber.senate);
    });
  });

  describe("getAttendanceRecords", () => {
    /**
     * **Validates: Requirements 5.3, 5.4, 5.5**
     * Display attendance records with date, chamber, and status
     */
    it("should return paginated attendance records", async () => {
      const mockRecords = [
        {
          ...createMockAttendance(),
          SourceAttribution: [createMockSourceAttribution()],
        },
        {
          ...createMockAttendance({
            id: "att-2",
            sessionDate: new Date("2024-01-10"),
            status: AttendanceStatus.absent_excused,
          }),
          SourceAttribution: [],
        },
      ];

      vi.mocked(prisma.sessionAttendance.count).mockResolvedValue(2);
      vi.mocked(prisma.sessionAttendance.findMany).mockResolvedValue(mockRecords);

      const result = await getAttendanceRecords("pol-1");

      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.items[0]!.sessionDate).toEqual(new Date("2024-01-15"));
      expect(result.items[0]!.chamber).toBe(Chamber.senate);
      expect(result.items[0]!.status).toBe(AttendanceStatus.present);
      expect(result.items[1]!.status).toBe(AttendanceStatus.absent_excused);
    });

    it("should sort attendance records by date descending", async () => {
      vi.mocked(prisma.sessionAttendance.count).mockResolvedValue(0);
      vi.mocked(prisma.sessionAttendance.findMany).mockResolvedValue([]);

      await getAttendanceRecords("pol-1");

      expect(prisma.sessionAttendance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { sessionDate: "desc" },
        })
      );
    });

    it("should include source attributions", async () => {
      const mockRecords = [
        {
          ...createMockAttendance(),
          SourceAttribution: [createMockSourceAttribution({ sourceName: "Senate Journal" })],
        },
      ];

      vi.mocked(prisma.sessionAttendance.count).mockResolvedValue(1);
      vi.mocked(prisma.sessionAttendance.findMany).mockResolvedValue(mockRecords);

      const result = await getAttendanceRecords("pol-1");

      expect(result.items[0]!.sources).toHaveLength(1);
      expect(result.items[0]!.sources[0]!.sourceName).toBe("Senate Journal");
    });

    it("should return empty result when no attendance records found", async () => {
      vi.mocked(prisma.sessionAttendance.count).mockResolvedValue(0);
      vi.mocked(prisma.sessionAttendance.findMany).mockResolvedValue([]);

      const result = await getAttendanceRecords("pol-1");

      expect(result.items).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it("should respect pagination parameters", async () => {
      vi.mocked(prisma.sessionAttendance.count).mockResolvedValue(50);
      vi.mocked(prisma.sessionAttendance.findMany).mockResolvedValue([]);

      const result = await getAttendanceRecords("pol-1", { page: 2, pageSize: 10 });

      expect(prisma.sessionAttendance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
    });
  });
});
