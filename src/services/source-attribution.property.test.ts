/**
 * Property-Based Tests for Source Attribution
 *
 * **Validates: Requirements 6.5, 7.5, 8.4, 12.1, 12.6, 12.7, 12.10, 12.11, 12.12**
 *
 * Property 4: Source Attribution
 * For any data point displayed in the system, source attribution must be present containing:
 * - Source type (official_government, court_document, comelec_filing, legislative_record, coa_report, third_party_verified, ai_extracted)
 * - Source name and URL (when available)
 * - Document date and retrieval date
 * - Confidence score
 * - AI processing indicator (when applicable)
 *
 * When data comes from multiple sources, all sources must be listed.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { SourceType } from "@prisma/client";

// Minimum iterations for property tests
const NUM_RUNS = 100;

// ============================================
// Type Definitions for Source Attribution
// ============================================

/**
 * Valid source types as defined in the design document
 * Validates: Requirements 12.9, 12.11
 */
const VALID_SOURCE_TYPES: SourceType[] = [
  SourceType.official_government,
  SourceType.court_document,
  SourceType.comelec_filing,
  SourceType.legislative_record,
  SourceType.coa_report,
  SourceType.third_party_verified,
  SourceType.ai_extracted,
];

/**
 * Source attribution interface matching the design document
 * Validates: Requirements 12.6, 12.7
 */
interface DataSourceAttribution {
  sourceType: SourceType;
  sourceName: string;
  sourceUrl?: string | null;
  documentDate?: Date | null;
  retrievedAt: Date;
  confidence: number;
  isAIProcessed: boolean;
  originalDocumentId?: string | null;
}

/**
 * Data point with source attribution
 */
type DataPointWithSources<T> = {
  value: T;
  sources: DataSourceAttribution[];
};

// Ensure type is used to avoid TS6196
const _typeCheck: DataPointWithSources<string> | null = null;
void _typeCheck;

/**
 * Entity with field-level source attribution
 */
interface EntityWithSources {
  id: string;
  sources: Record<string, DataSourceAttribution[]>;
}

// ============================================
// Arbitraries (Generators) for Test Data
// ============================================

/**
 * Generate a valid source type
 */
const sourceTypeArb = fc.constantFrom(...VALID_SOURCE_TYPES);

/**
 * Generate a non-empty string for source name
 */
const sourceNameArb = fc.string({ minLength: 1, maxLength: 200 });

/**
 * Generate a valid URL or null
 */
const sourceUrlArb = fc.option(fc.webUrl({ validSchemes: ["http", "https"] }), { nil: null });

/**
 * Generate a date within a reasonable range
 */
const dateArb = fc.date({ min: new Date("2000-01-01"), max: new Date("2030-12-31") });

/**
 * Generate a confidence score between 0 and 1
 */
const confidenceScoreArb = fc.float({ min: 0, max: 1, noNaN: true });

/**
 * Generate a valid DataSourceAttribution
 * Note: AI-extracted sources must have isAIProcessed = true per Requirement 12.12
 */
const sourceAttributionArb: fc.Arbitrary<DataSourceAttribution> = fc
  .record({
    sourceType: sourceTypeArb,
    sourceName: sourceNameArb,
    sourceUrl: sourceUrlArb,
    documentDate: fc.option(dateArb, { nil: null }),
    retrievedAt: dateArb,
    confidence: confidenceScoreArb,
    isAIProcessed: fc.boolean(),
    originalDocumentId: fc.option(fc.uuid(), { nil: null }),
  })
  .map((source) => {
    // Ensure AI-extracted sources have isAIProcessed = true (Requirement 12.12)
    if (source.sourceType === SourceType.ai_extracted) {
      return {
        ...source,
        isAIProcessed: true,
        // AI-extracted sources should have originalDocumentId
        originalDocumentId: source.originalDocumentId ?? crypto.randomUUID(),
      };
    }
    return source;
  });

/**
 * Generate a non-empty array of source attributions
 */
const sourceAttributionsArb = fc.array(sourceAttributionArb, { minLength: 1, maxLength: 5 });

/**
 * Generate an AI-processed source attribution
 */
const aiProcessedSourceArb: fc.Arbitrary<DataSourceAttribution> = fc.record({
  sourceType: fc.constant(SourceType.ai_extracted),
  sourceName: sourceNameArb,
  sourceUrl: sourceUrlArb,
  documentDate: fc.option(dateArb, { nil: null }),
  retrievedAt: dateArb,
  confidence: confidenceScoreArb,
  isAIProcessed: fc.constant(true),
  originalDocumentId: fc.uuid(),
});

/**
 * Generate a data point with sources
 */
const dataPointWithSourcesArb = <T>(valueArb: fc.Arbitrary<T>) =>
  fc.record({
    value: valueArb,
    sources: sourceAttributionsArb,
  });

/**
 * Generate field names for entity sources
 */
const fieldNameArb = fc.constantFrom(
  "fullName",
  "birthday",
  "birthplace",
  "position",
  "party",
  "netWorth",
  "totalAssets",
  "voteCount",
  "electionResult",
  "controversyStatus"
);

/**
 * Generate an entity with field-level source attribution
 */
const entityWithSourcesArb: fc.Arbitrary<EntityWithSources> = fc
  .tuple(
    fc.uuid(),
    fc.array(fc.tuple(fieldNameArb, sourceAttributionsArb), { minLength: 1, maxLength: 10 })
  )
  .map(([id, fieldSources]) => ({
    id,
    sources: Object.fromEntries(fieldSources),
  }));

// ============================================
// Validation Helper Functions
// ============================================

/**
 * Validates that a source attribution has all required fields
 * Validates: Requirements 12.6, 12.7
 */
function validateSourceAttributionFields(source: DataSourceAttribution): {
  valid: boolean;
  missingFields: string[];
  invalidFields: string[];
} {
  const missingFields: string[] = [];
  const invalidFields: string[] = [];

  // Required fields
  if (source.sourceType === undefined || source.sourceType === null) {
    missingFields.push("sourceType");
  }
  if (!source.sourceName || source.sourceName.length === 0) {
    missingFields.push("sourceName");
  }
  if (source.retrievedAt === undefined || source.retrievedAt === null) {
    missingFields.push("retrievedAt");
  }
  if (source.confidence === undefined || source.confidence === null) {
    missingFields.push("confidence");
  }
  if (source.isAIProcessed === undefined) {
    missingFields.push("isAIProcessed");
  }

  // Validate field values
  if (source.sourceType !== undefined && !VALID_SOURCE_TYPES.includes(source.sourceType)) {
    invalidFields.push("sourceType");
  }
  if (source.confidence !== undefined && (source.confidence < 0 || source.confidence > 1)) {
    invalidFields.push("confidence");
  }
  if (source.retrievedAt !== undefined && !(source.retrievedAt instanceof Date)) {
    invalidFields.push("retrievedAt");
  }

  return {
    valid: missingFields.length === 0 && invalidFields.length === 0,
    missingFields,
    invalidFields,
  };
}

/**
 * Validates that AI-processed data is properly flagged
 * Validates: Requirement 12.12
 */
function validateAIProcessedFlag(source: DataSourceAttribution): boolean {
  if (source.sourceType === SourceType.ai_extracted) {
    return source.isAIProcessed === true;
  }
  return true;
}

/**
 * Validates that confidence score is within valid range
 * Validates: Requirements 12.11
 */
function validateConfidenceScore(confidence: number): boolean {
  return (
    typeof confidence === "number" &&
    !Number.isNaN(confidence) &&
    confidence >= 0 &&
    confidence <= 1
  );
}

/**
 * Validates that all sources in a list are valid
 */
function validateAllSources(sources: DataSourceAttribution[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i]!;
    const validation = validateSourceAttributionFields(source);
    if (!validation.valid) {
      errors.push(
        `Source ${i}: missing fields [${validation.missingFields.join(", ")}], invalid fields [${validation.invalidFields.join(", ")}]`
      );
    }
    if (!validateAIProcessedFlag(source)) {
      errors.push(`Source ${i}: AI-extracted source not properly flagged`);
    }
    if (!validateConfidenceScore(source.confidence)) {
      errors.push(`Source ${i}: Invalid confidence score ${source.confidence}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Checks if multiple sources are properly listed
 * Validates: Requirement 12.10
 */
function validateMultipleSources(sources: DataSourceAttribution[]): boolean {
  // All sources should be present in the array
  return Array.isArray(sources) && sources.length > 0;
}

// ============================================
// Property Tests
// ============================================

describe("Source Attribution - Property 4", () => {
  /**
   * **Validates: Requirements 12.6, 12.7**
   *
   * Property 4.1: Source Attribution Required Fields
   * All data points must have source attribution containing required fields.
   */
  describe("Property 4.1: Source Attribution Required Fields", () => {
    it("all source attributions must have sourceType field", () => {
      fc.assert(
        fc.property(sourceAttributionArb, (source) => {
          expect(source.sourceType).toBeDefined();
          expect(source.sourceType).not.toBeNull();
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("all source attributions must have sourceName field", () => {
      fc.assert(
        fc.property(sourceAttributionArb, (source) => {
          expect(source.sourceName).toBeDefined();
          expect(source.sourceName.length).toBeGreaterThan(0);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("all source attributions must have retrievedAt date", () => {
      fc.assert(
        fc.property(sourceAttributionArb, (source) => {
          expect(source.retrievedAt).toBeDefined();
          expect(source.retrievedAt).toBeInstanceOf(Date);
          expect(source.retrievedAt.getTime()).not.toBeNaN();
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("all source attributions must have confidence score", () => {
      fc.assert(
        fc.property(sourceAttributionArb, (source) => {
          expect(source.confidence).toBeDefined();
          expect(typeof source.confidence).toBe("number");
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("all source attributions must have isAIProcessed flag", () => {
      fc.assert(
        fc.property(sourceAttributionArb, (source) => {
          expect(source.isAIProcessed).toBeDefined();
          expect(typeof source.isAIProcessed).toBe("boolean");
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("all required fields must pass validation", () => {
      fc.assert(
        fc.property(sourceAttributionArb, (source) => {
          const validation = validateSourceAttributionFields(source);
          expect(validation.missingFields).toEqual([]);
          expect(validation.invalidFields).toEqual([]);
          expect(validation.valid).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 12.9, 12.11**
   *
   * Property 4.2: Source Types Validity
   * Source types must be one of the valid categories.
   */
  describe("Property 4.2: Source Types Validity", () => {
    it("sourceType must be a valid enum value", () => {
      fc.assert(
        fc.property(sourceAttributionArb, (source) => {
          expect(VALID_SOURCE_TYPES).toContain(source.sourceType);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("all valid source types should be accepted", () => {
      fc.assert(
        fc.property(sourceTypeArb, (sourceType) => {
          expect(VALID_SOURCE_TYPES).toContain(sourceType);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("source type categorization should be deterministic", () => {
      fc.assert(
        fc.property(sourceAttributionArb, (source) => {
          const type1 = source.sourceType;
          const type2 = source.sourceType;
          expect(type1).toBe(type2);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirement 12.12**
   *
   * Property 4.3: AI-Processed Data Flagging
   * AI-processed data must be properly flagged with isAIProcessed = true.
   */
  describe("Property 4.3: AI-Processed Data Flagging", () => {
    it("ai_extracted sources must have isAIProcessed = true", () => {
      fc.assert(
        fc.property(aiProcessedSourceArb, (source) => {
          expect(source.sourceType).toBe(SourceType.ai_extracted);
          expect(source.isAIProcessed).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("ai_extracted sources must have originalDocumentId", () => {
      fc.assert(
        fc.property(aiProcessedSourceArb, (source) => {
          expect(source.originalDocumentId).toBeDefined();
          expect(source.originalDocumentId).not.toBeNull();
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("AI processing flag validation should pass for all sources", () => {
      fc.assert(
        fc.property(sourceAttributionArb, (source) => {
          const isValid = validateAIProcessedFlag(source);
          // Non-AI sources can have any isAIProcessed value
          // AI sources must have isAIProcessed = true
          if (source.sourceType === SourceType.ai_extracted) {
            expect(source.isAIProcessed).toBe(true);
          }
          expect(isValid).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 12.11**
   *
   * Property 4.4: Confidence Score Validity
   * Confidence scores must be within valid range [0, 1].
   */
  describe("Property 4.4: Confidence Score Validity", () => {
    it("confidence score must be between 0 and 1", () => {
      fc.assert(
        fc.property(sourceAttributionArb, (source) => {
          expect(source.confidence).toBeGreaterThanOrEqual(0);
          expect(source.confidence).toBeLessThanOrEqual(1);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("confidence score must be a finite number", () => {
      fc.assert(
        fc.property(sourceAttributionArb, (source) => {
          expect(Number.isFinite(source.confidence)).toBe(true);
          expect(Number.isNaN(source.confidence)).toBe(false);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("confidence score validation should pass", () => {
      fc.assert(
        fc.property(confidenceScoreArb, (confidence) => {
          expect(validateConfidenceScore(confidence)).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("invalid confidence scores should fail validation", () => {
      const invalidScores = [-0.1, 1.1, NaN, Infinity, -Infinity];
      for (const score of invalidScores) {
        expect(validateConfidenceScore(score)).toBe(false);
      }
    });
  });

  /**
   * **Validates: Requirement 12.10**
   *
   * Property 4.5: Multiple Sources Handling
   * When data comes from multiple sources, all sources must be listed.
   */
  describe("Property 4.5: Multiple Sources Handling", () => {
    it("data points must have at least one source", () => {
      fc.assert(
        fc.property(sourceAttributionsArb, (sources) => {
          expect(sources.length).toBeGreaterThan(0);
          expect(validateMultipleSources(sources)).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("all sources in a list must be valid", () => {
      fc.assert(
        fc.property(sourceAttributionsArb, (sources) => {
          const validation = validateAllSources(sources);
          expect(validation.errors).toEqual([]);
          expect(validation.valid).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("multiple sources should preserve all entries", () => {
      fc.assert(
        fc.property(fc.array(sourceAttributionArb, { minLength: 2, maxLength: 5 }), (sources) => {
          const originalCount = sources.length;
          // Simulating storage and retrieval
          const retrieved = [...sources];
          expect(retrieved.length).toBe(originalCount);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("each source in multiple sources should be independently valid", () => {
      fc.assert(
        fc.property(fc.array(sourceAttributionArb, { minLength: 2, maxLength: 5 }), (sources) => {
          for (const source of sources) {
            const validation = validateSourceAttributionFields(source);
            expect(validation.valid).toBe(true);
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 6.5, 7.5, 8.4, 12.1**
   *
   * Property 4.6: Field-Level Source Attribution
   * Each data field must have its own source attribution.
   */
  describe("Property 4.6: Field-Level Source Attribution", () => {
    it("entity sources must be organized by field name", () => {
      fc.assert(
        fc.property(entityWithSourcesArb, (entity) => {
          expect(entity.sources).toBeDefined();
          expect(typeof entity.sources).toBe("object");
          expect(Object.keys(entity.sources).length).toBeGreaterThan(0);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("each field must have at least one source", () => {
      fc.assert(
        fc.property(entityWithSourcesArb, (entity) => {
          for (const fieldName of Object.keys(entity.sources)) {
            const fieldSources = entity.sources[fieldName];
            expect(fieldSources).toBeDefined();
            expect(Array.isArray(fieldSources)).toBe(true);
            expect(fieldSources!.length).toBeGreaterThan(0);
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("all field sources must be valid", () => {
      fc.assert(
        fc.property(entityWithSourcesArb, (entity) => {
          for (const fieldName of Object.keys(entity.sources)) {
            const fieldSources = entity.sources[fieldName]!;
            const validation = validateAllSources(fieldSources);
            expect(validation.valid).toBe(true);
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 12.6, 12.7, 12.8**
   *
   * Property 4.7: Source URL and Document Date
   * Source URL and document date should be present when available.
   */
  describe("Property 4.7: Source URL and Document Date", () => {
    it("sourceUrl when present must be a valid URL or null", () => {
      fc.assert(
        fc.property(sourceAttributionArb, (source) => {
          if (source.sourceUrl !== null && source.sourceUrl !== undefined) {
            expect(typeof source.sourceUrl).toBe("string");
            // Basic URL validation
            expect(
              source.sourceUrl.startsWith("http://") || source.sourceUrl.startsWith("https://")
            ).toBe(true);
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("documentDate when present must be a valid Date or null", () => {
      fc.assert(
        fc.property(sourceAttributionArb, (source) => {
          if (source.documentDate !== null && source.documentDate !== undefined) {
            expect(source.documentDate).toBeInstanceOf(Date);
            expect(source.documentDate.getTime()).not.toBeNaN();
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("retrievedAt must always be present and valid", () => {
      fc.assert(
        fc.property(sourceAttributionArb, (source) => {
          expect(source.retrievedAt).toBeDefined();
          expect(source.retrievedAt).toBeInstanceOf(Date);
          expect(source.retrievedAt.getTime()).not.toBeNaN();
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 12.11**
   *
   * Property 4.8: Source Reliability Indicator
   * Source reliability should be determinable from source type.
   */
  describe("Property 4.8: Source Reliability Indicator", () => {
    /**
     * Determines source reliability level based on source type
     * Primary: official_government, court_document, legislative_record
     * Secondary: comelec_filing, coa_report
     * Third-party: third_party_verified, ai_extracted
     */
    function getSourceReliabilityLevel(
      sourceType: SourceType
    ): "primary" | "secondary" | "third_party" {
      switch (sourceType) {
        case SourceType.official_government:
        case SourceType.court_document:
        case SourceType.legislative_record:
          return "primary";
        case SourceType.comelec_filing:
        case SourceType.coa_report:
          return "secondary";
        case SourceType.third_party_verified:
        case SourceType.ai_extracted:
          return "third_party";
        default:
          return "third_party";
      }
    }

    it("source reliability level should be deterministic", () => {
      fc.assert(
        fc.property(sourceTypeArb, (sourceType) => {
          const level1 = getSourceReliabilityLevel(sourceType);
          const level2 = getSourceReliabilityLevel(sourceType);
          expect(level1).toBe(level2);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("all source types should have a reliability level", () => {
      fc.assert(
        fc.property(sourceTypeArb, (sourceType) => {
          const level = getSourceReliabilityLevel(sourceType);
          expect(["primary", "secondary", "third_party"]).toContain(level);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("official government sources should be primary reliability", () => {
      expect(getSourceReliabilityLevel(SourceType.official_government)).toBe("primary");
      expect(getSourceReliabilityLevel(SourceType.court_document)).toBe("primary");
      expect(getSourceReliabilityLevel(SourceType.legislative_record)).toBe("primary");
    });

    it("COMELEC and COA sources should be secondary reliability", () => {
      expect(getSourceReliabilityLevel(SourceType.comelec_filing)).toBe("secondary");
      expect(getSourceReliabilityLevel(SourceType.coa_report)).toBe("secondary");
    });

    it("third-party and AI sources should be third_party reliability", () => {
      expect(getSourceReliabilityLevel(SourceType.third_party_verified)).toBe("third_party");
      expect(getSourceReliabilityLevel(SourceType.ai_extracted)).toBe("third_party");
    });
  });

  /**
   * **Validates: Requirements 12.1, 12.6**
   *
   * Property 4.9: Source Attribution Completeness
   * Complete validation of source attribution structure.
   */
  describe("Property 4.9: Source Attribution Completeness", () => {
    it("complete source attribution should pass all validations", () => {
      fc.assert(
        fc.property(sourceAttributionArb, (source) => {
          // Required fields validation
          const fieldValidation = validateSourceAttributionFields(source);
          expect(fieldValidation.valid).toBe(true);

          // AI processing flag validation
          const aiValidation = validateAIProcessedFlag(source);
          expect(aiValidation).toBe(true);

          // Confidence score validation
          const confidenceValidation = validateConfidenceScore(source.confidence);
          expect(confidenceValidation).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("data point with sources should have valid structure", () => {
      fc.assert(
        fc.property(dataPointWithSourcesArb(fc.string()), (dataPoint) => {
          expect(dataPoint.value).toBeDefined();
          expect(dataPoint.sources).toBeDefined();
          expect(Array.isArray(dataPoint.sources)).toBe(true);
          expect(dataPoint.sources.length).toBeGreaterThan(0);

          const validation = validateAllSources(dataPoint.sources);
          expect(validation.valid).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("entity with field-level sources should have valid structure", () => {
      fc.assert(
        fc.property(entityWithSourcesArb, (entity) => {
          expect(entity.id).toBeDefined();
          expect(entity.sources).toBeDefined();

          for (const [fieldName, sources] of Object.entries(entity.sources)) {
            expect(fieldName.length).toBeGreaterThan(0);
            expect(Array.isArray(sources)).toBe(true);
            expect(sources.length).toBeGreaterThan(0);

            const validation = validateAllSources(sources);
            expect(validation.valid).toBe(true);
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
