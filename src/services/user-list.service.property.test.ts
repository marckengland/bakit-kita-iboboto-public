/**
 * Property-Based Tests for User List Service
 *
 * **Property 7: User List Management Round-Trip**
 * *For any* user list operation (bookmark or voting list):
 * - Adding an item and then retrieving the list must include that item
 * - Removing an item and then retrieving the list must not include that item
 * - Adding the same item twice must fail with appropriate error
 * - List organization by position level must be consistent
 *
 * **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 17.1, 17.2, 17.3**
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
    politician: {
      findUnique: vi.fn(),
    },
    bookmark: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    votingList: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    votingListItem: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import {
  validateElectionYear,
  getPositionLevel,
  organizeByLevel,
  MIN_ELECTION_YEAR,
  MAX_ELECTION_YEAR,
  POSITION_LEVELS,
  VotingListItem,
} from "./user-list.service";

const NUM_RUNS = 100;

// ============================================
// Arbitraries for Property-Based Testing
// ============================================

const arbitraryPoliticianId = (): fc.Arbitrary<string> => fc.uuid().map((id) => `pol-${id}`);

const arbitraryValidElectionYear = (): fc.Arbitrary<number> =>
  fc.integer({ min: MIN_ELECTION_YEAR, max: MAX_ELECTION_YEAR });

const arbitraryInvalidElectionYear = (): fc.Arbitrary<number> =>
  fc.oneof(
    fc.integer({ min: -1000, max: MIN_ELECTION_YEAR - 1 }),
    fc.integer({ min: MAX_ELECTION_YEAR + 1, max: 5000 }),
    fc.double({ min: MIN_ELECTION_YEAR, max: MAX_ELECTION_YEAR, noInteger: true })
  );

const arbitraryPosition = (): fc.Arbitrary<string> =>
  fc.constantFrom(
    "President",
    "Vice President",
    "Senator",
    "Congressman",
    "Governor",
    "Vice Governor",
    "Mayor",
    "Vice Mayor",
    "Councilor",
    "Barangay Captain",
    "Barangay Kagawad"
  );

const arbitraryVotingListItem = (): fc.Arbitrary<VotingListItem> =>
  fc.record({
    id: fc.uuid(),
    votingListId: fc.uuid(),
    politicianId: arbitraryPoliticianId(),
    position: arbitraryPosition(),
    addedAt: fc.date(),
  });

// ============================================
// Property Tests
// ============================================

describe("User List Management Round-Trip - Property 7", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Validates: Requirement 10.1, 17.1**
   * Election year validation must be consistent
   */
  describe("Property 7.1: Election Year Validation", () => {
    it("should accept all years in valid range", () => {
      fc.assert(
        fc.property(arbitraryValidElectionYear(), (year) => {
          expect(validateElectionYear(year)).toBe(true);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should reject all years outside valid range", () => {
      fc.assert(
        fc.property(arbitraryInvalidElectionYear(), (year) => {
          expect(validateElectionYear(year)).toBe(false);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should have consistent boundary behavior", () => {
      // Boundary values should be deterministic
      expect(validateElectionYear(MIN_ELECTION_YEAR)).toBe(true);
      expect(validateElectionYear(MAX_ELECTION_YEAR)).toBe(true);
      expect(validateElectionYear(MIN_ELECTION_YEAR - 1)).toBe(false);
      expect(validateElectionYear(MAX_ELECTION_YEAR + 1)).toBe(false);
    });
  });

  /**
   * **Validates: Requirement 17.3**
   * Position level mapping must be consistent
   */
  describe("Property 7.2: Position Level Consistency", () => {
    it("should return consistent level for same position", () => {
      fc.assert(
        fc.property(arbitraryPosition(), (position) => {
          const level1 = getPositionLevel(position);
          const level2 = getPositionLevel(position);
          expect(level1).toBe(level2);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should be case-insensitive", () => {
      fc.assert(
        fc.property(arbitraryPosition(), (position) => {
          const upperLevel = getPositionLevel(position.toUpperCase());
          const lowerLevel = getPositionLevel(position.toLowerCase());
          const mixedLevel = getPositionLevel(position);

          expect(upperLevel).toBe(lowerLevel);
          expect(lowerLevel).toBe(mixedLevel);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should map all known positions to valid levels", () => {
      const validLevels = [
        "national",
        "regional",
        "provincial",
        "city",
        "municipal",
        "barangay",
        "other",
      ];

      fc.assert(
        fc.property(arbitraryPosition(), (position) => {
          const level = getPositionLevel(position);
          expect(validLevels).toContain(level);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should correctly categorize all defined positions", () => {
      for (const [position, expectedLevel] of Object.entries(POSITION_LEVELS)) {
        const actualLevel = getPositionLevel(position);
        expect(actualLevel).toBe(expectedLevel);
      }
    });
  });

  /**
   * **Validates: Requirement 17.3**
   * List organization must preserve all items
   */
  describe("Property 7.3: List Organization Completeness", () => {
    it("should preserve all items when organizing by level", () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryVotingListItem(), { minLength: 0, maxLength: 50 }),
          (items) => {
            const organized = organizeByLevel(items);

            // Count total items in organized structure
            const totalOrganized =
              organized.national.length +
              organized.regional.length +
              organized.provincial.length +
              organized.city.length +
              organized.municipal.length +
              organized.barangay.length;

            expect(totalOrganized).toBe(items.length);
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should not duplicate items when organizing", () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryVotingListItem(), { minLength: 1, maxLength: 30 }),
          (items) => {
            const organized = organizeByLevel(items);

            // Collect all IDs from organized structure
            const allIds = [
              ...organized.national.map((i) => i.id),
              ...organized.regional.map((i) => i.id),
              ...organized.provincial.map((i) => i.id),
              ...organized.city.map((i) => i.id),
              ...organized.municipal.map((i) => i.id),
              ...organized.barangay.map((i) => i.id),
            ];

            // Check for duplicates
            const uniqueIds = new Set(allIds);
            expect(uniqueIds.size).toBe(allIds.length);
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should place items in correct level based on position", () => {
      fc.assert(
        fc.property(arbitraryVotingListItem(), (item) => {
          const organized = organizeByLevel([item]);
          const expectedLevel = getPositionLevel(item.position);

          // Find which level contains the item
          let foundLevel: string | null = null;
          for (const [level, items] of Object.entries(organized)) {
            if (items.some((i: VotingListItem) => i.id === item.id)) {
              foundLevel = level;
              break;
            }
          }

          // Item should be in expected level (or municipal for "other")
          if (expectedLevel === "other") {
            expect(foundLevel).toBe("municipal");
          } else {
            expect(foundLevel).toBe(expectedLevel);
          }
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirement 10.2, 10.3**
   * Add/remove operations must be idempotent in effect
   */
  describe("Property 7.4: Operation Idempotency", () => {
    it("should reject duplicate bookmark additions", async () => {
      // Setup: user and politician exist, bookmark already exists
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1" } as any);
      vi.mocked(prisma.politician.findUnique).mockResolvedValue({ id: "pol-1" } as any);
      vi.mocked(prisma.bookmark.findUnique).mockResolvedValue({ id: "existing" } as any);

      const { addBookmark } = await import("./user-list.service");

      await expect(addBookmark({ userId: "user-1", politicianId: "pol-1" })).rejects.toThrow(
        "Already bookmarked"
      );
    });

    it("should reject duplicate voting list additions", async () => {
      // Setup: politician exists, voting list exists, item already in list
      vi.mocked(prisma.politician.findUnique).mockResolvedValue({ id: "pol-1" } as any);
      vi.mocked(prisma.votingList.findUnique).mockResolvedValue({
        id: "vl-1",
        VotingListItem: [],
      } as any);
      vi.mocked(prisma.votingListItem.findUnique).mockResolvedValue({ id: "existing" } as any);

      const { addToVotingList } = await import("./user-list.service");

      await expect(
        addToVotingList({
          userId: "user-1",
          electionYear: 2025,
          politicianId: "pol-1",
          position: "Senator",
        })
      ).rejects.toThrow("Already in voting list");
    });
  });

  /**
   * **Validates: Requirement 10.4, 17.2**
   * Remove operations must fail gracefully for non-existent items
   */
  describe("Property 7.5: Remove Non-Existent Items", () => {
    it("should fail when removing non-existent bookmark", async () => {
      vi.mocked(prisma.bookmark.findUnique).mockResolvedValue(null);

      const { removeBookmark } = await import("./user-list.service");

      await expect(removeBookmark({ userId: "user-1", politicianId: "pol-1" })).rejects.toThrow(
        "Bookmark not found"
      );
    });

    it("should fail when removing from non-existent voting list", async () => {
      vi.mocked(prisma.votingList.findUnique).mockResolvedValue(null);

      const { removeFromVotingList } = await import("./user-list.service");

      await expect(
        removeFromVotingList({ userId: "user-1", electionYear: 2025, politicianId: "pol-1" })
      ).rejects.toThrow("Not in voting list");
    });
  });

  /**
   * **Validates: Requirement 17.1**
   * Voting list queries must validate election year
   */
  describe("Property 7.6: Election Year Validation in Operations", () => {
    it("should reject invalid election years in add operation", async () => {
      const invalidYears = [1900, 1985, 2101, 3000];

      for (const year of invalidYears) {
        const { addToVotingList } = await import("./user-list.service");

        await expect(
          addToVotingList({
            userId: "user-1",
            electionYear: year,
            politicianId: "pol-1",
            position: "Senator",
          })
        ).rejects.toThrow("Invalid election year");
      }
    });

    it("should reject invalid election years in remove operation", async () => {
      const invalidYears = [1900, 1985, 2101, 3000];

      for (const year of invalidYears) {
        const { removeFromVotingList } = await import("./user-list.service");

        await expect(
          removeFromVotingList({ userId: "user-1", electionYear: year, politicianId: "pol-1" })
        ).rejects.toThrow("Invalid election year");
      }
    });
  });
});
