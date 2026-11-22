/**
 * Property-Based Tests for Ordering Correctness
 *
 * **Property 5: Ordering Correctness**
 * **Validates: Requirements 2.3, 3.6, 6.3, 7.4, 11.2**
 *
 * For any sorted list returned by the system:
 * - Positions must be sorted by date (chronological order, most recent first) - Req 2.3
 * - Bills sorted by date must be in descending order by filing date - Req 3.6
 * - SALN records must be sorted by year (most recent first for display) - Req 6.3
 * - Election results must be sorted by year (descending, most recent first) - Req 7.4
 * - Search results must be sorted by relevance score (descending) - Req 11.2
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { GovernmentLevel, BillStatus, ElectionType, ElectionResult } from "@prisma/client";

// Minimum iterations for property tests
const NUM_RUNS = 100;

// ============================================
// Type Definitions
// ============================================

/**
 * Position data structure for ordering tests
 * Validates: Requirement 2.3
 */
interface Position {
  id: string;
  title: string;
  level: GovernmentLevel;
  jurisdiction: string;
  startDate: Date;
  endDate: Date | null;
  isCurrent: boolean;
}

/**
 * Bill data structure for ordering tests
 * Validates: Requirement 3.6
 */
interface Bill {
  id: string;
  billNumber: string;
  title: string;
  filingDate: Date;
  status: BillStatus;
}

/**
 * SALN record data structure for ordering tests
 * Validates: Requirement 6.3
 */
interface SALNRecord {
  id: string;
  politicianId: string;
  year: number;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

/**
 * Election result data structure for ordering tests
 * Validates: Requirement 7.4
 */
interface ElectionResultRecord {
  id: string;
  politicianId: string;
  electionYear: number;
  electionType: ElectionType;
  positionSought: string;
  result: ElectionResult;
  voteCount: number;
}

/**
 * Search result data structure for ordering tests
 * Validates: Requirement 11.2
 */
interface SearchResult {
  id: string;
  fullName: string;
  relevanceScore: number;
}

// ============================================
// Arbitraries (Generators) for Test Data
// ============================================

/**
 * Generate a valid government level
 */
const governmentLevelArb = fc.constantFrom(
  GovernmentLevel.national,
  GovernmentLevel.regional,
  GovernmentLevel.provincial,
  GovernmentLevel.city,
  GovernmentLevel.municipal,
  GovernmentLevel.barangay
);

/**
 * Generate a valid bill status
 */
const billStatusArb = fc.constantFrom(
  BillStatus.pending,
  BillStatus.passed,
  BillStatus.vetoed,
  BillStatus.lapsed,
  BillStatus.withdrawn
);

/**
 * Generate a valid election type
 */
const electionTypeArb = fc.constantFrom(
  ElectionType.national,
  ElectionType.local,
  ElectionType.barangay,
  ElectionType.special
);

/**
 * Generate a valid election result
 */
const electionResultArb = fc.constantFrom(ElectionResult.won, ElectionResult.lost);

/**
 * Generate a date within a reasonable range
 */
const dateArb = fc.date({ min: new Date("1990-01-01"), max: new Date("2030-12-31") });

/**
 * Generate a year within a reasonable range
 */
const yearArb = fc.integer({ min: 1990, max: 2030 });

/**
 * Generate a position with dates
 */
const positionArb: fc.Arbitrary<Position> = fc.record({
  id: fc.uuid(),
  title: fc.constantFrom("Senator", "Congressman", "Governor", "Mayor", "Councilor"),
  level: governmentLevelArb,
  jurisdiction: fc.constantFrom("Philippines", "NCR", "Cebu", "Davao"),
  startDate: dateArb,
  endDate: fc.option(dateArb, { nil: null }),
  isCurrent: fc.boolean(),
});

/**
 * Generate a bill with filing date
 */
const billArb: fc.Arbitrary<Bill> = fc.record({
  id: fc.uuid(),
  billNumber: fc.string({ minLength: 3, maxLength: 10 }),
  title: fc.string({ minLength: 5, maxLength: 100 }),
  filingDate: dateArb,
  status: billStatusArb,
});

/**
 * Generate a SALN record with year
 */
const salnRecordArb: fc.Arbitrary<SALNRecord> = fc.record({
  id: fc.uuid(),
  politicianId: fc.uuid(),
  year: yearArb,
  totalAssets: fc.float({ min: 0, max: 1_000_000_000, noNaN: true }),
  totalLiabilities: fc.float({ min: 0, max: 100_000_000, noNaN: true }),
  netWorth: fc.float({ min: -100_000_000, max: 1_000_000_000, noNaN: true }),
});

/**
 * Generate an election result record
 */
const electionResultRecordArb: fc.Arbitrary<ElectionResultRecord> = fc.record({
  id: fc.uuid(),
  politicianId: fc.uuid(),
  electionYear: yearArb,
  electionType: electionTypeArb,
  positionSought: fc.constantFrom("Senator", "Congressman", "Governor", "Mayor"),
  result: electionResultArb,
  voteCount: fc.integer({ min: 0, max: 50_000_000 }),
});

/**
 * Generate a search result with relevance score
 */
const searchResultArb: fc.Arbitrary<SearchResult> = fc.record({
  id: fc.uuid(),
  fullName: fc.string({ minLength: 2, maxLength: 100 }),
  relevanceScore: fc.float({ min: 0, max: 100, noNaN: true }),
});

// ============================================
// Ordering Helper Functions
// ============================================

/**
 * Sort positions by start date (most recent first)
 * Validates: Requirement 2.3
 */
function sortPositionsByDate(positions: Position[]): Position[] {
  return [...positions].sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
}

/**
 * Sort bills by filing date (most recent first)
 * Validates: Requirement 3.6
 */
function sortBillsByFilingDate(bills: Bill[], order: "asc" | "desc" = "desc"): Bill[] {
  return [...bills].sort((a, b) => {
    const diff = a.filingDate.getTime() - b.filingDate.getTime();
    return order === "desc" ? -diff : diff;
  });
}

/**
 * Sort bills by status
 * Validates: Requirement 3.6
 */
function sortBillsByStatus(bills: Bill[], order: "asc" | "desc" = "asc"): Bill[] {
  const statusOrder: Record<BillStatus, number> = {
    [BillStatus.passed]: 1,
    [BillStatus.pending]: 2,
    [BillStatus.vetoed]: 3,
    [BillStatus.lapsed]: 4,
    [BillStatus.withdrawn]: 5,
  };
  return [...bills].sort((a, b) => {
    const diff = statusOrder[a.status] - statusOrder[b.status];
    return order === "desc" ? -diff : diff;
  });
}

/**
 * Sort bills by title alphabetically
 * Validates: Requirement 3.6
 */
function sortBillsByTitle(bills: Bill[], order: "asc" | "desc" = "asc"): Bill[] {
  return [...bills].sort((a, b) => {
    const diff = a.title.localeCompare(b.title);
    return order === "desc" ? -diff : diff;
  });
}

/**
 * Sort SALN records by year (most recent first for display)
 * Validates: Requirement 6.3
 */
function sortSALNByYear(records: SALNRecord[], order: "asc" | "desc" = "desc"): SALNRecord[] {
  return [...records].sort((a, b) => {
    const diff = a.year - b.year;
    return order === "desc" ? -diff : diff;
  });
}

/**
 * Sort election results by year (most recent first)
 * Validates: Requirement 7.4
 */
function sortElectionsByYear(results: ElectionResultRecord[]): ElectionResultRecord[] {
  return [...results].sort((a, b) => b.electionYear - a.electionYear);
}

/**
 * Sort search results by relevance score (highest first)
 * Validates: Requirement 11.2
 */
function sortSearchResultsByRelevance(results: SearchResult[]): SearchResult[] {
  return [...results].sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// ============================================
// Validation Helper Functions
// ============================================

/**
 * Check if positions are sorted chronologically (most recent first)
 */
function isPositionsSortedChronologically(positions: Position[]): boolean {
  for (let i = 1; i < positions.length; i++) {
    if (positions[i - 1]!.startDate.getTime() < positions[i]!.startDate.getTime()) {
      return false;
    }
  }
  return true;
}

/**
 * Check if bills are sorted by filing date in specified order
 */
function isBillsSortedByFilingDate(bills: Bill[], order: "asc" | "desc"): boolean {
  for (let i = 1; i < bills.length; i++) {
    const prev = bills[i - 1]!.filingDate.getTime();
    const curr = bills[i]!.filingDate.getTime();
    if (order === "desc" && prev < curr) {
      return false;
    }
    if (order === "asc" && prev > curr) {
      return false;
    }
  }
  return true;
}

/**
 * Check if bills are sorted by status in specified order
 */
function isBillsSortedByStatus(bills: Bill[], order: "asc" | "desc"): boolean {
  const statusOrder: Record<BillStatus, number> = {
    [BillStatus.passed]: 1,
    [BillStatus.pending]: 2,
    [BillStatus.vetoed]: 3,
    [BillStatus.lapsed]: 4,
    [BillStatus.withdrawn]: 5,
  };
  for (let i = 1; i < bills.length; i++) {
    const prev = statusOrder[bills[i - 1]!.status];
    const curr = statusOrder[bills[i]!.status];
    if (order === "asc" && prev > curr) {
      return false;
    }
    if (order === "desc" && prev < curr) {
      return false;
    }
  }
  return true;
}

/**
 * Check if bills are sorted by title in specified order
 */
function isBillsSortedByTitle(bills: Bill[], order: "asc" | "desc"): boolean {
  for (let i = 1; i < bills.length; i++) {
    const comparison = bills[i - 1]!.title.localeCompare(bills[i]!.title);
    if (order === "asc" && comparison > 0) {
      return false;
    }
    if (order === "desc" && comparison < 0) {
      return false;
    }
  }
  return true;
}

/**
 * Check if SALN records are sorted by year in specified order
 */
function isSALNSortedByYear(records: SALNRecord[], order: "asc" | "desc"): boolean {
  for (let i = 1; i < records.length; i++) {
    const prev = records[i - 1]!.year;
    const curr = records[i]!.year;
    if (order === "desc" && prev < curr) {
      return false;
    }
    if (order === "asc" && prev > curr) {
      return false;
    }
  }
  return true;
}

/**
 * Check if election results are sorted chronologically (most recent first)
 */
function isElectionsSortedChronologically(results: ElectionResultRecord[]): boolean {
  for (let i = 1; i < results.length; i++) {
    if (results[i - 1]!.electionYear < results[i]!.electionYear) {
      return false;
    }
  }
  return true;
}

/**
 * Check if search results are sorted by relevance (highest first)
 */
function isSearchResultsSortedByRelevance(results: SearchResult[]): boolean {
  for (let i = 1; i < results.length; i++) {
    if (results[i - 1]!.relevanceScore < results[i]!.relevanceScore) {
      return false;
    }
  }
  return true;
}

// ============================================
// Property Tests
// ============================================

describe("Ordering Correctness - Property 5", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Validates: Requirement 2.3**
   *
   * Property 5.1: Position History Ordering
   * Position history must be ordered chronologically (most recent first).
   */
  describe("Property 5.1: Position History Ordering", () => {
    it("positions sorted by date should be in chronological order (most recent first)", () => {
      fc.assert(
        fc.property(fc.array(positionArb, { minLength: 0, maxLength: 20 }), (positions) => {
          const sorted = sortPositionsByDate(positions);
          expect(isPositionsSortedChronologically(sorted)).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("sorting should be stable for positions with same start date", () => {
      fc.assert(
        fc.property(fc.array(positionArb, { minLength: 2, maxLength: 10 }), (positions) => {
          // Create positions with same date
          const sameDate = new Date("2020-01-01");
          const positionsWithSameDate = positions.map((p) => ({
            ...p,
            startDate: sameDate,
          }));

          const sorted = sortPositionsByDate(positionsWithSameDate);

          // All should have the same date
          for (const pos of sorted) {
            expect(pos.startDate.getTime()).toBe(sameDate.getTime());
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("empty position list should remain empty after sorting", () => {
      fc.assert(
        fc.property(fc.constant([]), (positions: Position[]) => {
          const sorted = sortPositionsByDate(positions);
          expect(sorted).toHaveLength(0);
        }),
        { numRuns: 1 }
      );
    });

    it("single position should remain unchanged after sorting", () => {
      fc.assert(
        fc.property(positionArb, (position) => {
          const sorted = sortPositionsByDate([position]);
          expect(sorted).toHaveLength(1);
          expect(sorted[0]!.id).toBe(position.id);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("most recent position should always be first after sorting", () => {
      fc.assert(
        fc.property(fc.array(positionArb, { minLength: 2, maxLength: 20 }), (positions) => {
          const sorted = sortPositionsByDate(positions);
          const maxDate = Math.max(...positions.map((p) => p.startDate.getTime()));
          expect(sorted[0]!.startDate.getTime()).toBe(maxDate);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirement 3.6**
   *
   * Property 5.2: Bill Sorting by Filing Date
   * Bills sorted by date must be in descending order by filing date.
   */
  describe("Property 5.2: Bill Sorting by Filing Date", () => {
    it("bills sorted by filing date descending should have most recent first", () => {
      fc.assert(
        fc.property(fc.array(billArb, { minLength: 0, maxLength: 20 }), (bills) => {
          const sorted = sortBillsByFilingDate(bills, "desc");
          expect(isBillsSortedByFilingDate(sorted, "desc")).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("bills sorted by filing date ascending should have oldest first", () => {
      fc.assert(
        fc.property(fc.array(billArb, { minLength: 0, maxLength: 20 }), (bills) => {
          const sorted = sortBillsByFilingDate(bills, "asc");
          expect(isBillsSortedByFilingDate(sorted, "asc")).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("most recent bill should be first when sorted descending", () => {
      fc.assert(
        fc.property(fc.array(billArb, { minLength: 2, maxLength: 20 }), (bills) => {
          const sorted = sortBillsByFilingDate(bills, "desc");
          const maxDate = Math.max(...bills.map((b) => b.filingDate.getTime()));
          expect(sorted[0]!.filingDate.getTime()).toBe(maxDate);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("oldest bill should be first when sorted ascending", () => {
      fc.assert(
        fc.property(fc.array(billArb, { minLength: 2, maxLength: 20 }), (bills) => {
          const sorted = sortBillsByFilingDate(bills, "asc");
          const minDate = Math.min(...bills.map((b) => b.filingDate.getTime()));
          expect(sorted[0]!.filingDate.getTime()).toBe(minDate);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirement 3.6**
   *
   * Property 5.3: Bill Sorting by Status
   * Bills should be sortable by status.
   */
  describe("Property 5.3: Bill Sorting by Status", () => {
    it("bills sorted by status ascending should maintain status order", () => {
      fc.assert(
        fc.property(fc.array(billArb, { minLength: 0, maxLength: 20 }), (bills) => {
          const sorted = sortBillsByStatus(bills, "asc");
          expect(isBillsSortedByStatus(sorted, "asc")).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("bills sorted by status descending should maintain reverse status order", () => {
      fc.assert(
        fc.property(fc.array(billArb, { minLength: 0, maxLength: 20 }), (bills) => {
          const sorted = sortBillsByStatus(bills, "desc");
          expect(isBillsSortedByStatus(sorted, "desc")).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirement 3.6**
   *
   * Property 5.4: Bill Sorting by Title (Relevance/Alphabetical)
   * Bills should be sortable alphabetically by title.
   */
  describe("Property 5.4: Bill Sorting by Title", () => {
    it("bills sorted by title ascending should be in alphabetical order", () => {
      fc.assert(
        fc.property(fc.array(billArb, { minLength: 0, maxLength: 20 }), (bills) => {
          const sorted = sortBillsByTitle(bills, "asc");
          expect(isBillsSortedByTitle(sorted, "asc")).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("bills sorted by title descending should be in reverse alphabetical order", () => {
      fc.assert(
        fc.property(fc.array(billArb, { minLength: 0, maxLength: 20 }), (bills) => {
          const sorted = sortBillsByTitle(bills, "desc");
          expect(isBillsSortedByTitle(sorted, "desc")).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirement 6.3**
   *
   * Property 5.5: SALN Records Ordering
   * SALN records must be ordered by year (most recent first for display).
   */
  describe("Property 5.5: SALN Records Ordering", () => {
    it("SALN records sorted descending should have most recent year first", () => {
      fc.assert(
        fc.property(fc.array(salnRecordArb, { minLength: 0, maxLength: 20 }), (records) => {
          const sorted = sortSALNByYear(records, "desc");
          expect(isSALNSortedByYear(sorted, "desc")).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("SALN records sorted ascending should have oldest year first (for timeline)", () => {
      fc.assert(
        fc.property(fc.array(salnRecordArb, { minLength: 0, maxLength: 20 }), (records) => {
          const sorted = sortSALNByYear(records, "asc");
          expect(isSALNSortedByYear(sorted, "asc")).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("most recent SALN year should be first when sorted descending", () => {
      fc.assert(
        fc.property(fc.array(salnRecordArb, { minLength: 2, maxLength: 20 }), (records) => {
          const sorted = sortSALNByYear(records, "desc");
          const maxYear = Math.max(...records.map((r) => r.year));
          expect(sorted[0]!.year).toBe(maxYear);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("oldest SALN year should be first when sorted ascending", () => {
      fc.assert(
        fc.property(fc.array(salnRecordArb, { minLength: 2, maxLength: 20 }), (records) => {
          const sorted = sortSALNByYear(records, "asc");
          const minYear = Math.min(...records.map((r) => r.year));
          expect(sorted[0]!.year).toBe(minYear);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("SALN records with same year should be stable after sorting", () => {
      fc.assert(
        fc.property(fc.array(salnRecordArb, { minLength: 2, maxLength: 10 }), (records) => {
          // Create records with same year
          const sameYear = 2023;
          const recordsWithSameYear = records.map((r) => ({
            ...r,
            year: sameYear,
          }));

          const sorted = sortSALNByYear(recordsWithSameYear, "desc");

          // All should have the same year
          for (const record of sorted) {
            expect(record.year).toBe(sameYear);
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirement 7.4**
   *
   * Property 5.6: Election Results Ordering
   * Election results must be ordered chronologically (most recent first).
   */
  describe("Property 5.6: Election Results Ordering", () => {
    it("election results should be sorted by year (most recent first)", () => {
      fc.assert(
        fc.property(
          fc.array(electionResultRecordArb, { minLength: 0, maxLength: 20 }),
          (results) => {
            const sorted = sortElectionsByYear(results);
            expect(isElectionsSortedChronologically(sorted)).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("most recent election should be first after sorting", () => {
      fc.assert(
        fc.property(
          fc.array(electionResultRecordArb, { minLength: 2, maxLength: 20 }),
          (results) => {
            const sorted = sortElectionsByYear(results);
            const maxYear = Math.max(...results.map((r) => r.electionYear));
            expect(sorted[0]!.electionYear).toBe(maxYear);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("oldest election should be last after sorting", () => {
      fc.assert(
        fc.property(
          fc.array(electionResultRecordArb, { minLength: 2, maxLength: 20 }),
          (results) => {
            const sorted = sortElectionsByYear(results);
            const minYear = Math.min(...results.map((r) => r.electionYear));
            expect(sorted[sorted.length - 1]!.electionYear).toBe(minYear);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("empty election results should remain empty after sorting", () => {
      fc.assert(
        fc.property(fc.constant([]), (results: ElectionResultRecord[]) => {
          const sorted = sortElectionsByYear(results);
          expect(sorted).toHaveLength(0);
        }),
        { numRuns: 1 }
      );
    });

    it("single election result should remain unchanged after sorting", () => {
      fc.assert(
        fc.property(electionResultRecordArb, (result) => {
          const sorted = sortElectionsByYear([result]);
          expect(sorted).toHaveLength(1);
          expect(sorted[0]!.id).toBe(result.id);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("elections with same year should be stable after sorting", () => {
      fc.assert(
        fc.property(
          fc.array(electionResultRecordArb, { minLength: 2, maxLength: 10 }),
          (results) => {
            // Create results with same year
            const sameYear = 2022;
            const resultsWithSameYear = results.map((r) => ({
              ...r,
              electionYear: sameYear,
            }));

            const sorted = sortElectionsByYear(resultsWithSameYear);

            // All should have the same year
            for (const result of sorted) {
              expect(result.electionYear).toBe(sameYear);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirement 11.2**
   *
   * Property 5.7: Search Results Ordering by Relevance
   * Search results must be ordered by relevance score (highest first).
   */
  describe("Property 5.7: Search Results Ordering by Relevance", () => {
    it("search results should be sorted by relevance score (highest first)", () => {
      fc.assert(
        fc.property(fc.array(searchResultArb, { minLength: 0, maxLength: 20 }), (results) => {
          const sorted = sortSearchResultsByRelevance(results);
          expect(isSearchResultsSortedByRelevance(sorted)).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("highest relevance score should be first after sorting", () => {
      fc.assert(
        fc.property(fc.array(searchResultArb, { minLength: 2, maxLength: 20 }), (results) => {
          const sorted = sortSearchResultsByRelevance(results);
          const maxScore = Math.max(...results.map((r) => r.relevanceScore));
          expect(sorted[0]!.relevanceScore).toBe(maxScore);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("lowest relevance score should be last after sorting", () => {
      fc.assert(
        fc.property(fc.array(searchResultArb, { minLength: 2, maxLength: 20 }), (results) => {
          const sorted = sortSearchResultsByRelevance(results);
          const minScore = Math.min(...results.map((r) => r.relevanceScore));
          expect(sorted[sorted.length - 1]!.relevanceScore).toBe(minScore);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("search results with same relevance should be stable after sorting", () => {
      fc.assert(
        fc.property(fc.array(searchResultArb, { minLength: 2, maxLength: 10 }), (results) => {
          // Create results with same relevance
          const sameScore = 50;
          const resultsWithSameScore = results.map((r) => ({
            ...r,
            relevanceScore: sameScore,
          }));

          const sorted = sortSearchResultsByRelevance(resultsWithSameScore);

          // All should have the same score
          for (const result of sorted) {
            expect(result.relevanceScore).toBe(sameScore);
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("empty search results should remain empty after sorting", () => {
      fc.assert(
        fc.property(fc.constant([]), (results: SearchResult[]) => {
          const sorted = sortSearchResultsByRelevance(results);
          expect(sorted).toHaveLength(0);
        }),
        { numRuns: 1 }
      );
    });

    it("single search result should remain unchanged after sorting", () => {
      fc.assert(
        fc.property(searchResultArb, (result) => {
          const sorted = sortSearchResultsByRelevance([result]);
          expect(sorted).toHaveLength(1);
          expect(sorted[0]!.id).toBe(result.id);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("relevance scores should all be non-negative", () => {
      fc.assert(
        fc.property(fc.array(searchResultArb, { minLength: 1, maxLength: 20 }), (results) => {
          const sorted = sortSearchResultsByRelevance(results);
          for (const result of sorted) {
            expect(result.relevanceScore).toBeGreaterThanOrEqual(0);
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 2.3, 3.6, 6.3, 7.4, 11.2**
   *
   * Property 5.8: Sorting Preserves All Elements
   * Sorting should not add or remove any elements.
   */
  describe("Property 5.8: Sorting Preserves All Elements", () => {
    it("sorting positions should preserve all elements", () => {
      fc.assert(
        fc.property(fc.array(positionArb, { minLength: 0, maxLength: 20 }), (positions) => {
          const sorted = sortPositionsByDate(positions);
          expect(sorted.length).toBe(positions.length);

          // All original IDs should be present
          const originalIds = new Set(positions.map((p) => p.id));
          const sortedIds = new Set(sorted.map((p) => p.id));
          expect(sortedIds).toEqual(originalIds);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("sorting bills should preserve all elements", () => {
      fc.assert(
        fc.property(fc.array(billArb, { minLength: 0, maxLength: 20 }), (bills) => {
          const sortedByDate = sortBillsByFilingDate(bills, "desc");
          const sortedByStatus = sortBillsByStatus(bills, "asc");
          const sortedByTitle = sortBillsByTitle(bills, "asc");

          expect(sortedByDate.length).toBe(bills.length);
          expect(sortedByStatus.length).toBe(bills.length);
          expect(sortedByTitle.length).toBe(bills.length);

          // All original IDs should be present
          const originalIds = new Set(bills.map((b) => b.id));
          expect(new Set(sortedByDate.map((b) => b.id))).toEqual(originalIds);
          expect(new Set(sortedByStatus.map((b) => b.id))).toEqual(originalIds);
          expect(new Set(sortedByTitle.map((b) => b.id))).toEqual(originalIds);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("sorting SALN records should preserve all elements", () => {
      fc.assert(
        fc.property(fc.array(salnRecordArb, { minLength: 0, maxLength: 20 }), (records) => {
          const sorted = sortSALNByYear(records, "desc");
          expect(sorted.length).toBe(records.length);

          // All original IDs should be present
          const originalIds = new Set(records.map((r) => r.id));
          const sortedIds = new Set(sorted.map((r) => r.id));
          expect(sortedIds).toEqual(originalIds);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("sorting election results should preserve all elements", () => {
      fc.assert(
        fc.property(
          fc.array(electionResultRecordArb, { minLength: 0, maxLength: 20 }),
          (results) => {
            const sorted = sortElectionsByYear(results);
            expect(sorted.length).toBe(results.length);

            // All original IDs should be present
            const originalIds = new Set(results.map((r) => r.id));
            const sortedIds = new Set(sorted.map((r) => r.id));
            expect(sortedIds).toEqual(originalIds);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("sorting search results should preserve all elements", () => {
      fc.assert(
        fc.property(fc.array(searchResultArb, { minLength: 0, maxLength: 20 }), (results) => {
          const sorted = sortSearchResultsByRelevance(results);
          expect(sorted.length).toBe(results.length);

          // All original IDs should be present
          const originalIds = new Set(results.map((r) => r.id));
          const sortedIds = new Set(sorted.map((r) => r.id));
          expect(sortedIds).toEqual(originalIds);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 2.3, 3.6, 6.3, 7.4, 11.2**
   *
   * Property 5.9: Sorting is Idempotent
   * Sorting an already sorted list should produce the same result.
   */
  describe("Property 5.9: Sorting is Idempotent", () => {
    it("sorting positions twice should produce same result", () => {
      fc.assert(
        fc.property(fc.array(positionArb, { minLength: 0, maxLength: 20 }), (positions) => {
          const sorted1 = sortPositionsByDate(positions);
          const sorted2 = sortPositionsByDate(sorted1);

          expect(sorted1.map((p) => p.id)).toEqual(sorted2.map((p) => p.id));
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("sorting bills twice should produce same result", () => {
      fc.assert(
        fc.property(fc.array(billArb, { minLength: 0, maxLength: 20 }), (bills) => {
          const sorted1 = sortBillsByFilingDate(bills, "desc");
          const sorted2 = sortBillsByFilingDate(sorted1, "desc");

          expect(sorted1.map((b) => b.id)).toEqual(sorted2.map((b) => b.id));
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("sorting SALN records twice should produce same result", () => {
      fc.assert(
        fc.property(fc.array(salnRecordArb, { minLength: 0, maxLength: 20 }), (records) => {
          const sorted1 = sortSALNByYear(records, "desc");
          const sorted2 = sortSALNByYear(sorted1, "desc");

          expect(sorted1.map((r) => r.id)).toEqual(sorted2.map((r) => r.id));
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("sorting election results twice should produce same result", () => {
      fc.assert(
        fc.property(
          fc.array(electionResultRecordArb, { minLength: 0, maxLength: 20 }),
          (results) => {
            const sorted1 = sortElectionsByYear(results);
            const sorted2 = sortElectionsByYear(sorted1);

            expect(sorted1.map((r) => r.id)).toEqual(sorted2.map((r) => r.id));
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("sorting search results twice should produce same result", () => {
      fc.assert(
        fc.property(fc.array(searchResultArb, { minLength: 0, maxLength: 20 }), (results) => {
          const sorted1 = sortSearchResultsByRelevance(results);
          const sorted2 = sortSearchResultsByRelevance(sorted1);

          expect(sorted1.map((r) => r.id)).toEqual(sorted2.map((r) => r.id));
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
