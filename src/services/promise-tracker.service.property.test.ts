/**
 * Property-Based Tests for Promise Fulfillment Calculation
 * **Validates: Requirements 23.1, 23.3, 23.5**
 */
import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import { PromiseStatus } from "@prisma/client";

// Mock Prisma before importing the service
vi.mock("@/lib/prisma", () => ({
  default: {
    campaignPromise: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    promiseEvidence: {
      findMany: vi.fn(),
    },
  },
}));

import {
  calculateFulfillmentRate,
  type FulfillmentRate,
  type PromiseCategorySummary,
  PROMISE_CATEGORIES,
} from "./promise-tracker.service";

const NUM_RUNS = 100;

const promiseStatusArb = fc.constantFrom<PromiseStatus>(
  "kept",
  "partially_kept",
  "broken",
  "in_progress",
  "not_yet_due"
);
const promiseCategoryArb = fc.constantFrom(...PROMISE_CATEGORIES);
const promiseCountArb = fc.integer({ min: 0, max: 1000 });
const promiseCountsArb = fc.record({
  kept: promiseCountArb,
  partiallyKept: promiseCountArb,
  broken: promiseCountArb,
  inProgress: promiseCountArb,
  notYetDue: promiseCountArb,
});
const promiseStatusListArb = fc.array(promiseStatusArb, { minLength: 0, maxLength: 100 });
const promiseWithCategoryArb = fc.record({
  category: promiseCategoryArb,
  status: promiseStatusArb,
});
const promisesWithCategoriesArb = fc.array(promiseWithCategoryArb, {
  minLength: 0,
  maxLength: 100,
});

function calculateFulfillmentRateFromStatuses(statuses: PromiseStatus[]): FulfillmentRate {
  const totalPromises = statuses.length;
  const keptCount = statuses.filter((s) => s === "kept").length;
  const partiallyKeptCount = statuses.filter((s) => s === "partially_kept").length;
  const brokenCount = statuses.filter((s) => s === "broken").length;
  const inProgressCount = statuses.filter((s) => s === "in_progress").length;
  const notYetDueCount = statuses.filter((s) => s === "not_yet_due").length;
  const fulfillmentRate = calculateFulfillmentRate(keptCount, partiallyKeptCount, totalPromises);
  return {
    totalPromises,
    keptCount,
    partiallyKeptCount,
    brokenCount,
    inProgressCount,
    notYetDueCount,
    fulfillmentRate,
    fulfillmentPercentage: `${fulfillmentRate.toFixed(1)}%`,
  };
}

function calculateCategorySummaries(
  promises: Array<{ category: string; status: PromiseStatus }>
): PromiseCategorySummary[] {
  const categoryMap = new Map<
    string,
    {
      totalCount: number;
      keptCount: number;
      partiallyKeptCount: number;
      brokenCount: number;
      inProgressCount: number;
      notYetDueCount: number;
    }
  >();
  for (const promise of promises) {
    const existing = categoryMap.get(promise.category) || {
      totalCount: 0,
      keptCount: 0,
      partiallyKeptCount: 0,
      brokenCount: 0,
      inProgressCount: 0,
      notYetDueCount: 0,
    };
    existing.totalCount++;
    switch (promise.status) {
      case "kept":
        existing.keptCount++;
        break;
      case "partially_kept":
        existing.partiallyKeptCount++;
        break;
      case "broken":
        existing.brokenCount++;
        break;
      case "in_progress":
        existing.inProgressCount++;
        break;
      case "not_yet_due":
        existing.notYetDueCount++;
        break;
    }
    categoryMap.set(promise.category, existing);
  }
  const summaries: PromiseCategorySummary[] = [];
  categoryMap.forEach((counts, category) => {
    summaries.push({
      category,
      ...counts,
      fulfillmentRate: calculateFulfillmentRate(
        counts.keptCount,
        counts.partiallyKeptCount,
        counts.totalCount
      ),
    });
  });
  return summaries.sort((a, b) => b.totalCount - a.totalCount);
}

describe("Property 12: Promise Fulfillment Calculation", () => {
  describe("12.1: Fulfillment rate formula correctness", () => {
    it("should calculate fulfillment rate using the correct formula", () => {
      fc.assert(
        fc.property(promiseCountsArb, (counts) => {
          const totalPromises =
            counts.kept +
            counts.partiallyKept +
            counts.broken +
            counts.inProgress +
            counts.notYetDue;
          const result = calculateFulfillmentRate(counts.kept, counts.partiallyKept, totalPromises);
          if (totalPromises === 0) {
            expect(result).toBe(0);
          } else {
            const expected = ((counts.kept + counts.partiallyKept * 0.5) / totalPromises) * 100;
            expect(result).toBeCloseTo(expected, 10);
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should always return a rate between 0 and 100", () => {
      fc.assert(
        fc.property(promiseCountsArb, (counts) => {
          const totalPromises =
            counts.kept +
            counts.partiallyKept +
            counts.broken +
            counts.inProgress +
            counts.notYetDue;
          const result = calculateFulfillmentRate(counts.kept, counts.partiallyKept, totalPromises);
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(100);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should return 0 for empty promise list", () => {
      const result = calculateFulfillmentRate(0, 0, 0);
      expect(result).toBe(0);
    });
  });

  describe("12.2: Fulfillment rate determinism", () => {
    it("should produce deterministic results for the same inputs", () => {
      fc.assert(
        fc.property(promiseCountsArb, (counts) => {
          const totalPromises =
            counts.kept +
            counts.partiallyKept +
            counts.broken +
            counts.inProgress +
            counts.notYetDue;
          const result1 = calculateFulfillmentRate(
            counts.kept,
            counts.partiallyKept,
            totalPromises
          );
          const result2 = calculateFulfillmentRate(
            counts.kept,
            counts.partiallyKept,
            totalPromises
          );
          expect(result1).toBe(result2);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("12.3: Status count consistency", () => {
    it("should have status counts that sum to total promises", () => {
      fc.assert(
        fc.property(promiseStatusListArb, (statuses) => {
          const result = calculateFulfillmentRateFromStatuses(statuses);
          const sumOfCounts =
            result.keptCount +
            result.partiallyKeptCount +
            result.brokenCount +
            result.inProgressCount +
            result.notYetDueCount;
          expect(sumOfCounts).toBe(result.totalPromises);
          expect(result.totalPromises).toBe(statuses.length);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should have non-negative status counts", () => {
      fc.assert(
        fc.property(promiseStatusListArb, (statuses) => {
          const result = calculateFulfillmentRateFromStatuses(statuses);
          expect(result.keptCount).toBeGreaterThanOrEqual(0);
          expect(result.partiallyKeptCount).toBeGreaterThanOrEqual(0);
          expect(result.brokenCount).toBeGreaterThanOrEqual(0);
          expect(result.inProgressCount).toBeGreaterThanOrEqual(0);
          expect(result.notYetDueCount).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("12.4: Fulfillment rate boundary conditions", () => {
    it("should return 100% when all promises are kept", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), (count) => {
          const result = calculateFulfillmentRate(count, 0, count);
          expect(result).toBe(100);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should return 50% when all promises are partially kept", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), (count) => {
          const result = calculateFulfillmentRate(0, count, count);
          expect(result).toBe(50);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should return 0% when no promises are kept or partially kept", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), (count) => {
          const result = calculateFulfillmentRate(0, 0, count);
          expect(result).toBe(0);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should calculate correctly for mixed kept and partially kept", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 500 }),
          fc.integer({ min: 0, max: 500 }),
          fc.integer({ min: 0, max: 500 }),
          (kept, partiallyKept, other) => {
            const total = kept + partiallyKept + other;
            if (total === 0) {
              return;
            }
            const result = calculateFulfillmentRate(kept, partiallyKept, total);
            const expected = ((kept + partiallyKept * 0.5) / total) * 100;
            expect(result).toBeCloseTo(expected, 10);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("12.5: Category summary correctness", () => {
    it("should correctly aggregate promises by category", () => {
      fc.assert(
        fc.property(promisesWithCategoriesArb, (promises) => {
          const summaries = calculateCategorySummaries(promises);
          const totalAcrossCategories = summaries.reduce((sum, s) => sum + s.totalCount, 0);
          expect(totalAcrossCategories).toBe(promises.length);
          for (const summary of summaries) {
            const statusSum =
              summary.keptCount +
              summary.partiallyKeptCount +
              summary.brokenCount +
              summary.inProgressCount +
              summary.notYetDueCount;
            expect(statusSum).toBe(summary.totalCount);
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should calculate valid fulfillment rates for each category", () => {
      fc.assert(
        fc.property(promisesWithCategoriesArb, (promises) => {
          const summaries = calculateCategorySummaries(promises);
          for (const summary of summaries) {
            expect(summary.fulfillmentRate).toBeGreaterThanOrEqual(0);
            expect(summary.fulfillmentRate).toBeLessThanOrEqual(100);
            const expected = calculateFulfillmentRate(
              summary.keptCount,
              summary.partiallyKeptCount,
              summary.totalCount
            );
            expect(summary.fulfillmentRate).toBeCloseTo(expected, 10);
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should sort categories by total count descending", () => {
      fc.assert(
        fc.property(promisesWithCategoriesArb, (promises) => {
          const summaries = calculateCategorySummaries(promises);
          for (let i = 1; i < summaries.length; i++) {
            const prev = summaries[i - 1];
            const curr = summaries[i];
            if (prev && curr) {
              expect(prev.totalCount).toBeGreaterThanOrEqual(curr.totalCount);
            }
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("12.6: Percentage string formatting", () => {
    it("should format percentage string correctly", () => {
      fc.assert(
        fc.property(promiseStatusListArb, (statuses) => {
          const result = calculateFulfillmentRateFromStatuses(statuses);
          const expectedString = `${result.fulfillmentRate.toFixed(1)}%`;
          expect(result.fulfillmentPercentage).toBe(expectedString);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should always end percentage string with '%'", () => {
      fc.assert(
        fc.property(promiseStatusListArb, (statuses) => {
          const result = calculateFulfillmentRateFromStatuses(statuses);
          expect(result.fulfillmentPercentage.endsWith("%")).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("12.7: Monotonicity properties", () => {
    it("should not decrease rate when adding a kept promise", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          (kept, partiallyKept, other) => {
            const total = kept + partiallyKept + other;
            const rateBefore = calculateFulfillmentRate(kept, partiallyKept, total);
            const rateAfter = calculateFulfillmentRate(kept + 1, partiallyKept, total + 1);
            if (rateBefore < 100) {
              expect(rateAfter).toBeGreaterThanOrEqual(rateBefore - 0.0001);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should not increase rate when adding a broken promise", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          (kept, partiallyKept, other) => {
            const total = kept + partiallyKept + other;
            const rateBefore = calculateFulfillmentRate(kept, partiallyKept, total);
            const rateAfter = calculateFulfillmentRate(kept, partiallyKept, total + 1);
            expect(rateAfter).toBeLessThanOrEqual(rateBefore + 0.0001);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
