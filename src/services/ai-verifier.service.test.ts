/**
 * Unit Tests for AI Verifier Service
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect } from "vitest";
import {
  validateSubmission,
  calculateStringSimilarity,
  calculateDataSimilarity,
  getRelevantSources,
  requiresManualReview,
  calculatePriority,
  crossReferenceWithSources,
  detectDuplicate,
  analyzeSubmission,
  verifySubmission,
  queueForManualReview,
  processVerificationResult,
  getVerificationStatus,
  VerificationError,
  DataSubmission,
  VerificationResult,
  CONFIDENCE_THRESHOLD,
} from "./ai-verifier.service";

describe("AI Verifier Service", () => {
  describe("validateSubmission", () => {
    it("should accept valid submission", () => {
      const submission: DataSubmission = {
        id: "sub-1",
        type: "politician",
        data: { fullName: "Test Politician" },
        submittedBy: "user-1",
        submittedAt: new Date(),
      };
      expect(validateSubmission(submission)).toBe(true);
    });

    it("should reject submission without id", () => {
      const submission = {
        type: "politician",
        data: { fullName: "Test" },
        submittedBy: "user-1",
        submittedAt: new Date(),
      } as unknown as DataSubmission;
      expect(validateSubmission(submission)).toBe(false);
    });

    it("should reject submission with invalid type", () => {
      const submission: DataSubmission = {
        id: "sub-1",
        type: "invalid" as any,
        data: { fullName: "Test" },
        submittedBy: "user-1",
        submittedAt: new Date(),
      };
      expect(validateSubmission(submission)).toBe(false);
    });

    it("should reject submission with empty data", () => {
      const submission: DataSubmission = {
        id: "sub-1",
        type: "politician",
        data: {},
        submittedBy: "user-1",
        submittedAt: new Date(),
      };
      expect(validateSubmission(submission)).toBe(false);
    });

    it("should accept all valid types", () => {
      const types = ["politician", "bill", "controversy", "saln", "project"];
      for (const type of types) {
        const submission: DataSubmission = {
          id: "sub-1",
          type: type as any,
          data: { field: "value" },
          submittedBy: "user-1",
          submittedAt: new Date(),
        };
        expect(validateSubmission(submission)).toBe(true);
      }
    });
  });

  describe("calculateStringSimilarity", () => {
    it("should return 1.0 for identical strings", () => {
      expect(calculateStringSimilarity("hello world", "hello world")).toBe(1.0);
    });

    it("should return 1.0 for case-insensitive match", () => {
      expect(calculateStringSimilarity("Hello World", "hello world")).toBe(1.0);
    });

    it("should return 0 for completely different strings", () => {
      expect(calculateStringSimilarity("abc", "xyz")).toBe(0);
    });

    it("should return partial similarity for overlapping words", () => {
      const similarity = calculateStringSimilarity("hello world", "hello there");
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });

    it("should handle empty strings", () => {
      expect(calculateStringSimilarity("", "hello")).toBe(0);
      expect(calculateStringSimilarity("hello", "")).toBe(0);
    });
  });

  describe("calculateDataSimilarity", () => {
    it("should return 1.0 for identical data", () => {
      const data = { name: "Test", position: "Senator" };
      expect(calculateDataSimilarity(data, data)).toBe(1.0);
    });

    it("should return 0 for no common keys", () => {
      const data1 = { name: "Test" };
      const data2 = { position: "Senator" };
      expect(calculateDataSimilarity(data1, data2)).toBe(0);
    });

    it("should calculate partial similarity", () => {
      const data1 = { name: "Juan Dela Cruz", position: "Senator" };
      const data2 = { name: "Juan Dela Cruz", position: "Congressman" };
      const similarity = calculateDataSimilarity(data1, data2);
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });
  });

  describe("getRelevantSources", () => {
    it("should return sources for politician type", () => {
      const sources = getRelevantSources("politician");
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.some((s) => s.name === "COMELEC")).toBe(true);
    });

    it("should return sources for bill type", () => {
      const sources = getRelevantSources("bill");
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.some((s) => s.name.includes("Senate"))).toBe(true);
    });

    it("should return sources for controversy type", () => {
      const sources = getRelevantSources("controversy");
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.some((s) => s.name.includes("Court"))).toBe(true);
    });

    it("should return empty for unknown type", () => {
      const sources = getRelevantSources("unknown");
      expect(sources).toHaveLength(0);
    });
  });

  describe("requiresManualReview", () => {
    it("should require review for duplicates", () => {
      expect(requiresManualReview(0.95, true)).toBe(true);
    });

    it("should require review for low confidence", () => {
      expect(requiresManualReview(0.5, false)).toBe(true);
    });

    it("should require review for medium confidence", () => {
      expect(requiresManualReview(0.8, false)).toBe(true);
    });

    it("should not require review for high confidence non-duplicates", () => {
      expect(requiresManualReview(0.95, false)).toBe(false);
    });
  });

  describe("calculatePriority", () => {
    it("should return high for controversies", () => {
      expect(calculatePriority(0.9, "controversy")).toBe("high");
    });

    it("should return high for very low confidence", () => {
      expect(calculatePriority(0.2, "politician")).toBe("high");
    });

    it("should return medium for moderate confidence", () => {
      expect(calculatePriority(0.4, "politician")).toBe("medium");
    });

    it("should return low for higher confidence", () => {
      expect(calculatePriority(0.6, "politician")).toBe("low");
    });
  });

  describe("crossReferenceWithSources", () => {
    it("should return sources for valid submission", async () => {
      const submission: DataSubmission = {
        id: "sub-1",
        type: "politician",
        data: { fullName: "Test Politician" },
        submittedBy: "user-1",
        submittedAt: new Date(),
      };

      const sources = await crossReferenceWithSources(submission);
      expect(sources.length).toBeGreaterThan(0);
      expect(sources[0]).toHaveProperty("name");
      expect(sources[0]).toHaveProperty("matchScore");
    });
  });

  describe("detectDuplicate", () => {
    it("should detect potential duplicates", async () => {
      const submission: DataSubmission = {
        id: "sub-1",
        type: "politician",
        data: { fullName: "Juan Dela Cruz", position: "Senator" },
        submittedBy: "user-1",
        submittedAt: new Date(),
      };

      const result = await detectDuplicate(submission);
      expect(result).toHaveProperty("isDuplicate");
      expect(result).toHaveProperty("similarity");
    });
  });

  describe("analyzeSubmission", () => {
    it("should return low confidence for no sources", async () => {
      const submission: DataSubmission = {
        id: "sub-1",
        type: "politician",
        data: { fullName: "Test" },
        submittedBy: "user-1",
        submittedAt: new Date(),
      };

      const result = await analyzeSubmission(submission, []);
      expect(result.confidence).toBeLessThan(CONFIDENCE_THRESHOLD);
      expect(result.reasoning).toContain("No official sources");
    });

    it("should return higher confidence with sources", async () => {
      const submission: DataSubmission = {
        id: "sub-1",
        type: "politician",
        data: { fullName: "Test" },
        submittedBy: "user-1",
        submittedAt: new Date(),
      };

      const sources = [{ name: "COMELEC", matchScore: 0.9, matchedFields: ["fullName"] }];

      const result = await analyzeSubmission(submission, sources);
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe("verifySubmission", () => {
    it("should verify valid submission", async () => {
      const submission: DataSubmission = {
        id: "sub-1",
        type: "politician",
        data: { fullName: "Test Politician", position: "Mayor" },
        submittedBy: "user-1",
        submittedAt: new Date(),
      };

      const result = await verifySubmission(submission);
      expect(result.submissionId).toBe("sub-1");
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("sources");
    });

    it("should throw error for invalid submission", async () => {
      const submission = {
        id: "",
        type: "politician",
        data: {},
        submittedBy: "user-1",
        submittedAt: new Date(),
      } as DataSubmission;

      await expect(verifySubmission(submission)).rejects.toThrow(VerificationError);
    });
  });

  describe("queueForManualReview", () => {
    it("should create review item with correct priority", async () => {
      const submission: DataSubmission = {
        id: "sub-1",
        type: "controversy",
        data: { title: "Test Controversy" },
        submittedBy: "user-1",
        submittedAt: new Date(),
      };

      const verificationResult: VerificationResult = {
        submissionId: "sub-1",
        status: "pending_review",
        confidence: 0.6,
        reasoning: "Test",
        sources: [],
        isDuplicate: false,
        requiresManualReview: true,
      };

      const reviewItem = await queueForManualReview(submission, verificationResult);
      expect(reviewItem.priority).toBe("high"); // Controversies are high priority
      expect(reviewItem.submissionId).toBe("sub-1");
    });
  });

  describe("processVerificationResult", () => {
    it("should publish verified submissions", async () => {
      const submission: DataSubmission = {
        id: "sub-1",
        type: "politician",
        data: { fullName: "Test" },
        submittedBy: "user-1",
        submittedAt: new Date(),
      };

      const result: VerificationResult = {
        submissionId: "sub-1",
        status: "verified",
        confidence: 0.95,
        reasoning: "Verified",
        sources: [],
        isDuplicate: false,
        requiresManualReview: false,
      };

      const processed = await processVerificationResult(submission, result);
      expect(processed.action).toBe("publish");
    });

    it("should reject low confidence submissions", async () => {
      const submission: DataSubmission = {
        id: "sub-1",
        type: "politician",
        data: { fullName: "Test" },
        submittedBy: "user-1",
        submittedAt: new Date(),
      };

      const result: VerificationResult = {
        submissionId: "sub-1",
        status: "rejected",
        confidence: 0.1,
        reasoning: "Cannot verify",
        sources: [],
        isDuplicate: false,
        requiresManualReview: false,
      };

      const processed = await processVerificationResult(submission, result);
      expect(processed.action).toBe("reject");
    });

    it("should queue for review when needed", async () => {
      const submission: DataSubmission = {
        id: "sub-1",
        type: "politician",
        data: { fullName: "Test" },
        submittedBy: "user-1",
        submittedAt: new Date(),
      };

      const result: VerificationResult = {
        submissionId: "sub-1",
        status: "pending_review",
        confidence: 0.7,
        reasoning: "Needs review",
        sources: [],
        isDuplicate: false,
        requiresManualReview: true,
      };

      const processed = await processVerificationResult(submission, result);
      expect(processed.action).toBe("queue_review");
      expect(processed.reviewItem).toBeDefined();
    });
  });

  describe("getVerificationStatus", () => {
    it("should indicate publishable for verified submissions", () => {
      const result: VerificationResult = {
        submissionId: "sub-1",
        status: "verified",
        confidence: 0.95,
        reasoning: "Verified",
        sources: [],
        isDuplicate: false,
        requiresManualReview: false,
      };

      const status = getVerificationStatus(result);
      expect(status.canPublish).toBe(true);
      expect(status.needsReview).toBe(false);
      expect(status.isRejected).toBe(false);
    });

    it("should indicate review needed", () => {
      const result: VerificationResult = {
        submissionId: "sub-1",
        status: "pending_review",
        confidence: 0.7,
        reasoning: "Needs review",
        sources: [],
        isDuplicate: false,
        requiresManualReview: true,
      };

      const status = getVerificationStatus(result);
      expect(status.canPublish).toBe(false);
      expect(status.needsReview).toBe(true);
    });

    it("should indicate rejected", () => {
      const result: VerificationResult = {
        submissionId: "sub-1",
        status: "rejected",
        confidence: 0.1,
        reasoning: "Rejected",
        sources: [],
        isDuplicate: false,
        requiresManualReview: false,
      };

      const status = getVerificationStatus(result);
      expect(status.canPublish).toBe(false);
      expect(status.isRejected).toBe(true);
    });
  });
});
