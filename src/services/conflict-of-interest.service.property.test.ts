/**
 * Property-Based Tests for Conflict of Interest Detection Service
 *
 * **Property 14: Conflict of Interest Detection**
 * *For any* legislator with SALN-declared business interests:
 * - Bills authored in industries matching their business interests must be flagged as potential conflicts
 * - Committee assignments matching their business interests must be flagged
 * - Each conflict must include: business interest, related bill/committee, nature of conflict
 * - When no conflicts are detected, the response must indicate "no conflicts found"
 *
 * **Validates: Requirements 29.1, 29.2, 29.3, 29.4, 29.7**
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";
import { BillAuthorRole } from "@prisma/client";

// Mock Prisma before importing service
vi.mock("@/lib/prisma", () => ({
  default: {
    sALNRecord: {
      findMany: vi.fn(),
    },
    billAuthor: {
      findMany: vi.fn(),
    },
  },
}));

import {
  classifyIndustry,
  areIndustriesRelated,
  extractBusinessInterests,
  detectBillConflicts,
  detectCommitteeConflicts,
  generateConflictReport,
  INDUSTRY_KEYWORDS,
  BusinessInterest,
  CommitteeAssignment,
  ConflictDetectionResult,
} from "./conflict-of-interest.service";

const NUM_RUNS = 100;

// ============================================
// Arbitraries for Property-Based Testing
// ============================================

const industries = Object.keys(INDUSTRY_KEYWORDS);

const arbitraryIndustry = (): fc.Arbitrary<string> => fc.constantFrom(...industries, "other");

const arbitraryBusinessInterest = (): fc.Arbitrary<BusinessInterest> =>
  fc.record({
    id: fc.uuid(),
    description: fc.string({ minLength: 5, maxLength: 100 }),
    value: fc.float({ min: 100_000, max: 100_000_000, noNaN: true }),
    industry: arbitraryIndustry(),
    salnYear: fc.integer({ min: 2015, max: 2025 }),
  });

const arbitraryBillAuthorRole = (): fc.Arbitrary<BillAuthorRole> =>
  fc.constantFrom("principal_author", "co_author");

const arbitraryBill = (): fc.Arbitrary<{
  id: string;
  title: string;
  summary: string | null;
  role: BillAuthorRole;
}> =>
  fc.record({
    id: fc.uuid(),
    title: fc.string({ minLength: 10, maxLength: 200 }),
    summary: fc.option(fc.string({ minLength: 20, maxLength: 500 }), { nil: null }),
    role: arbitraryBillAuthorRole(),
  });

const arbitraryCommitteeAssignment = (): fc.Arbitrary<CommitteeAssignment> =>
  fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 5, maxLength: 100 }),
    role: fc.constantFrom("Chair", "Vice Chair", "Member", "Head"),
    industry: arbitraryIndustry(),
  });

const arbitraryInvestment = (): fc.Arbitrary<{
  id: string;
  description: string;
  value: { toNumber: () => number } | number;
  salnRecord: { year: number };
}> =>
  fc
    .record({
      id: fc.uuid(),
      description: fc.string({ minLength: 5, maxLength: 100 }),
      value: fc.float({ min: 100_000, max: 100_000_000, noNaN: true }),
      salnYear: fc.integer({ min: 2015, max: 2025 }),
    })
    .map((inv) => ({
      id: inv.id,
      description: inv.description,
      value: inv.value,
      salnRecord: { year: inv.salnYear },
    }));

// ============================================
// Property Tests
// ============================================

describe("Conflict of Interest Detection - Property Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Validates: Requirement 29.1**
   * Bills authored in industries matching business interests must be flagged
   */
  describe("Property 14.1: Bill Conflict Detection", () => {
    it("should flag bills in matching industries as conflicts", () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryBusinessInterest(), { minLength: 1, maxLength: 5 }),
          fc.array(arbitraryBill(), { minLength: 1, maxLength: 10 }),
          (businessInterests, bills) => {
            const conflicts = detectBillConflicts(businessInterests, bills);

            // All detected conflicts must have matching industries
            for (const conflict of conflicts) {
              const billIndustry = classifyIndustry(
                `${conflict.relatedEntity.name} ${conflict.relatedEntity.description}`
              );
              const interestIndustry = conflict.businessInterest.industry;

              expect(areIndustriesRelated(interestIndustry, billIndustry)).toBe(true);
            }

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should detect conflicts when bill industry matches business interest industry", () => {
      fc.assert(
        fc.property(
          arbitraryIndustry(),
          fc.float({ min: 100_000, max: 100_000_000, noNaN: true }),
          arbitraryBillAuthorRole(),
          (industry, value, role) => {
            // Skip "other" industry as it won't match keywords
            if (industry === "other") {
              return true;
            }

            // Get a keyword for this industry
            const keywords = INDUSTRY_KEYWORDS[industry];
            if (!keywords || keywords.length === 0) {
              return true;
            }

            const keyword = keywords[0];

            const businessInterests: BusinessInterest[] = [
              {
                id: "test-interest",
                description: `${keyword} company`,
                value,
                industry,
                salnYear: 2023,
              },
            ];

            const bills = [
              {
                id: "test-bill",
                title: `${keyword} regulation act`,
                summary: `A bill about ${keyword}`,
                role,
              },
            ];

            const conflicts = detectBillConflicts(businessInterests, bills);

            // Should detect at least one conflict
            expect(conflicts.length).toBeGreaterThanOrEqual(1);
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirement 29.2**
   * Committee assignments matching business interests must be flagged
   */
  describe("Property 14.2: Committee Conflict Detection", () => {
    it("should flag committee assignments in matching industries", () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryBusinessInterest(), { minLength: 1, maxLength: 5 }),
          fc.array(arbitraryCommitteeAssignment(), { minLength: 1, maxLength: 5 }),
          (businessInterests, committees) => {
            const conflicts = detectCommitteeConflicts(businessInterests, committees);

            // All detected conflicts must have matching industries
            for (const conflict of conflicts) {
              const interestIndustry = conflict.businessInterest.industry;
              const committee = committees.find((c) => c.id === conflict.relatedEntity.id);

              if (committee) {
                expect(areIndustriesRelated(interestIndustry, committee.industry)).toBe(true);
              }
            }

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should detect conflicts when committee industry matches business interest", () => {
      fc.assert(
        fc.property(
          arbitraryIndustry(),
          fc.float({ min: 100_000, max: 100_000_000, noNaN: true }),
          fc.constantFrom("Chair", "Vice Chair", "Member"),
          (industry, value, role) => {
            if (industry === "other") {
              return true;
            }

            const businessInterests: BusinessInterest[] = [
              {
                id: "test-interest",
                description: `${industry} business`,
                value,
                industry,
                salnYear: 2023,
              },
            ];

            const committees: CommitteeAssignment[] = [
              {
                id: "test-committee",
                name: `Committee on ${industry}`,
                role,
                industry,
              },
            ];

            const conflicts = detectCommitteeConflicts(businessInterests, committees);

            // Should detect at least one conflict
            expect(conflicts.length).toBeGreaterThanOrEqual(1);
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirement 29.3**
   * Each conflict must include: business interest, related bill/committee, nature of conflict
   */
  describe("Property 14.3: Conflict Structure Completeness", () => {
    it("should include all required fields in bill conflicts", () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryBusinessInterest(), { minLength: 1, maxLength: 3 }),
          fc.array(arbitraryBill(), { minLength: 1, maxLength: 5 }),
          (businessInterests, bills) => {
            const conflicts = detectBillConflicts(businessInterests, bills);

            for (const conflict of conflicts) {
              // Must have business interest
              expect(conflict.businessInterest).toBeDefined();
              expect(conflict.businessInterest.id).toBeDefined();
              expect(conflict.businessInterest.description).toBeDefined();
              expect(conflict.businessInterest.industry).toBeDefined();

              // Must have related entity (bill)
              expect(conflict.relatedEntity).toBeDefined();
              expect(conflict.relatedEntity.id).toBeDefined();
              expect(conflict.relatedEntity.name).toBeDefined();

              // Must have conflict nature
              expect(conflict.conflictNature).toBeDefined();
              expect(conflict.conflictNature.length).toBeGreaterThan(0);

              // Must have type and severity
              expect(conflict.type).toBe("bill_authorship");
              expect(["low", "medium", "high"]).toContain(conflict.severity);

              // Must have detection timestamp
              expect(conflict.detectedAt).toBeInstanceOf(Date);
            }

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should include all required fields in committee conflicts", () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryBusinessInterest(), { minLength: 1, maxLength: 3 }),
          fc.array(arbitraryCommitteeAssignment(), { minLength: 1, maxLength: 5 }),
          (businessInterests, committees) => {
            const conflicts = detectCommitteeConflicts(businessInterests, committees);

            for (const conflict of conflicts) {
              // Must have business interest
              expect(conflict.businessInterest).toBeDefined();
              expect(conflict.businessInterest.id).toBeDefined();

              // Must have related entity (committee)
              expect(conflict.relatedEntity).toBeDefined();
              expect(conflict.relatedEntity.id).toBeDefined();
              expect(conflict.relatedEntity.name).toBeDefined();

              // Must have conflict nature
              expect(conflict.conflictNature).toBeDefined();
              expect(conflict.conflictNature.length).toBeGreaterThan(0);

              // Must have type and severity
              expect(conflict.type).toBe("committee_assignment");
              expect(["low", "medium", "high"]).toContain(conflict.severity);
            }

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirement 29.4**
   * Committee assignments must be cross-referenced with business interests
   */
  describe("Property 14.4: Cross-Reference Correctness", () => {
    it("should cross-reference all business interests with all committees", () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryBusinessInterest(), { minLength: 1, maxLength: 3 }),
          fc.array(arbitraryCommitteeAssignment(), { minLength: 1, maxLength: 3 }),
          (businessInterests, committees) => {
            const conflicts = detectCommitteeConflicts(businessInterests, committees);

            // Count expected conflicts (matching industries)
            let expectedConflictCount = 0;
            for (const interest of businessInterests) {
              for (const committee of committees) {
                if (areIndustriesRelated(interest.industry, committee.industry)) {
                  expectedConflictCount++;
                }
              }
            }

            // Actual conflicts should match expected
            expect(conflicts.length).toBe(expectedConflictCount);
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirement 29.7**
   * When no conflicts are detected, response must indicate "no conflicts found"
   */
  describe("Property 14.5: No Conflicts Response", () => {
    it("should indicate no conflicts when none are detected", () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryBusinessInterest(), { minLength: 0, maxLength: 3 }),
          (businessInterests) => {
            // Use bills with non-matching industries
            const bills = [
              {
                id: "unrelated-bill",
                title: "Unrelated topic bill",
                summary: "Something completely different",
                role: "principal_author" as BillAuthorRole,
              },
            ];

            const conflicts = detectBillConflicts(businessInterests, bills);

            // Create a mock result
            const result: ConflictDetectionResult = {
              politicianId: "test-politician",
              hasConflicts: conflicts.length > 0,
              conflicts,
              businessInterests,
              billsAnalyzed: bills.length,
              committeesAnalyzed: 0,
              lastAnalyzedAt: new Date(),
              disclaimer: "Test disclaimer",
            };

            const report = generateConflictReport(result);

            if (conflicts.length === 0) {
              expect(report).toContain("No potential conflicts");
            } else {
              expect(report).toContain("potential conflict");
            }

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should set hasConflicts to false when no conflicts exist", () => {
      // Test with empty business interests
      const result: ConflictDetectionResult = {
        politicianId: "test-politician",
        hasConflicts: false,
        conflicts: [],
        businessInterests: [],
        billsAnalyzed: 5,
        committeesAnalyzed: 3,
        lastAnalyzedAt: new Date(),
        disclaimer: "Test disclaimer",
      };

      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toHaveLength(0);

      const report = generateConflictReport(result);
      expect(report).toContain("No potential conflicts");
    });
  });

  /**
   * Additional property tests for industry classification
   */
  describe("Property 14.6: Industry Classification Consistency", () => {
    it("should classify industries consistently", () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 100 }), (text) => {
          const industry1 = classifyIndustry(text);
          const industry2 = classifyIndustry(text);

          // Same input should always produce same output
          expect(industry1).toBe(industry2);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should classify known keywords to their industries or related industries", () => {
      fc.assert(
        fc.property(fc.constantFrom(...industries.filter((i) => i !== "other")), (industry) => {
          const keywords = INDUSTRY_KEYWORDS[industry];
          if (!keywords || keywords.length === 0) {
            return true;
          }

          // Pick a random keyword
          const keyword = keywords[0]!;
          const classified = classifyIndustry(keyword);

          // The classified industry should either be the expected industry
          // or a related industry (due to keyword overlap between industries)
          const isCorrectOrRelated =
            classified === industry || areIndustriesRelated(classified, industry);

          expect(isCorrectOrRelated).toBe(true);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Property tests for related industries
   */
  describe("Property 14.7: Related Industries Symmetry", () => {
    it("should be symmetric - if A relates to B, B relates to A", () => {
      fc.assert(
        fc.property(arbitraryIndustry(), arbitraryIndustry(), (industry1, industry2) => {
          const aRelatesB = areIndustriesRelated(industry1, industry2);
          const bRelatesA = areIndustriesRelated(industry2, industry1);

          expect(aRelatesB).toBe(bRelatesA);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should be reflexive - every industry relates to itself", () => {
      fc.assert(
        fc.property(arbitraryIndustry(), (industry) => {
          expect(areIndustriesRelated(industry, industry)).toBe(true);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Property tests for business interest extraction
   */
  describe("Property 14.8: Business Interest Extraction", () => {
    it("should preserve all investment data during extraction", () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryInvestment(), { minLength: 1, maxLength: 10 }),
          (investments) => {
            const businessInterests = extractBusinessInterests(investments);

            expect(businessInterests.length).toBe(investments.length);

            for (let i = 0; i < investments.length; i++) {
              expect(businessInterests[i]!.id).toBe(investments[i]!.id);
              expect(businessInterests[i]!.description).toBe(investments[i]!.description);
              expect(businessInterests[i]!.salnYear).toBe(investments[i]!.salnRecord.year);
            }

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should classify industry for each extracted interest", () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryInvestment(), { minLength: 1, maxLength: 5 }),
          (investments) => {
            const businessInterests = extractBusinessInterests(investments);

            for (const interest of businessInterests) {
              expect(interest.industry).toBeDefined();
              expect(typeof interest.industry).toBe("string");
            }

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Property tests for severity determination
   */
  describe("Property 14.9: Severity Determination", () => {
    it("should assign higher severity to high-value principal author conflicts", () => {
      const highValueInterest: BusinessInterest = {
        id: "high-value",
        description: "Large banking corporation",
        value: 50_000_000, // 50M PHP
        industry: "banking",
        salnYear: 2023,
      };

      const bill = {
        id: "banking-bill",
        title: "Banking regulation act",
        summary: "A bill about banking",
        role: "principal_author" as BillAuthorRole,
      };

      const conflicts = detectBillConflicts([highValueInterest], [bill]);

      if (conflicts.length > 0) {
        expect(conflicts[0]!.severity).toBe("high");
      }
    });

    it("should assign lower severity to low-value co-author conflicts", () => {
      const lowValueInterest: BusinessInterest = {
        id: "low-value",
        description: "Small banking business",
        value: 500_000, // 500K PHP
        industry: "banking",
        salnYear: 2023,
      };

      const bill = {
        id: "banking-bill",
        title: "Banking regulation act",
        summary: "A bill about banking",
        role: "co_author" as BillAuthorRole,
      };

      const conflicts = detectBillConflicts([lowValueInterest], [bill]);

      if (conflicts.length > 0) {
        expect(conflicts[0]!.severity).toBe("low");
      }
    });
  });
});
