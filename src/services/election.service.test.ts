import { legacySourceSelect } from "./public-research.service";
/**
 * Election Service Unit Tests
 *
 * Tests for election history and controversy data management.
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Prisma } from "@prisma/client";
import {
  getElectionHistory,
  getElectionResult,
  getControversies,
  getControversy,
  getVerifiedControversies,
  hasElectionRecords,
  hasControversies,
  getControversiesByStatus,
  getOngoingCases,
  getElectionWins,
  getElectionLosses,
  calculateMarginOrDeficit,
  ElectionOpponentData,
} from "./election.service";
import prisma from "@/lib/prisma";
import {
  ElectionResult,
  SourceType,
  ControversyStatus,
  ControversyCategory,
  ElectionType,
} from "@prisma/client";

// Mock Prisma client
vi.mock("@/lib/prisma", () => ({
  default: {
    electionResultRecord: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    controversy: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}));

describe("Election Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============================================
  // calculateMarginOrDeficit Tests
  // ============================================

  describe("calculateMarginOrDeficit", () => {
    it("should return positive margin when politician won", () => {
      const opponents: ElectionOpponentData[] = [
        { id: "1", name: "Opponent A", party: "Party A", voteCount: 8000, votePercentage: 40 },
        { id: "2", name: "Opponent B", party: "Party B", voteCount: 2000, votePercentage: 10 },
      ];

      const margin = calculateMarginOrDeficit("won", 10000, opponents);
      expect(margin).toBe(2000); // 10000 - 8000
    });

    it("should return negative deficit when politician lost", () => {
      const opponents: ElectionOpponentData[] = [
        { id: "1", name: "Winner", party: "Party A", voteCount: 12000, votePercentage: 60 },
        { id: "2", name: "Other", party: "Party B", voteCount: 3000, votePercentage: 15 },
      ];

      const deficit = calculateMarginOrDeficit("lost", 5000, opponents);
      expect(deficit).toBe(-7000); // 5000 - 12000
    });

    it("should return null when no opponents", () => {
      const margin = calculateMarginOrDeficit("won", 10000, []);
      expect(margin).toBeNull();
    });

    it("should handle single opponent correctly", () => {
      const opponents: ElectionOpponentData[] = [
        { id: "1", name: "Opponent", party: null, voteCount: 5000, votePercentage: 33.33 },
      ];

      const margin = calculateMarginOrDeficit("won", 10000, opponents);
      expect(margin).toBe(5000);
    });
  });

  // ============================================
  // getElectionHistory Tests
  // ============================================

  describe("getElectionHistory", () => {
    it("should return election history sorted by year descending", async () => {
      const mockRecords = [
        {
          id: "election-1",
          politicianId: "pol-1",
          electionYear: 2022,
          electionType: "national" as ElectionType,
          positionSought: "Senator",
          jurisdiction: "National",
          result: "won" as ElectionResult,
          voteCount: 15000000,
          totalVotes: 50000000,
          votePercentage: { toNumber: () => 30 },
          rank: 5,
          ElectionOpponent: [
            {
              id: "opp-1",
              name: "Opponent 1",
              party: "Party A",
              voteCount: 14000000,
              votePercentage: { toNumber: () => 28 },
            },
          ],
          SourceAttribution: [
            {
              sourceType: "comelec_filing" as SourceType,
              sourceName: "COMELEC Official Results",
              sourceUrl: "https://comelec.gov.ph",
              documentDate: new Date("2022-05-15"),
              retrievedAt: new Date("2022-06-01"),
              confidence: { toNumber: () => 0.99 },
              isAIProcessed: false,
              originalDocumentId: null,
              fieldName: "electionResult",
            },
          ],
        },
        {
          id: "election-2",
          politicianId: "pol-1",
          electionYear: 2016,
          electionType: "national" as ElectionType,
          positionSought: "Congressman",
          jurisdiction: "District 1, Manila",
          result: "won" as ElectionResult,
          voteCount: 50000,
          totalVotes: 100000,
          votePercentage: { toNumber: () => 50 },
          rank: 1,
          ElectionOpponent: [],
          SourceAttribution: [],
        },
      ];

      vi.mocked(prisma.electionResultRecord.findMany).mockResolvedValue(mockRecords as never);

      const history = await getElectionHistory("pol-1");

      expect(history).toHaveLength(2);
      expect(history[0]!.electionYear).toBe(2022);
      expect(history[1]!.electionYear).toBe(2016);
      expect(prisma.electionResultRecord.findMany).toHaveBeenCalledWith({
        where: { politicianId: "pol-1" },
        orderBy: { electionYear: "desc" },
        include: {
          ElectionOpponent: { orderBy: { voteCount: "desc" } },
          SourceAttribution: { select: legacySourceSelect },
        },
      });
    });

    it("should include COMELEC source attribution", async () => {
      const mockRecords = [
        {
          id: "election-1",
          politicianId: "pol-1",
          electionYear: 2022,
          electionType: "national" as ElectionType,
          positionSought: "Senator",
          jurisdiction: "National",
          result: "won" as ElectionResult,
          voteCount: 15000000,
          totalVotes: 50000000,
          votePercentage: { toNumber: () => 30 },
          rank: 5,
          ElectionOpponent: [],
          SourceAttribution: [
            {
              sourceType: "comelec_filing" as SourceType,
              sourceName: "COMELEC Official Results 2022",
              sourceUrl: "https://comelec.gov.ph/results/2022",
              documentDate: new Date("2022-05-15"),
              retrievedAt: new Date("2022-06-01"),
              confidence: { toNumber: () => 0.99 },
              isAIProcessed: false,
              originalDocumentId: "comelec-2022-results",
              fieldName: "electionResult",
            },
          ],
        },
      ];

      vi.mocked(prisma.electionResultRecord.findMany).mockResolvedValue(mockRecords as never);

      const history = await getElectionHistory("pol-1");

      expect(history[0]!.sources).toHaveLength(1);
      expect(history[0]!.sources[0]!.sourceName).toContain("COMELEC");
      expect(history[0]!.sources[0]!.sourceType).toBe("comelec_filing");
    });

    it("should calculate margin for winning elections", async () => {
      const mockRecords = [
        {
          id: "election-1",
          politicianId: "pol-1",
          electionYear: 2022,
          electionType: "local" as ElectionType,
          positionSought: "Mayor",
          jurisdiction: "City of Manila",
          result: "won" as ElectionResult,
          voteCount: 100000,
          totalVotes: 200000,
          votePercentage: { toNumber: () => 50 },
          rank: 1,
          ElectionOpponent: [
            {
              id: "opp-1",
              name: "Runner Up",
              party: "Party B",
              voteCount: 80000,
              votePercentage: { toNumber: () => 40 },
            },
            {
              id: "opp-2",
              name: "Third Place",
              party: "Party C",
              voteCount: 20000,
              votePercentage: { toNumber: () => 10 },
            },
          ],
          SourceAttribution: [],
        },
      ];

      vi.mocked(prisma.electionResultRecord.findMany).mockResolvedValue(mockRecords as never);

      const history = await getElectionHistory("pol-1");

      expect(history[0]!.marginOrDeficit).toBe(20000); // 100000 - 80000
    });

    it("should return empty array for politician with no elections", async () => {
      vi.mocked(prisma.electionResultRecord.findMany).mockResolvedValue([]);

      const history = await getElectionHistory("pol-no-elections");

      expect(history).toEqual([]);
    });
  });

  // ============================================
  // getElectionResult Tests
  // ============================================

  describe("getElectionResult", () => {
    it("should return detailed election result with opponents", async () => {
      const mockRecord = {
        id: "election-1",
        politicianId: "pol-1",
        electionYear: 2022,
        electionType: "national" as ElectionType,
        positionSought: "Senator",
        jurisdiction: "National",
        result: "won" as ElectionResult,
        voteCount: 15000000,
        totalVotes: 50000000,
        votePercentage: { toString: () => "30", toNumber: () => 30 } as unknown as Prisma.Decimal,
        rank: 5,
        ElectionOpponent: [
          {
            id: "opp-1",
            name: "Opponent 1",
            party: "Party A",
            voteCount: 14000000,
            votePercentage: {
              toString: () => "28",
              toNumber: () => 28,
            } as unknown as Prisma.Decimal,
          },
          {
            id: "opp-2",
            name: "Opponent 2",
            party: "Party B",
            voteCount: 10000000,
            votePercentage: {
              toString: () => "20",
              toNumber: () => 20,
            } as unknown as Prisma.Decimal,
          },
        ],
        SourceAttribution: [],
      };

      vi.mocked(prisma.electionResultRecord.findUnique).mockResolvedValue(mockRecord as never);

      const result = await getElectionResult("election-1");

      expect(result).not.toBeNull();
      expect(result!.opponents).toHaveLength(2);
      expect(result!.opponents[0]!.name).toBe("Opponent 1");
      expect(result!.votePercentage).toBe(30);
    });

    it("should return null for non-existent election", async () => {
      vi.mocked(prisma.electionResultRecord.findUnique).mockResolvedValue(null);

      const result = await getElectionResult("non-existent");

      expect(result).toBeNull();
    });
  });

  // ============================================
  // getControversies Tests
  // ============================================

  describe("getControversies", () => {
    it("should return controversies with source validation", async () => {
      const mockRecords = [
        {
          id: "controversy-1",
          politicianId: "pol-1",
          title: "Corruption Case",
          description: "Alleged misuse of public funds",
          category: "corruption" as ControversyCategory,
          status: "ongoing" as ControversyStatus,
          filingDate: new Date("2023-01-15"),
          resolutionDate: null,
          court: "Sandiganbayan",
          caseNumber: "SB-2023-001",
          SourceAttribution: [
            {
              sourceType: "court_document" as SourceType,
              sourceName: "Sandiganbayan Case Filing",
              sourceUrl: "https://sb.judiciary.gov.ph",
              documentDate: new Date("2023-01-15"),
              retrievedAt: new Date("2023-02-01"),
              confidence: { toNumber: () => 0.99 },
              isAIProcessed: false,
              originalDocumentId: null,
              fieldName: "controversy",
            },
          ],
        },
      ];

      vi.mocked(prisma.controversy.findMany).mockResolvedValue(mockRecords as never);

      const controversies = await getControversies("pol-1");

      expect(controversies).toHaveLength(1);
      expect(controversies[0]!.hasVerifiedSources).toBe(true);
      expect(controversies[0]!.status).toBe("ongoing");
      expect(controversies[0]!.court).toBe("Sandiganbayan");
    });

    it("should mark controversies without official sources as unverified", async () => {
      const mockRecords = [
        {
          id: "controversy-1",
          politicianId: "pol-1",
          title: "Alleged Issue",
          description: "Some allegation",
          category: "other" as ControversyCategory,
          status: "ongoing" as ControversyStatus,
          filingDate: null,
          resolutionDate: null,
          court: null,
          caseNumber: null,
          SourceAttribution: [
            {
              sourceType: "third_party_verified" as SourceType,
              sourceName: "News Article",
              sourceUrl: "https://news.example.com",
              documentDate: new Date("2023-01-15"),
              retrievedAt: new Date("2023-02-01"),
              confidence: { toNumber: () => 0.7 },
              isAIProcessed: false,
              originalDocumentId: null,
              fieldName: "controversy",
            },
          ],
        },
      ];

      vi.mocked(prisma.controversy.findMany).mockResolvedValue(mockRecords as never);

      const controversies = await getControversies("pol-1");

      expect(controversies[0]!.hasVerifiedSources).toBe(false);
    });

    it("should show resolution status correctly", async () => {
      const mockRecords = [
        {
          id: "controversy-1",
          politicianId: "pol-1",
          title: "Dismissed Case",
          description: "Case was dismissed",
          category: "legal_case" as ControversyCategory,
          status: "dismissed" as ControversyStatus,
          filingDate: new Date("2020-01-01"),
          resolutionDate: new Date("2022-06-15"),
          court: "Regional Trial Court",
          caseNumber: "RTC-2020-001",
          SourceAttribution: [
            {
              sourceType: "court_document" as SourceType,
              sourceName: "Court Decision",
              sourceUrl: null,
              documentDate: new Date("2022-06-15"),
              retrievedAt: new Date("2022-07-01"),
              confidence: { toNumber: () => 0.99 },
              isAIProcessed: false,
              originalDocumentId: null,
              fieldName: "controversy",
            },
          ],
        },
      ];

      vi.mocked(prisma.controversy.findMany).mockResolvedValue(mockRecords as never);

      const controversies = await getControversies("pol-1");

      expect(controversies[0]!.status).toBe("dismissed");
      expect(controversies[0]!.resolutionDate).toEqual(new Date("2022-06-15"));
    });
  });

  // ============================================
  // getVerifiedControversies Tests
  // ============================================

  describe("getVerifiedControversies", () => {
    it("should only return controversies with verified official sources", async () => {
      const mockRecords = [
        {
          id: "controversy-1",
          politicianId: "pol-1",
          title: "Verified Case",
          description: "Official court case",
          category: "legal_case" as ControversyCategory,
          status: "ongoing" as ControversyStatus,
          filingDate: new Date("2023-01-15"),
          resolutionDate: null,
          court: "Sandiganbayan",
          caseNumber: "SB-2023-001",
          SourceAttribution: [
            {
              sourceType: "court_document" as SourceType,
              sourceName: "Court Filing",
              sourceUrl: null,
              documentDate: new Date("2023-01-15"),
              retrievedAt: new Date("2023-02-01"),
              confidence: { toNumber: () => 0.99 },
              isAIProcessed: false,
              originalDocumentId: null,
              fieldName: "controversy",
            },
          ],
        },
        {
          id: "controversy-2",
          politicianId: "pol-1",
          title: "Unverified Allegation",
          description: "News report only",
          category: "other" as ControversyCategory,
          status: "ongoing" as ControversyStatus,
          filingDate: null,
          resolutionDate: null,
          court: null,
          caseNumber: null,
          SourceAttribution: [
            {
              sourceType: "ai_extracted" as SourceType,
              sourceName: "News Article",
              sourceUrl: null,
              documentDate: null,
              retrievedAt: new Date("2023-02-01"),
              confidence: { toNumber: () => 0.5 },
              isAIProcessed: true,
              originalDocumentId: null,
              fieldName: "controversy",
            },
          ],
        },
      ];

      vi.mocked(prisma.controversy.findMany).mockResolvedValue(mockRecords as never);

      const verified = await getVerifiedControversies("pol-1");

      expect(verified).toHaveLength(1);
      expect(verified[0]!.title).toBe("Verified Case");
    });
  });

  // ============================================
  // getControversy Tests
  // ============================================

  describe("getControversy", () => {
    it("should return detailed controversy information", async () => {
      const mockRecord = {
        id: "controversy-1",
        politicianId: "pol-1",
        title: "Graft Case",
        description: "Detailed description of the case",
        category: "corruption" as ControversyCategory,
        status: "convicted" as ControversyStatus,
        filingDate: new Date("2018-01-01"),
        resolutionDate: new Date("2023-06-15"),
        court: "Sandiganbayan",
        caseNumber: "SB-2018-001",
        SourceAttribution: [
          {
            sourceType: "court_document" as SourceType,
            sourceName: "Sandiganbayan Decision",
            sourceUrl: "https://sb.judiciary.gov.ph/decisions/2023",
            documentDate: new Date("2023-06-15"),
            retrievedAt: new Date("2023-07-01"),
            confidence: { toNumber: () => 0.99 },
            isAIProcessed: false,
            originalDocumentId: "sb-decision-2023-001",
            fieldName: "controversy",
          },
        ],
      };

      vi.mocked(prisma.controversy.findUnique).mockResolvedValue(mockRecord as never);

      const controversy = await getControversy("controversy-1");

      expect(controversy).not.toBeNull();
      expect(controversy!.status).toBe("convicted");
      expect(controversy!.court).toBe("Sandiganbayan");
      expect(controversy!.hasVerifiedSources).toBe(true);
    });

    it("should return null for non-existent controversy", async () => {
      vi.mocked(prisma.controversy.findUnique).mockResolvedValue(null);

      const controversy = await getControversy("non-existent");

      expect(controversy).toBeNull();
    });
  });

  // ============================================
  // Helper Function Tests
  // ============================================

  describe("hasElectionRecords", () => {
    it("should return true when election records exist", async () => {
      vi.mocked(prisma.electionResultRecord.count).mockResolvedValue(3);

      const result = await hasElectionRecords("pol-1");

      expect(result).toBe(true);
    });

    it("should return false when no election records exist", async () => {
      vi.mocked(prisma.electionResultRecord.count).mockResolvedValue(0);

      const result = await hasElectionRecords("pol-1");

      expect(result).toBe(false);
    });
  });

  describe("hasControversies", () => {
    it("should return true when controversies exist", async () => {
      vi.mocked(prisma.controversy.count).mockResolvedValue(2);

      const result = await hasControversies("pol-1");

      expect(result).toBe(true);
    });

    it("should return false when no controversies exist", async () => {
      vi.mocked(prisma.controversy.count).mockResolvedValue(0);

      const result = await hasControversies("pol-1");

      expect(result).toBe(false);
    });
  });

  describe("getControversiesByStatus", () => {
    it("should filter controversies by status", async () => {
      const mockRecords = [
        {
          id: "controversy-1",
          politicianId: "pol-1",
          title: "Ongoing Case",
          description: "Still in court",
          category: "legal_case" as ControversyCategory,
          status: "ongoing" as ControversyStatus,
          filingDate: new Date("2023-01-15"),
          resolutionDate: null,
          court: "RTC",
          caseNumber: "RTC-2023-001",
          SourceAttribution: [],
        },
        {
          id: "controversy-2",
          politicianId: "pol-1",
          title: "Dismissed Case",
          description: "Already dismissed",
          category: "legal_case" as ControversyCategory,
          status: "dismissed" as ControversyStatus,
          filingDate: new Date("2020-01-01"),
          resolutionDate: new Date("2022-06-15"),
          court: "RTC",
          caseNumber: "RTC-2020-001",
          SourceAttribution: [],
        },
      ];

      vi.mocked(prisma.controversy.findMany).mockResolvedValue(mockRecords as never);

      const ongoing = await getControversiesByStatus("pol-1", "ongoing");

      expect(ongoing).toHaveLength(1);
      expect(ongoing[0]!.title).toBe("Ongoing Case");
    });
  });

  describe("getOngoingCases", () => {
    it("should return only ongoing cases", async () => {
      const mockRecords = [
        {
          id: "controversy-1",
          politicianId: "pol-1",
          title: "Ongoing Case",
          description: "Still in court",
          category: "legal_case" as ControversyCategory,
          status: "ongoing" as ControversyStatus,
          filingDate: new Date("2023-01-15"),
          resolutionDate: null,
          court: "Sandiganbayan",
          caseNumber: "SB-2023-001",
          SourceAttribution: [],
        },
      ];

      vi.mocked(prisma.controversy.findMany).mockResolvedValue(mockRecords as never);

      const ongoing = await getOngoingCases("pol-1");

      expect(ongoing).toHaveLength(1);
      expect(ongoing[0]!.status).toBe("ongoing");
    });
  });

  describe("getElectionWins", () => {
    it("should return only winning elections", async () => {
      const mockRecords = [
        {
          id: "election-1",
          politicianId: "pol-1",
          electionYear: 2022,
          electionType: "national" as ElectionType,
          positionSought: "Senator",
          jurisdiction: "National",
          result: "won" as ElectionResult,
          voteCount: 15000000,
          totalVotes: 50000000,
          votePercentage: { toNumber: () => 30 },
          rank: 5,
          ElectionOpponent: [],
          SourceAttribution: [],
        },
        {
          id: "election-2",
          politicianId: "pol-1",
          electionYear: 2016,
          electionType: "national" as ElectionType,
          positionSought: "Senator",
          jurisdiction: "National",
          result: "lost" as ElectionResult,
          voteCount: 5000000,
          totalVotes: 50000000,
          votePercentage: { toNumber: () => 10 },
          rank: 20,
          ElectionOpponent: [],
          SourceAttribution: [],
        },
      ];

      vi.mocked(prisma.electionResultRecord.findMany).mockResolvedValue(mockRecords as never);

      const wins = await getElectionWins("pol-1");

      expect(wins).toHaveLength(1);
      expect(wins[0]!.result).toBe("won");
    });
  });

  describe("getElectionLosses", () => {
    it("should return only losing elections", async () => {
      const mockRecords = [
        {
          id: "election-1",
          politicianId: "pol-1",
          electionYear: 2022,
          electionType: "national" as ElectionType,
          positionSought: "Senator",
          jurisdiction: "National",
          result: "won" as ElectionResult,
          voteCount: 15000000,
          totalVotes: 50000000,
          votePercentage: { toNumber: () => 30 },
          rank: 5,
          ElectionOpponent: [],
          SourceAttribution: [],
        },
        {
          id: "election-2",
          politicianId: "pol-1",
          electionYear: 2016,
          electionType: "national" as ElectionType,
          positionSought: "Senator",
          jurisdiction: "National",
          result: "lost" as ElectionResult,
          voteCount: 5000000,
          totalVotes: 50000000,
          votePercentage: { toNumber: () => 10 },
          rank: 20,
          ElectionOpponent: [],
          SourceAttribution: [],
        },
      ];

      vi.mocked(prisma.electionResultRecord.findMany).mockResolvedValue(mockRecords as never);

      const losses = await getElectionLosses("pol-1");

      expect(losses).toHaveLength(1);
      expect(losses[0]!.result).toBe("lost");
    });
  });
});
