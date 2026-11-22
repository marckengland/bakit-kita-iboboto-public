/**
 * Unit Tests for Politician Service
 *
 * Tests the politician service implementation for:
 * - getPolitician: Fetching a single politician with all related data
 * - listPoliticians: Listing politicians with filters and pagination
 * - Source attribution for each field
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 12.6, 12.7**
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GovernmentLevel, SourceType, Prisma } from "@prisma/client";

// Public eligibility is a separate service boundary; these unit fixtures retain the existing public values.
vi.mock("./public-research.service", async (importOriginal) => {
  const original = await importOriginal<typeof import("./public-research.service")>();
  return {
    ...original,
    getPublicRedFlagsBatch: vi.fn(async (ids: readonly string[]) => {
      const last = vi.mocked(prisma.politician.findMany).mock.results.at(-1);
      const unique = vi.mocked(prisma.politician.findUnique).mock.results.at(-1);
      const rows =
        last?.type === "return"
          ? ((await last.value) ?? [])
          : unique?.type === "return"
            ? [await unique.value]
            : [];
      return new Map(
        ids.map((id) => [
          id,
          (rows.find((p) => p?.id === id) as unknown as { RedFlag: { id: string }[] })?.RedFlag ??
            [],
        ])
      );
    }),
  };
});
// Mock Prisma before importing the service
vi.mock("@/lib/prisma", () => ({
  default: {
    politician: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    sourceAttribution: {
      findMany: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import {
  getPolitician,
  listPoliticians,
  politicianExists,
  getFieldSources,
} from "./politician.service";

// Helper to create mock source attribution
function createMockSourceAttribution(fieldName: string, overrides = {}) {
  return {
    id: "source-1",
    sourceType: SourceType.official_government,
    sourceName: "COMELEC",
    sourceUrl: "https://comelec.gov.ph",
    documentDate: new Date("2022-01-01"),
    retrievedAt: new Date("2024-01-01"),
    confidence: new Prisma.Decimal("0.95"),
    isAIProcessed: false,
    originalDocumentId: null,
    fieldName,
    createdAt: new Date(),
    politicianId: null,
    billId: null,
    positionId: null,
    partyAffiliationId: null,
    votingRecordId: null,
    sessionAttendanceId: null,
    salnRecordId: null,
    electionResultRecordId: null,
    controversyId: null,
    campaignFinanceId: null,
    projectId: null,
    campaignPromiseId: null,
    familyRelationshipId: null,
    redFlagId: null,
    educationId: null,
    caseEventId: null,
    evidenceLocator: null,
    reviewState: "pending" as const,
    reviewedBy: null,
    reviewedAt: null,
    ...overrides,
  };
}

// Helper to create mock politician data
function createMockPolitician(overrides = {}) {
  return {
    id: "pol-1",
    fullName: "Juan Dela Cruz",
    firstName: "Juan",
    middleName: "Santos",
    lastName: "Dela Cruz",
    suffix: null,
    nickname: null,
    legalName: null,
    birthday: new Date("1970-01-15"),
    birthplace: "Manila, Philippines",
    photo: "https://example.com/photo.jpg",
    isActive: true,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    Position: [],
    PartyAffiliation: [],
    RedFlag: [],
    SourceAttribution: [],
    ...overrides,
  };
}

describe("Politician Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getPolitician", () => {
    /**
     * **Validates: Requirements 2.1**
     * Display profile page with personal information
     */
    it("should return politician profile with personal information", async () => {
      const mockPolitician = createMockPolitician({
        SourceAttribution: [
          createMockSourceAttribution("fullName"),
          createMockSourceAttribution("birthday"),
        ],
      });

      vi.mocked(prisma.politician.findUnique).mockResolvedValue(mockPolitician);

      const result = await getPolitician("pol-1");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("pol-1");
      expect(result?.fullName).toBe("Juan Dela Cruz");
      expect(result?.firstName).toBe("Juan");
      expect(result?.lastName).toBe("Dela Cruz");
      expect(result?.birthday).toEqual(new Date("1970-01-15"));
      expect(result?.birthplace).toBe("Manila, Philippines");
    });

    /**
     * **Validates: Requirements 2.2, 2.3**
     * Show positions currently held and previously held with dates
     * Display positions in chronological order
     */
    it("should return positions sorted by date with current position identified", async () => {
      const mockPolitician = createMockPolitician({
        Position: [
          {
            id: "pos-1",
            politicianId: "pol-1",
            title: "Senator",
            level: GovernmentLevel.national,
            jurisdiction: "Philippines",
            startDate: new Date("2022-06-30"),
            endDate: null,
            termNumber: 1,
            isConsecutive: true,
            isCurrent: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            SourceAttribution: [createMockSourceAttribution("position")],
          },
          {
            id: "pos-2",
            politicianId: "pol-1",
            title: "Congressman",
            level: GovernmentLevel.national,
            jurisdiction: "District 1, Manila",
            startDate: new Date("2016-06-30"),
            endDate: new Date("2022-06-29"),
            termNumber: 2,
            isConsecutive: true,
            isCurrent: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            SourceAttribution: [],
          },
        ],
      });

      vi.mocked(prisma.politician.findUnique).mockResolvedValue(mockPolitician);

      const result = await getPolitician("pol-1");

      expect(result?.positions).toHaveLength(2);
      expect(result?.currentPosition?.title).toBe("Senator");
      expect(result?.currentPosition?.isCurrent).toBe(true);
      expect(result!.positions[0]!.title).toBe("Senator");
      expect(result!.positions[1]!.title).toBe("Congressman");
    });

    /**
     * **Validates: Requirements 2.4**
     * Display current and past party affiliations with dates
     */
    it("should return party affiliations with current party identified", async () => {
      const mockPolitician = createMockPolitician({
        PartyAffiliation: [
          {
            id: "aff-1",
            politicianId: "pol-1",
            partyId: "party-1",
            startDate: new Date("2020-01-01"),
            endDate: null,
            isCurrent: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            PoliticalParty: {
              id: "party-1",
              name: "Partido ng Bayan",
              abbreviation: "PNB",
              foundedDate: null,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            SourceAttribution: [createMockSourceAttribution("partyAffiliation")],
          },
        ],
      });

      vi.mocked(prisma.politician.findUnique).mockResolvedValue(mockPolitician);

      const result = await getPolitician("pol-1");

      expect(result?.partyAffiliations).toHaveLength(1);
      expect(result?.currentParty?.party.name).toBe("Partido ng Bayan");
      expect(result?.currentParty?.party.abbreviation).toBe("PNB");
      expect(result?.currentParty?.isCurrent).toBe(true);
    });

    /**
     * **Validates: Requirements 12.6, 12.7**
     * Show source attribution for each data field
     */
    it("should include source attribution for each field", async () => {
      const mockPolitician = createMockPolitician({
        SourceAttribution: [
          createMockSourceAttribution("fullName", {
            sourceName: "COMELEC Certificate of Candidacy 2022",
          }),
          createMockSourceAttribution("birthday", {
            sourceName: "COMELEC Certificate of Candidacy 2022",
          }),
          createMockSourceAttribution("birthplace", {
            sourceName: "Senate Official Records",
          }),
        ],
      });

      vi.mocked(prisma.politician.findUnique).mockResolvedValue(mockPolitician);

      const result = await getPolitician("pol-1");

      expect(result?.sources).toBeDefined();
      expect(result!.sources["fullName"]!).toHaveLength(1);
      expect(result!.sources["fullName"]![0]!.sourceName).toBe(
        "COMELEC Certificate of Candidacy 2022"
      );
      expect(result!.sources["birthday"]!).toHaveLength(1);
      expect(result!.sources["birthplace"]!).toHaveLength(1);
    });

    it("should return null for non-existent politician", async () => {
      vi.mocked(prisma.politician.findUnique).mockResolvedValue(null);

      const result = await getPolitician("non-existent");

      expect(result).toBeNull();
    });

    it("should indicate if politician has red flags", async () => {
      const mockPolitician = createMockPolitician({
        RedFlag: [{ id: "rf-1" }, { id: "rf-2" }],
      });

      vi.mocked(prisma.politician.findUnique).mockResolvedValue(mockPolitician);

      const result = await getPolitician("pol-1");

      expect(result?.hasRedFlags).toBe(true);
      expect(result?.redFlagCount).toBe(2);
    });
  });

  describe("listPoliticians", () => {
    /**
     * **Validates: Requirements 1.1**
     * Display paginated list of politicians with basic information
     */
    it("should return paginated list of politicians", async () => {
      const mockPoliticians = [
        createMockPolitician({
          id: "pol-1",
          fullName: "Ana Santos",
          Position: [
            {
              id: "pos-1",
              title: "Mayor",
              level: GovernmentLevel.city,
              jurisdiction: "Manila",
              isCurrent: true,
              startDate: new Date(),
            },
          ],
          PartyAffiliation: [
            {
              id: "aff-1",
              isCurrent: true,
              PoliticalParty: { id: "p-1", name: "Liberal Party", abbreviation: "LP" },
            },
          ],
          RedFlag: [],
        }),
        createMockPolitician({
          id: "pol-2",
          fullName: "Ben Cruz",
          Position: [],
          PartyAffiliation: [],
          RedFlag: [{ id: "rf-1" }],
        }),
      ];

      vi.mocked(prisma.politician.count).mockResolvedValue(2);
      vi.mocked(prisma.politician.findMany).mockResolvedValue(mockPoliticians);

      const result = await listPoliticians({}, { page: 1, pageSize: 10 });

      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.items[0]!.fullName).toBe("Ana Santos");
      expect(result.items[0]!.currentPosition?.title).toBe("Mayor");
      expect(result.items[0]!.currentParty?.name).toBe("Liberal Party");
      expect(result.items[0]!.hasRedFlags).toBe(false);
      expect(result.items[1]!.hasRedFlags).toBe(true);
    });

    /**
     * **Validates: Requirements 1.2**
     * Filter by government level
     */
    it("should filter politicians by government level", async () => {
      vi.mocked(prisma.politician.count).mockResolvedValue(0);
      vi.mocked(prisma.politician.findMany).mockResolvedValue([]);

      await listPoliticians({ level: GovernmentLevel.national });

      expect(prisma.politician.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              {
                Position: {
                  some: {
                    isCurrent: true,
                    level: GovernmentLevel.national,
                  },
                },
              },
            ],
          },
        })
      );
    });

    /**
     * **Validates: Requirements 1.3**
     * Filter by region/location
     */
    it("should filter politicians by region", async () => {
      vi.mocked(prisma.politician.count).mockResolvedValue(0);
      vi.mocked(prisma.politician.findMany).mockResolvedValue([]);

      await listPoliticians({ region: "NCR" });

      expect(prisma.politician.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              {
                Position: {
                  some: {
                    isCurrent: true,
                    jurisdiction: {
                      contains: "NCR",
                      mode: "insensitive",
                    },
                  },
                },
              },
            ],
          },
        })
      );
    });

    /**
     * **Validates: Requirements 1.4**
     * Filter by political party
     */
    it("should filter politicians by political party", async () => {
      vi.mocked(prisma.politician.count).mockResolvedValue(0);
      vi.mocked(prisma.politician.findMany).mockResolvedValue([]);

      await listPoliticians({ party: "Liberal" });

      expect(prisma.politician.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              {
                PartyAffiliation: {
                  some: {
                    isCurrent: true,
                    PoliticalParty: {
                      OR: [
                        { name: { contains: "Liberal", mode: "insensitive" } },
                        { abbreviation: { contains: "Liberal", mode: "insensitive" } },
                      ],
                    },
                  },
                },
              },
            ],
          },
        })
      );
    });

    /**
     * **Validates: Requirements 1.5**
     * Filter by position type
     */
    it("should filter politicians by position type", async () => {
      vi.mocked(prisma.politician.count).mockResolvedValue(0);
      vi.mocked(prisma.politician.findMany).mockResolvedValue([]);

      await listPoliticians({ position: "Senator" });

      expect(prisma.politician.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              {
                Position: {
                  some: {
                    isCurrent: true,
                    title: {
                      equals: "Senator",
                      mode: "insensitive",
                    },
                  },
                },
              },
            ],
          },
        })
      );
    });

    it.each(["Mayor", "Vice Mayor", "President", "Vice President", "Senate President"])(
      "should request an exact case-insensitive current-position match for %s",
      async (requestedTitle) => {
        vi.mocked(prisma.politician.findMany).mockResolvedValue([]);

        await listPoliticians({ position: requestedTitle });

        expect(prisma.politician.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              AND: [
                {
                  Position: {
                    some: {
                      isCurrent: true,
                      title: { equals: requestedTitle, mode: "insensitive" },
                    },
                  },
                },
              ],
            },
          })
        );
      }
    );

    /**
     * **Validates: Requirements 1.6**
     * Support combining multiple filters simultaneously
     */
    it("should combine multiple filters with AND logic", async () => {
      vi.mocked(prisma.politician.count).mockResolvedValue(0);
      vi.mocked(prisma.politician.findMany).mockResolvedValue([]);

      await listPoliticians({
        level: GovernmentLevel.national,
        party: "Liberal",
        position: "Senator",
      });

      const callArgs = vi.mocked(prisma.politician.findMany).mock.calls[0]![0];
      expect(callArgs?.where?.AND).toHaveLength(3);
    });

    it("should filter by hasRedFlags = true", async () => {
      vi.mocked(prisma.politician.count).mockResolvedValue(0);
      vi.mocked(prisma.politician.findMany).mockResolvedValue([]);

      const result = await listPoliticians({ hasRedFlags: true });
      expect(result.items).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(prisma.politician.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.politician.findMany).toHaveBeenCalledWith({ where: {}, select: { id: true } });
    });

    it("should filter by hasRedFlags = false", async () => {
      vi.mocked(prisma.politician.count).mockResolvedValue(0);
      vi.mocked(prisma.politician.findMany).mockResolvedValue([]);

      const result = await listPoliticians({ hasRedFlags: false });
      expect(result.items).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(prisma.politician.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { notIn: [] } } })
      );
    });

    it("should return empty result for empty database", async () => {
      vi.mocked(prisma.politician.count).mockResolvedValue(0);
      vi.mocked(prisma.politician.findMany).mockResolvedValue([]);

      const result = await listPoliticians();

      expect(result.items).toHaveLength(0);
      expect(result.totalCount).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it("should use default pagination when not specified", async () => {
      vi.mocked(prisma.politician.count).mockResolvedValue(0);
      vi.mocked(prisma.politician.findMany).mockResolvedValue([]);

      const result = await listPoliticians();

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });
  });

  describe("politicianExists", () => {
    it("should return true when politician exists", async () => {
      vi.mocked(prisma.politician.count).mockResolvedValue(1);

      const result = await politicianExists("pol-1");

      expect(result).toBe(true);
    });

    it("should return false when politician does not exist", async () => {
      vi.mocked(prisma.politician.count).mockResolvedValue(0);

      const result = await politicianExists("non-existent");

      expect(result).toBe(false);
    });
  });

  describe("getFieldSources", () => {
    /**
     * **Validates: Requirements 12.6, 12.7**
     * Get source attributions for a specific field
     */
    it("should return source attributions for a specific field", async () => {
      const mockSources = [
        createMockSourceAttribution("fullName", {
          sourceName: "COMELEC COC 2022",
        }),
        createMockSourceAttribution("fullName", {
          sourceName: "Senate Records",
          retrievedAt: new Date("2023-06-01"),
        }),
      ];

      vi.mocked(prisma.sourceAttribution.findMany).mockResolvedValue(mockSources);

      const result = await getFieldSources("pol-1", "fullName");

      expect(result).toHaveLength(2);
      expect(result[0]!.sourceName).toBe("COMELEC COC 2022");
      expect(prisma.sourceAttribution.findMany).toHaveBeenCalledWith({
        where: {
          politicianId: "pol-1",
          fieldName: "fullName",
        },
        orderBy: { retrievedAt: "desc" },
      });
    });

    it("should return empty array when no sources exist", async () => {
      vi.mocked(prisma.sourceAttribution.findMany).mockResolvedValue([]);

      const result = await getFieldSources("pol-1", "nonExistentField");

      expect(result).toHaveLength(0);
    });
  });
});
