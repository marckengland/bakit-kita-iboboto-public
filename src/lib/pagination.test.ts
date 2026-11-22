/**
 * Property-Based Tests for Pagination Correctness
 *
 * **Validates: Requirements 1.1**
 *
 * Property 2: Pagination Correctness
 * For any paginated request with page number N and page size S, the returned results must:
 * - Contain at most S items
 * - Return items from position (N-1)*S to N*S-1 in the full result set
 * - Report accurate total count
 * - Return empty array when N exceeds available pages
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  paginateArray,
  calculateSkip,
  calculateTotalPages,
  createPaginatedResult,
  getPrismaPageOptions,
  validatePaginationParams,
} from "./pagination";

// Minimum iterations for property tests
const NUM_RUNS = 100;

describe("Pagination Correctness - Property 2", () => {
  /**
   * **Validates: Requirements 1.1**
   *
   * Property 2.1: Results contain at most S items (page size)
   */
  describe("Property 2.1: Maximum items per page", () => {
    it("should never return more items than the page size", () => {
      fc.assert(
        fc.property(
          // Generate array of items (0 to 1000 items)
          fc.array(fc.integer(), { minLength: 0, maxLength: 1000 }),
          // Generate valid page number (1 to 100)
          fc.integer({ min: 1, max: 100 }),
          // Generate valid page size (1 to 100)
          fc.integer({ min: 1, max: 100 }),
          (items, page, pageSize) => {
            const result = paginateArray(items, { page, pageSize });

            // Property: items.length <= pageSize
            expect(result.items.length).toBeLessThanOrEqual(pageSize);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 1.1**
   *
   * Property 2.2: Returns items from correct position range
   * Items should be from position (N-1)*S to N*S-1 in the full result set
   */
  describe("Property 2.2: Correct position range", () => {
    it("should return items from position (N-1)*S to N*S-1", () => {
      fc.assert(
        fc.property(
          // Generate array with unique identifiable items
          fc.array(fc.integer(), { minLength: 1, maxLength: 500 }),
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 1, max: 50 }),
          (items, page, pageSize) => {
            const result = paginateArray(items, { page, pageSize });
            const totalPages = calculateTotalPages(items.length, pageSize);

            // If page is within valid range
            if (page <= totalPages) {
              const expectedStartIndex = (page - 1) * pageSize;
              const expectedEndIndex = Math.min(page * pageSize, items.length);
              const expectedItems = items.slice(expectedStartIndex, expectedEndIndex);

              // Property: returned items match expected slice
              expect(result.items).toEqual(expectedItems);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should calculate correct skip value for any page and pageSize", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 100 }),
          (page, pageSize) => {
            const skip = calculateSkip(page, pageSize);

            // Property: skip = (page - 1) * pageSize
            expect(skip).toBe((page - 1) * pageSize);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 1.1**
   *
   * Property 2.3: Reports accurate total count
   */
  describe("Property 2.3: Accurate total count", () => {
    it("should always report the correct total count regardless of page", () => {
      fc.assert(
        fc.property(
          fc.array(fc.string(), { minLength: 0, maxLength: 500 }),
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 50 }),
          (items, page, pageSize) => {
            const result = paginateArray(items, { page, pageSize });

            // Property: totalCount equals original array length
            expect(result.totalCount).toBe(items.length);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should calculate correct total pages", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }),
          fc.integer({ min: 1, max: 100 }),
          (totalCount, pageSize) => {
            const totalPages = calculateTotalPages(totalCount, pageSize);

            if (totalCount === 0) {
              // Property: empty dataset has 0 pages
              expect(totalPages).toBe(0);
            } else {
              // Property: totalPages = ceil(totalCount / pageSize)
              expect(totalPages).toBe(Math.ceil(totalCount / pageSize));
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 1.1**
   *
   * Property 2.4: Returns empty array when page exceeds available pages
   */
  describe("Property 2.4: Empty array for out-of-range pages", () => {
    it("should return empty array when page number exceeds total pages", () => {
      fc.assert(
        fc.property(
          // Generate non-empty array
          fc.array(fc.integer(), { minLength: 1, maxLength: 100 }),
          fc.integer({ min: 1, max: 20 }),
          (items, pageSize) => {
            const totalPages = calculateTotalPages(items.length, pageSize);
            // Request a page beyond the last page
            const outOfRangePage = totalPages + 1;

            const result = paginateArray(items, { page: outOfRangePage, pageSize });

            // Property: items array is empty for out-of-range page
            expect(result.items).toEqual([]);
            // But total count is still accurate
            expect(result.totalCount).toBe(items.length);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should return empty array for empty dataset regardless of page", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 50 }),
          (page, pageSize) => {
            const result = paginateArray([], { page, pageSize });

            // Property: empty input always produces empty output
            expect(result.items).toEqual([]);
            expect(result.totalCount).toBe(0);
            expect(result.totalPages).toBe(0);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 1.1**
   *
   * Additional pagination properties for completeness
   */
  describe("Additional Pagination Properties", () => {
    it("should correctly indicate hasNextPage and hasPreviousPage", () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer(), { minLength: 1, maxLength: 200 }),
          fc.integer({ min: 1, max: 20 }),
          fc.integer({ min: 1, max: 20 }),
          (items, page, pageSize) => {
            const result = paginateArray(items, { page, pageSize });
            const totalPages = calculateTotalPages(items.length, pageSize);

            // Property: hasNextPage is true iff page < totalPages
            expect(result.hasNextPage).toBe(page < totalPages);

            // Property: hasPreviousPage is true iff page > 1
            expect(result.hasPreviousPage).toBe(page > 1);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should preserve item order through pagination", () => {
      fc.assert(
        fc.property(
          // Generate array with unique items to verify order
          fc.uniqueArray(fc.integer(), { minLength: 10, maxLength: 100 }),
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 10 }),
          (items, page, pageSize) => {
            const result = paginateArray(items, { page, pageSize });
            const totalPages = calculateTotalPages(items.length, pageSize);

            if (page <= totalPages && result.items.length > 1) {
              // Property: items maintain their relative order
              for (let i = 0; i < result.items.length - 1; i++) {
                const currentItem = result.items[i];
                const nextItem = result.items[i + 1];
                if (currentItem !== undefined && nextItem !== undefined) {
                  const currentIndex = items.indexOf(currentItem);
                  const nextIndex = items.indexOf(nextItem);
                  expect(currentIndex).toBeLessThan(nextIndex);
                }
              }
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should cover all items exactly once when iterating through all pages", () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer(), { minLength: 1, maxLength: 100 }),
          fc.integer({ min: 1, max: 20 }),
          (items, pageSize) => {
            const totalPages = calculateTotalPages(items.length, pageSize);
            const allPaginatedItems: number[] = [];

            // Collect items from all pages
            for (let page = 1; page <= totalPages; page++) {
              const result = paginateArray(items, { page, pageSize });
              allPaginatedItems.push(...result.items);
            }

            // Property: concatenating all pages gives original array
            expect(allPaginatedItems).toEqual(items);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 1.1**
   *
   * Tests for Prisma integration helpers
   */
  describe("Prisma Integration", () => {
    it("should generate correct Prisma pagination options", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          (page, pageSize) => {
            const options = getPrismaPageOptions({ page, pageSize });

            // Property: skip = (page - 1) * pageSize
            expect(options.skip).toBe((page - 1) * pageSize);
            // Property: take = pageSize
            expect(options.take).toBe(pageSize);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should create correct paginated result from database results", () => {
      fc.assert(
        fc.property(
          fc.array(fc.string(), { minLength: 0, maxLength: 50 }),
          fc.integer({ min: 0, max: 1000 }),
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 1, max: 50 }),
          (items, totalCount, page, pageSize) => {
            const result = createPaginatedResult(items, totalCount, { page, pageSize });

            // Property: items are preserved
            expect(result.items).toEqual(items);
            // Property: totalCount is preserved
            expect(result.totalCount).toBe(totalCount);
            // Property: page and pageSize are preserved
            expect(result.page).toBe(page);
            expect(result.pageSize).toBe(pageSize);
            // Property: totalPages is calculated correctly
            expect(result.totalPages).toBe(totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize));
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 1.1**
   *
   * Input validation tests
   */
  describe("Input Validation", () => {
    it("should reject invalid page numbers", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -100, max: 0 }),
          fc.integer({ min: 1, max: 100 }),
          (invalidPage, pageSize) => {
            expect(() => {
              validatePaginationParams({ page: invalidPage, pageSize });
            }).toThrow("Page number must be a positive integer");
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should reject invalid page sizes", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: -100, max: 0 }),
          (page, invalidPageSize) => {
            expect(() => {
              validatePaginationParams({ page, pageSize: invalidPageSize });
            }).toThrow("Page size must be a positive integer");
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should reject non-integer page numbers", () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.1, max: 100, noNaN: true }).filter((n) => !Number.isInteger(n)),
          fc.integer({ min: 1, max: 100 }),
          (nonIntPage, pageSize) => {
            expect(() => {
              validatePaginationParams({ page: nonIntPage, pageSize });
            }).toThrow("Page number must be a positive integer");
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
