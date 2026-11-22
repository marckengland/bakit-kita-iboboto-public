/**
 * AI Document Parser Service Tests
 *
 * Unit tests for PDF parsing, AI-assisted data extraction, and validation.
 *
 * **Validates: Requirements 20.4, 20.5, 20.6, 20.10**
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect } from "vitest";
import {
  // Types
  RawDocument,
  DocumentType,
  ExtractedBillData,
  ExtractedSALNData,
  DocumentExtractionResult,
  // Constants
  CONFIDENCE_THRESHOLD,
  LOW_CONFIDENCE_THRESHOLD,
  AUTO_PUBLISH_THRESHOLD,
  BILL_FIELD_WEIGHTS,
  SALN_FIELD_WEIGHTS,
  // Functions
  parsePDF,
  extractTextFromDocument,
  generateBillExtractionPrompt,
  generateSALNExtractionPrompt,
  generateBillSummary,
  validateBillData,
  validateSALNData,
  calculateOverallConfidence,
  identifyLowConfidenceFields,
  buildConfidenceScores,
  extractBillData,
  extractSALNData,
  processDocument,
  canAutoPublish,
  getExtractionSummary,
  DocumentParserError,
} from "./ai-document-parser.service";

// ============================================
// Test Helpers
// ============================================

function createMockDocument(
  type: DocumentType,
  content: string,
  id: string = "doc-123"
): RawDocument {
  return {
    id,
    type,
    filename: `test-${type}.pdf`,
    content: Buffer.from(content).toString("base64"),
    uploadedAt: new Date(),
  };
}

function createMockBillDocument(content?: string): RawDocument {
  const defaultContent = `
    SENATE BILL NO. 1234
    
    AN ACT PROVIDING FOR THE REGULATION OF DIGITAL ASSETS
    
    Filed: January 15, 2024
    
    Principal Author: Senator Juan Dela Cruz
    Co-Author: Senator Maria Santos
    
    Be it enacted by the Senate and House of Representatives of the Philippines in Congress assembled:
    
    Section 1. Short Title. This Act shall be known as the "Digital Assets Regulation Act of 2024".
    
    Section 2. Declaration of Policy. It is hereby declared the policy of the State to...
  `;
  return createMockDocument("bill", content || defaultContent);
}

function createMockSALNDocument(content?: string): RawDocument {
  const defaultContent = `
    STATEMENT OF ASSETS, LIABILITIES AND NET WORTH
    As of December 31, 2023
    
    Name: Juan Dela Cruz
    Position: Senator
    
    ASSETS:
    Real Properties: PHP 5,000,000
    Personal Properties: PHP 2,000,000
    Investments: PHP 3,000,000
    Total Assets: PHP 10,000,000
    
    LIABILITIES:
    Loans: PHP 2,000,000
    Total Liabilities: PHP 2,000,000
    
    NET WORTH: PHP 8,000,000
    
    Declared Salary: PHP 500,000
  `;
  return createMockDocument("saln", content || defaultContent);
}

// ============================================
// PDF Parsing Tests
// ============================================

describe("PDF Parsing", () => {
  describe("parsePDF", () => {
    it("should parse base64 encoded content", async () => {
      const content = "Test PDF content";
      const base64 = Buffer.from(content).toString("base64");

      const result = await parsePDF(base64);

      expect(result).toBeDefined();
      expect(result.text).toBe(content);
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0]?.pageNumber).toBe(1);
      expect(result.metadata.pageCount).toBe(1);
    });

    it("should include metadata in parsed result", async () => {
      const content = "Document with metadata";
      const base64 = Buffer.from(content).toString("base64");

      const result = await parsePDF(base64);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.pageCount).toBeGreaterThan(0);
      expect(result.metadata.creationDate).toBeInstanceOf(Date);
    });
  });

  describe("extractTextFromDocument", () => {
    it("should extract text from base64 encoded document", async () => {
      const content = "Bill content here";
      const doc = createMockDocument("bill", content);

      const text = await extractTextFromDocument(doc);

      expect(text).toBe(content);
    });

    it("should handle data URL format", async () => {
      const content = "SALN content";
      const base64 = Buffer.from(content).toString("base64");
      const doc: RawDocument = {
        id: "doc-1",
        type: "saln",
        filename: "test.pdf",
        content: `data:application/pdf;base64,${base64}`,
        uploadedAt: new Date(),
      };

      const text = await extractTextFromDocument(doc);

      expect(text).toBe(content);
    });
  });
});

// ============================================
// Prompt Generation Tests
// ============================================

describe("Prompt Generation", () => {
  describe("generateBillExtractionPrompt", () => {
    it("should include all required bill fields in prompt", () => {
      const text = "Sample bill text";
      const prompt = generateBillExtractionPrompt(text);

      expect(prompt).toContain("billNumber");
      expect(prompt).toContain("title");
      expect(prompt).toContain("summary");
      expect(prompt).toContain("filingDate");
      expect(prompt).toContain("status");
      expect(prompt).toContain("chamber");
      expect(prompt).toContain("authors");
    });

    it("should include the document text in prompt", () => {
      const text = "SENATE BILL NO. 1234";
      const prompt = generateBillExtractionPrompt(text);

      expect(prompt).toContain(text);
    });

    it("should truncate very long documents", () => {
      const longText = "A".repeat(20000);
      const prompt = generateBillExtractionPrompt(longText);

      // Should be truncated to 15000 chars
      expect(prompt.length).toBeLessThan(longText.length + 1000);
    });
  });

  describe("generateSALNExtractionPrompt", () => {
    it("should include all required SALN fields in prompt", () => {
      const text = "Sample SALN text";
      const prompt = generateSALNExtractionPrompt(text);

      expect(prompt).toContain("politicianName");
      expect(prompt).toContain("year");
      expect(prompt).toContain("totalAssets");
      expect(prompt).toContain("totalLiabilities");
      expect(prompt).toContain("netWorth");
      expect(prompt).toContain("realProperties");
      expect(prompt).toContain("investments");
    });

    it("should request confidence scores", () => {
      const text = "SALN document";
      const prompt = generateSALNExtractionPrompt(text);

      expect(prompt).toContain("confidence");
    });
  });
});

// ============================================
// Bill Summary Generation Tests
// ============================================

describe("Bill Summary Generation", () => {
  describe("generateBillSummary", () => {
    it("should generate a summary for a bill", async () => {
      const billText = "Section 1. This act provides for...";
      const title = "Digital Assets Regulation Act";

      const result = await generateBillSummary(billText, title);

      expect(result.summary).toBeDefined();
      expect(result.summary.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it("should return confidence score with summary", async () => {
      const result = await generateBillSummary("Bill text", "Test Act");

      expect(typeof result.confidence).toBe("number");
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });
});

// ============================================
// Validation Tests
// ============================================

describe("Data Validation", () => {
  describe("validateBillData", () => {
    it("should validate complete bill data successfully", () => {
      const data: Partial<ExtractedBillData> = {
        billNumber: "SB-1234",
        title: "An Act Providing for...",
        summary: "This bill aims to...",
        filingDate: new Date("2024-01-15"),
        status: "pending",
        chamber: "senate",
        congress: 19,
        session: 1,
        authors: [{ name: "Senator Name", role: "principal_author" }],
      };

      const result = validateBillData(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject bill without bill number", () => {
      const data: Partial<ExtractedBillData> = {
        title: "Test Bill",
      };

      const result = validateBillData(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Bill number is required");
    });

    it("should reject bill without title", () => {
      const data: Partial<ExtractedBillData> = {
        billNumber: "SB-1234",
      };

      const result = validateBillData(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Bill title is required");
    });

    it("should warn about unusual bill number format", () => {
      const data: Partial<ExtractedBillData> = {
        billNumber: "UNUSUAL-FORMAT",
        title: "Test Bill",
      };

      const result = validateBillData(data);

      expect(result.warnings.some((w) => w.includes("format"))).toBe(true);
    });

    it("should reject invalid chamber", () => {
      const data: Partial<ExtractedBillData> = {
        billNumber: "SB-1234",
        title: "Test Bill",
        chamber: "invalid" as any,
      };

      const result = validateBillData(data);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("chamber"))).toBe(true);
    });

    it("should reject invalid status", () => {
      const data: Partial<ExtractedBillData> = {
        billNumber: "SB-1234",
        title: "Test Bill",
        status: "invalid" as any,
      };

      const result = validateBillData(data);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("status"))).toBe(true);
    });

    it("should warn about future filing date", () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const data: Partial<ExtractedBillData> = {
        billNumber: "SB-1234",
        title: "Test Bill",
        filingDate: futureDate,
      };

      const result = validateBillData(data);

      expect(result.warnings.some((w) => w.includes("future"))).toBe(true);
    });
  });

  describe("validateSALNData", () => {
    it("should validate complete SALN data successfully", () => {
      const data: Partial<ExtractedSALNData> = {
        politicianName: "Juan Dela Cruz",
        year: 2023,
        totalAssets: 10000000,
        totalLiabilities: 2000000,
        netWorth: 8000000,
        realProperties: [],
        personalProperties: [],
        investments: [],
      };

      const result = validateSALNData(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject SALN without politician name", () => {
      const data: Partial<ExtractedSALNData> = {
        year: 2023,
        totalAssets: 10000000,
        totalLiabilities: 2000000,
        netWorth: 8000000,
      };

      const result = validateSALNData(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Politician name is required");
    });

    it("should reject SALN without year", () => {
      const data: Partial<ExtractedSALNData> = {
        politicianName: "Juan Dela Cruz",
        totalAssets: 10000000,
        totalLiabilities: 2000000,
        netWorth: 8000000,
      };

      const result = validateSALNData(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("SALN year is required");
    });

    it("should reject negative total assets", () => {
      const data: Partial<ExtractedSALNData> = {
        politicianName: "Juan Dela Cruz",
        year: 2023,
        totalAssets: -1000,
        totalLiabilities: 2000000,
        netWorth: 8000000,
      };

      const result = validateSALNData(data);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("assets"))).toBe(true);
    });

    it("should warn about net worth inconsistency and auto-correct", () => {
      const data: Partial<ExtractedSALNData> = {
        politicianName: "Juan Dela Cruz",
        year: 2023,
        totalAssets: 10000000,
        totalLiabilities: 2000000,
        netWorth: 5000000, // Should be 8000000
      };

      const result = validateSALNData(data);

      expect(result.warnings.some((w) => w.includes("Net worth"))).toBe(true);
      expect(result.correctedData?.netWorth).toBe(8000000);
    });

    it("should warn about unusual year", () => {
      const data: Partial<ExtractedSALNData> = {
        politicianName: "Juan Dela Cruz",
        year: 1980, // Too old
        totalAssets: 10000000,
        totalLiabilities: 2000000,
        netWorth: 8000000,
      };

      const result = validateSALNData(data);

      expect(result.warnings.some((w) => w.includes("year"))).toBe(true);
    });
  });
});

// ============================================
// Confidence Calculation Tests
// ============================================

describe("Confidence Calculation", () => {
  describe("calculateOverallConfidence", () => {
    it("should calculate weighted average confidence", () => {
      const scores = {
        billNumber: 0.9,
        title: 0.8,
        summary: 0.7,
      };
      const weights = {
        billNumber: 1.0,
        title: 0.9,
        summary: 0.7,
      };

      const result = calculateOverallConfidence(scores, weights);

      // (0.9*1.0 + 0.8*0.9 + 0.7*0.7) / (1.0 + 0.9 + 0.7) = 2.11 / 2.6 ≈ 0.812
      expect(result).toBeCloseTo(0.812, 2);
    });

    it("should return 0 for empty scores", () => {
      const result = calculateOverallConfidence({}, {});

      expect(result).toBe(0);
    });

    it("should use default weight for unknown fields", () => {
      const scores = { unknownField: 0.8 };
      const weights = {};

      const result = calculateOverallConfidence(scores, weights);

      // Uses default weight of 0.5
      expect(result).toBe(0.8);
    });
  });

  describe("identifyLowConfidenceFields", () => {
    it("should identify fields below threshold", () => {
      const scores = {
        field1: 0.9,
        field2: 0.4,
        field3: 0.3,
        field4: 0.6,
      };

      const result = identifyLowConfidenceFields(scores, LOW_CONFIDENCE_THRESHOLD);

      expect(result).toContain("field2");
      expect(result).toContain("field3");
      expect(result).not.toContain("field1");
      expect(result).not.toContain("field4");
    });

    it("should return empty array when all fields are above threshold", () => {
      const scores = {
        field1: 0.9,
        field2: 0.8,
      };

      const result = identifyLowConfidenceFields(scores, LOW_CONFIDENCE_THRESHOLD);

      expect(result).toHaveLength(0);
    });

    it("should use custom threshold", () => {
      const scores = {
        field1: 0.7,
        field2: 0.6,
      };

      const result = identifyLowConfidenceFields(scores, 0.65);

      expect(result).toContain("field2");
      expect(result).not.toContain("field1");
    });
  });

  describe("buildConfidenceScores", () => {
    it("should build confidence score objects for all fields", () => {
      const data = {
        billNumber: "SB-1234",
        title: "Test Bill",
      };
      const scores = {
        billNumber: 0.95,
        title: 0.85,
      };

      const result = buildConfidenceScores(data, scores, "bill");

      expect(result).toHaveLength(2);
      expect(result.find((r) => r.field === "billNumber")?.confidence).toBe(0.95);
      expect(result.find((r) => r.field === "title")?.confidence).toBe(0.85);
    });

    it("should mark low confidence fields as needing review", () => {
      const data = { field1: "value" };
      const scores = { field1: 0.5 };

      const result = buildConfidenceScores(data, scores, "bill");

      expect(result[0]?.needsReview).toBe(true);
    });

    it("should not mark high confidence fields as needing review", () => {
      const data = { field1: "value" };
      const scores = { field1: 0.9 };

      const result = buildConfidenceScores(data, scores, "bill");

      expect(result[0]?.needsReview).toBe(false);
    });
  });
});

// ============================================
// Core Extraction Tests
// ============================================

describe("Core Extraction", () => {
  describe("extractBillData", () => {
    it("should extract data from bill document", async () => {
      const doc = createMockBillDocument();

      const result = await extractBillData(doc);

      expect(result.documentId).toBe(doc.id);
      expect(result.documentType).toBe("bill");
      expect(result.status).toBeDefined();
      expect(result.modelUsed).toBeDefined();
      expect(result.processingTimeMs).toBeGreaterThan(0);
    });

    it("should include confidence scores", async () => {
      const doc = createMockBillDocument();

      const result = await extractBillData(doc);

      expect(result.confidenceScores).toBeDefined();
      expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(result.overallConfidence).toBeLessThanOrEqual(1);
    });

    it("should identify low confidence fields", async () => {
      const doc = createMockBillDocument();

      const result = await extractBillData(doc);

      expect(Array.isArray(result.lowConfidenceFields)).toBe(true);
    });

    it("should fail for empty document", async () => {
      const doc = createMockDocument("bill", "");

      const result = await extractBillData(doc);

      expect(result.status).toBe("failed");
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should generate summary if not extracted", async () => {
      const doc = createMockBillDocument();

      const result = await extractBillData(doc);

      expect(result.summary).toBeDefined();
    });
  });

  describe("extractSALNData", () => {
    it("should extract data from SALN document", async () => {
      const doc = createMockSALNDocument();

      const result = await extractSALNData(doc);

      expect(result.documentId).toBe(doc.id);
      expect(result.documentType).toBe("saln");
      expect(result.status).toBeDefined();
      expect(result.modelUsed).toBeDefined();
    });

    it("should include financial data in extraction", async () => {
      const doc = createMockSALNDocument();

      const result = await extractSALNData(doc);

      if (result.data) {
        expect(result.data.totalAssets).toBeDefined();
        expect(result.data.totalLiabilities).toBeDefined();
        expect(result.data.netWorth).toBeDefined();
      }
    });

    it("should fail for empty document", async () => {
      const doc = createMockDocument("saln", "");

      const result = await extractSALNData(doc);

      expect(result.status).toBe("failed");
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("processDocument", () => {
    it("should route bill documents to bill extractor", async () => {
      const doc = createMockBillDocument();

      const result = await processDocument(doc);

      expect(result.documentType).toBe("bill");
    });

    it("should route SALN documents to SALN extractor", async () => {
      const doc = createMockSALNDocument();

      const result = await processDocument(doc);

      expect(result.documentType).toBe("saln");
    });

    it("should route resolution documents to bill extractor", async () => {
      const doc = createMockDocument("resolution", "Resolution content");

      const result = await processDocument(doc);

      expect(result.documentType).toBe("bill");
    });

    it("should throw for unsupported document types", async () => {
      const doc = createMockDocument("coa_report" as DocumentType, "COA content");

      await expect(processDocument(doc)).rejects.toThrow(DocumentParserError);
    });
  });
});

// ============================================
// Auto-Publish and Summary Tests
// ============================================

describe("Auto-Publish Logic", () => {
  describe("canAutoPublish", () => {
    it("should allow auto-publish for high confidence successful extraction", () => {
      const result: DocumentExtractionResult<ExtractedBillData> = {
        documentId: "doc-1",
        documentType: "bill",
        status: "success",
        data: {
          billNumber: "SB-1234",
          title: "Test Bill",
          summary: "Test summary",
        },
        confidenceScores: [],
        overallConfidence: 0.9,
        lowConfidenceFields: [],
        needsManualReview: false,
        processingTimeMs: 100,
        modelUsed: "Test Model",
        errors: [],
        warnings: [],
      };

      expect(canAutoPublish(result)).toBe(true);
    });

    it("should not allow auto-publish for low confidence", () => {
      const result: DocumentExtractionResult<ExtractedBillData> = {
        documentId: "doc-1",
        documentType: "bill",
        status: "success",
        data: null,
        confidenceScores: [],
        overallConfidence: 0.6,
        lowConfidenceFields: [],
        needsManualReview: false,
        processingTimeMs: 100,
        modelUsed: "Test Model",
        errors: [],
        warnings: [],
      };

      expect(canAutoPublish(result)).toBe(false);
    });

    it("should not allow auto-publish with low confidence fields", () => {
      const result: DocumentExtractionResult<ExtractedBillData> = {
        documentId: "doc-1",
        documentType: "bill",
        status: "success",
        data: null,
        confidenceScores: [],
        overallConfidence: 0.9,
        lowConfidenceFields: ["authors"],
        needsManualReview: false,
        processingTimeMs: 100,
        modelUsed: "Test Model",
        errors: [],
        warnings: [],
      };

      expect(canAutoPublish(result)).toBe(false);
    });

    it("should not allow auto-publish with errors", () => {
      const result: DocumentExtractionResult<ExtractedBillData> = {
        documentId: "doc-1",
        documentType: "bill",
        status: "success",
        data: null,
        confidenceScores: [],
        overallConfidence: 0.9,
        lowConfidenceFields: [],
        needsManualReview: false,
        processingTimeMs: 100,
        modelUsed: "Test Model",
        errors: ["Some error"],
        warnings: [],
      };

      expect(canAutoPublish(result)).toBe(false);
    });

    it("should not allow auto-publish when manual review is required", () => {
      const result: DocumentExtractionResult<ExtractedBillData> = {
        documentId: "doc-1",
        documentType: "bill",
        status: "success",
        data: null,
        confidenceScores: [],
        overallConfidence: 0.9,
        lowConfidenceFields: [],
        needsManualReview: true,
        processingTimeMs: 100,
        modelUsed: "Test Model",
        errors: [],
        warnings: [],
      };

      expect(canAutoPublish(result)).toBe(false);
    });

    it("should not allow auto-publish for failed status", () => {
      const result: DocumentExtractionResult<ExtractedBillData> = {
        documentId: "doc-1",
        documentType: "bill",
        status: "failed",
        data: null,
        confidenceScores: [],
        overallConfidence: 0.9,
        lowConfidenceFields: [],
        needsManualReview: false,
        processingTimeMs: 100,
        modelUsed: "Test Model",
        errors: [],
        warnings: [],
      };

      expect(canAutoPublish(result)).toBe(false);
    });
  });

  describe("getExtractionSummary", () => {
    it("should return summary for successful extraction", () => {
      const result: DocumentExtractionResult<ExtractedBillData> = {
        documentId: "doc-1",
        documentType: "bill",
        status: "success",
        data: null,
        confidenceScores: [],
        overallConfidence: 0.9,
        lowConfidenceFields: [],
        needsManualReview: false,
        processingTimeMs: 100,
        modelUsed: "Test Model",
        errors: [],
        warnings: [],
      };

      const summary = getExtractionSummary(result);

      expect(summary.canPublish).toBe(true);
      expect(summary.needsReview).toBe(false);
      expect(summary.confidence).toBe(0.9);
      expect(summary.reviewReasons).toHaveLength(0);
    });

    it("should list review reasons for low confidence", () => {
      const result: DocumentExtractionResult<ExtractedBillData> = {
        documentId: "doc-1",
        documentType: "bill",
        status: "partial",
        data: null,
        confidenceScores: [],
        overallConfidence: 0.6,
        lowConfidenceFields: ["authors", "filingDate"],
        needsManualReview: true,
        processingTimeMs: 100,
        modelUsed: "Test Model",
        errors: [],
        warnings: ["Some warning"],
      };

      const summary = getExtractionSummary(result);

      expect(summary.canPublish).toBe(false);
      expect(summary.needsReview).toBe(true);
      expect(summary.reviewReasons.length).toBeGreaterThan(0);
      expect(summary.reviewReasons.some((r) => r.includes("confidence"))).toBe(true);
    });

    it("should include error count in review reasons", () => {
      const result: DocumentExtractionResult<ExtractedBillData> = {
        documentId: "doc-1",
        documentType: "bill",
        status: "failed",
        data: null,
        confidenceScores: [],
        overallConfidence: 0,
        lowConfidenceFields: [],
        needsManualReview: true,
        processingTimeMs: 100,
        modelUsed: "Test Model",
        errors: ["Error 1", "Error 2"],
        warnings: [],
      };

      const summary = getExtractionSummary(result);

      expect(summary.reviewReasons.some((r) => r.includes("errors"))).toBe(true);
    });
  });
});

// ============================================
// Constants Tests
// ============================================

describe("Constants", () => {
  it("should have valid confidence thresholds", () => {
    expect(CONFIDENCE_THRESHOLD).toBeGreaterThan(0);
    expect(CONFIDENCE_THRESHOLD).toBeLessThanOrEqual(1);
    expect(LOW_CONFIDENCE_THRESHOLD).toBeLessThan(CONFIDENCE_THRESHOLD);
    expect(AUTO_PUBLISH_THRESHOLD).toBeGreaterThan(CONFIDENCE_THRESHOLD);
  });

  it("should have bill field weights between 0 and 1", () => {
    for (const weight of Object.values(BILL_FIELD_WEIGHTS)) {
      expect(weight).toBeGreaterThan(0);
      expect(weight).toBeLessThanOrEqual(1);
    }
  });

  it("should have SALN field weights between 0 and 1", () => {
    for (const weight of Object.values(SALN_FIELD_WEIGHTS)) {
      expect(weight).toBeGreaterThan(0);
      expect(weight).toBeLessThanOrEqual(1);
    }
  });

  it("should weight critical fields higher", () => {
    expect(BILL_FIELD_WEIGHTS.billNumber).toBeGreaterThanOrEqual(BILL_FIELD_WEIGHTS.summary!);
    expect(SALN_FIELD_WEIGHTS.politicianName).toBeGreaterThanOrEqual(
      SALN_FIELD_WEIGHTS.investments!
    );
  });
});

// ============================================
// Error Handling Tests
// ============================================

describe("Error Handling", () => {
  it("should create DocumentParserError with correct code", () => {
    const error = new DocumentParserError("Test error", "INVALID_DOCUMENT");

    expect(error.name).toBe("DocumentParserError");
    expect(error.code).toBe("INVALID_DOCUMENT");
    expect(error.message).toBe("Test error");
  });

  it("should handle extraction errors gracefully", async () => {
    // Create a document that will cause parsing issues
    const doc: RawDocument = {
      id: "bad-doc",
      type: "bill",
      filename: "bad.pdf",
      content: "", // Empty content
      uploadedAt: new Date(),
    };

    const result = await extractBillData(doc);

    expect(result.status).toBe("failed");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.needsManualReview).toBe(true);
  });
});
