/**
 * Property-Based Tests for AI Verifier Service
 * Property 16: AI Verification Correctness
 * Validates: Requirements 35.1, 35.2, 35.3, 35.4, 35.5, 35.6, 35.7, 35.8
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type { DataSubmission, VerificationResult } from "./ai-verifier.service";
import {
  validateSubmission,
  calculateStringSimilarity,
  calculateDataSimilarity,
  requiresManualReview,
  calculatePriority,
  verifySubmission,
  getVerificationStatus,
  CONFIDENCE_THRESHOLD,
  AUTO_PUBLISH_THRESHOLD,
} from "./ai-verifier.service";

const NUM_RUNS = 100;

const arbitrarySubmissionType = (): fc.Arbitrary<DataSubmission["type"]> =>
  fc.constantFrom("politician", "bill", "controversy", "saln", "project");

const arbitrarySubmissionData = (): fc.Arbitrary<Record<string, unknown>> =>
  fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.oneof(fc.string({ minLength: 1, maxLength: 100 }), fc.integer(), fc.boolean()),
    { minKeys: 1, maxKeys: 10 }
  );

const arbitraryValidSubmission = (): fc.Arbitrary<DataSubmission> =>
  fc.record({
    id: fc.uuid(),
    type: arbitrarySubmissionType(),
    data: arbitrarySubmissionData() as fc.Arbitrary<Record<string, any>>,
    submittedBy: fc.uuid().map((id) => `user-${id}`),
    submittedAt: fc.date(),
  });

const arbitraryConfidence = (): fc.Arbitrary<number> => fc.float({ min: 0, max: 1, noNaN: true });

describe("AI Verification Correctness - Property 16", () => {
  describe("Property 16.1: Submission Validation", () => {
    it("should accept all valid submissions", () => {
      fc.assert(
        fc.property(arbitraryValidSubmission(), (submission) => {
          expect(validateSubmission(submission)).toBe(true);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should reject submissions with empty data", () => {
      fc.assert(
        fc.property(fc.uuid(), arbitrarySubmissionType(), (id, type) => {
          const submission: DataSubmission = {
            id,
            type,
            data: {},
            submittedBy: "user-1",
            submittedAt: new Date(),
          };
          expect(validateSubmission(submission)).toBe(false);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("Property 16.2: Confidence Scores", () => {
    it("should always produce confidence between 0 and 1", async () => {
      await fc.assert(
        fc.asyncProperty(arbitraryValidSubmission(), async (submission) => {
          const result = await verifySubmission(submission);
          expect(result.confidence).toBeGreaterThanOrEqual(0);
          expect(result.confidence).toBeLessThanOrEqual(1);
          return true;
        }),
        { numRuns: Math.min(NUM_RUNS, 20) }
      );
    });
  });

  describe("Property 16.3: Manual Review Queueing", () => {
    it("should require review for low confidence", () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: Math.fround(CONFIDENCE_THRESHOLD - 0.01), noNaN: true }),
          (confidence) => {
            expect(requiresManualReview(confidence, false)).toBe(true);
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should require review for duplicates", () => {
      fc.assert(
        fc.property(arbitraryConfidence(), (confidence) => {
          expect(requiresManualReview(confidence, true)).toBe(true);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should not require review for high confidence non-duplicates", () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(AUTO_PUBLISH_THRESHOLD + 0.001), max: 1, noNaN: true }),
          (confidence) => {
            expect(requiresManualReview(confidence, false)).toBe(false);
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("Property 16.4: Status Consistency", () => {
    it("should mark high confidence as publishable", () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(AUTO_PUBLISH_THRESHOLD), max: 1, noNaN: true }),
          (confidence) => {
            const result: VerificationResult = {
              submissionId: "test",
              status: "verified",
              confidence,
              reasoning: "Test",
              sources: [],
              isDuplicate: false,
              requiresManualReview: false,
            };
            expect(getVerificationStatus(result).canPublish).toBe(true);
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("Property 16.5: Similarity Calculation", () => {
    it("should return 1.0 for identical strings", () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 100 }), (str) => {
          expect(calculateStringSimilarity(str, str)).toBe(1.0);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should be symmetric", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (str1, str2) => {
            const sim1 = calculateStringSimilarity(str1, str2);
            const sim2 = calculateStringSimilarity(str2, str1);
            expect(sim1).toBeCloseTo(sim2, 10);
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should return value between 0 and 1", () => {
      fc.assert(
        fc.property(fc.string({ maxLength: 50 }), fc.string({ maxLength: 50 }), (str1, str2) => {
          const similarity = calculateStringSimilarity(str1, str2);
          expect(similarity).toBeGreaterThanOrEqual(0);
          expect(similarity).toBeLessThanOrEqual(1);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("Property 16.6: Data Similarity", () => {
    it("should return 1.0 for identical data", () => {
      fc.assert(
        fc.property(arbitrarySubmissionData(), (data) => {
          const d = data as Record<string, any>;
          expect(calculateDataSimilarity(d, d)).toBe(1.0);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("Property 16.7: Priority Calculation", () => {
    it("should always return high for controversies", () => {
      fc.assert(
        fc.property(arbitraryConfidence(), (confidence) => {
          expect(calculatePriority(confidence, "controversy")).toBe("high");
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should return valid priority values", () => {
      fc.assert(
        fc.property(arbitraryConfidence(), arbitrarySubmissionType(), (confidence, type) => {
          const priority = calculatePriority(confidence, type);
          expect(["low", "medium", "high"]).toContain(priority);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
