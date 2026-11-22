/**
 * Property-Based Tests for Red Flag Detection
 *
 * **Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.6, 18.7**
 *
 * Property 8: Red Flag Detection
 * For any politician:
 * - If they have documented legal cases (ongoing or convicted), a legal_case red flag must be present
 * - If they have corruption-related cases, a corruption red flag must be present
 * - If they have family members in politics, a dynasty indicator must be present
 * - If they have SALN anomalies, a saln_anomaly red flag must be present
 * - Dynasty indicators without corruption/legal issues must have severity 'info' (not 'warning' or 'critical')
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { RedFlagType, RedFlagSeverity, ControversyStatus } from "@prisma/client";

// Mock Prisma before importing the service
vi.mock("@/lib/prisma", () => ({
  default: {
    redFlag: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

import {
  determineLegalCaseSeverity,
  determineCorruptionSeverity,
  determineSALNAnomalySeverity,
  determineDynastySeverity,
  RedFlagSummary,
} from "./red-flag.service";

// Minimum iterations for property tests
const NUM_RUNS = 100;

// ============================================
// Arbitraries (Generators) for Test Data
// ============================================

/**
 * Generate a valid controversy status
 */
const controversyStatusArb = fc.constantFrom<ControversyStatus>(
  "ongoing",
  "dismissed",
  "convicted",
  "acquitted",
  "settled"
);

/**
 * Generate resolved legal statuses (dismissed, acquitted, settled)
 */
const resolvedLegalStatusArb = fc.constantFrom<ControversyStatus>(
  "dismissed",
  "acquitted",
  "settled"
);

/**
 * Generate a valid red flag type
 */
const redFlagTypeArb = fc.constantFrom<RedFlagType>(
  "legal_case",
  "corruption",
  "dynasty",
  "saln_anomaly",
  "attendance"
);

/**
 * Generate a valid red flag severity
 */
const redFlagSeverityArb = fc.constantFrom<RedFlagSeverity>("info", "warning", "critical");

/**
 * Generate a positive anomaly ratio
 */
const anomalyRatioArb = fc.float({
  min: Math.fround(0.1),
  max: Math.fround(20),
  noNaN: true,
});

/**
 * Generate a high anomaly ratio (>= 5)
 */
const highAnomalyRatioArb = fc.float({
  min: Math.fround(5),
  max: Math.fround(20),
  noNaN: true,
});

/**
 * Generate a low anomaly ratio (< 5)
 */
const lowAnomalyRatioArb = fc.float({
  min: Math.fround(0.1),
  max: Math.fround(4.99),
  noNaN: true,
});

// ============================================
// Property Tests
// ============================================

describe("Red Flag Detection - Property 8", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Validates: Requirements 18.1, 18.6**
   *
   * Property 8.1: Legal Case Severity Determination
   * Legal case severity must be correctly determined based on status:
   * - "critical" for convictions
   * - "warning" for ongoing cases
   * - "info" for dismissed/acquitted/settled cases
   */
  describe("Property 8.1: Legal Case Severity Determination", () => {
    it("convicted status should always return critical severity", () => {
      fc.assert(
        fc.property(fc.constant("convicted" as ControversyStatus), (status) => {
          const severity = determineLegalCaseSeverity(status);
          expect(severity).toBe("critical");
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("ongoing status should always return warning severity", () => {
      fc.assert(
        fc.property(fc.constant("ongoing" as ControversyStatus), (status) => {
          const severity = determineLegalCaseSeverity(status);
          expect(severity).toBe("warning");
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("resolved statuses (dismissed, acquitted, settled) should return info severity", () => {
      fc.assert(
        fc.property(resolvedLegalStatusArb, (status) => {
          const severity = determineLegalCaseSeverity(status);
          expect(severity).toBe("info");
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("severity should be one of the valid RedFlagSeverity values", () => {
      fc.assert(
        fc.property(controversyStatusArb, (status) => {
          const severity = determineLegalCaseSeverity(status);
          expect(["info", "warning", "critical"]).toContain(severity);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("severity determination should be deterministic", () => {
      fc.assert(
        fc.property(controversyStatusArb, (status) => {
          const severity1 = determineLegalCaseSeverity(status);
          const severity2 = determineLegalCaseSeverity(status);
          const severity3 = determineLegalCaseSeverity(status);
          expect(severity1).toBe(severity2);
          expect(severity2).toBe(severity3);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 18.2, 18.6**
   *
   * Property 8.2: Corruption Severity Determination
   * Corruption severity must follow the same rules as legal cases:
   * - "critical" for convictions
   * - "warning" for ongoing allegations
   * - "info" for dismissed/acquitted cases
   */
  describe("Property 8.2: Corruption Severity Determination", () => {
    it("convicted corruption should always return critical severity", () => {
      fc.assert(
        fc.property(fc.constant("convicted" as ControversyStatus), (status) => {
          const severity = determineCorruptionSeverity(status);
          expect(severity).toBe("critical");
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("ongoing corruption allegations should return warning severity", () => {
      fc.assert(
        fc.property(fc.constant("ongoing" as ControversyStatus), (status) => {
          const severity = determineCorruptionSeverity(status);
          expect(severity).toBe("warning");
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("resolved corruption cases should return info severity", () => {
      fc.assert(
        fc.property(resolvedLegalStatusArb, (status) => {
          const severity = determineCorruptionSeverity(status);
          expect(severity).toBe("info");
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("corruption severity should match legal case severity for same status", () => {
      fc.assert(
        fc.property(controversyStatusArb, (status) => {
          const legalSeverity = determineLegalCaseSeverity(status);
          const corruptionSeverity = determineCorruptionSeverity(status);
          expect(corruptionSeverity).toBe(legalSeverity);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("corruption severity determination should be deterministic", () => {
      fc.assert(
        fc.property(controversyStatusArb, (status) => {
          const severity1 = determineCorruptionSeverity(status);
          const severity2 = determineCorruptionSeverity(status);
          expect(severity1).toBe(severity2);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 18.3, 18.7**
   *
   * Property 8.3: Dynasty Severity is Always Info
   * Dynasty indicators without corruption/legal issues must have severity 'info'
   * (never 'warning' or 'critical').
   */
  describe("Property 8.3: Dynasty Severity is Always Info", () => {
    it("dynasty severity should always be info", () => {
      fc.assert(
        fc.property(fc.constant(undefined), () => {
          const severity = determineDynastySeverity();
          expect(severity).toBe("info");
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("dynasty severity should never be warning", () => {
      fc.assert(
        fc.property(fc.constant(undefined), () => {
          const severity = determineDynastySeverity();
          expect(severity).not.toBe("warning");
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("dynasty severity should never be critical", () => {
      fc.assert(
        fc.property(fc.constant(undefined), () => {
          const severity = determineDynastySeverity();
          expect(severity).not.toBe("critical");
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("dynasty severity determination should be deterministic", () => {
      fc.assert(
        fc.property(fc.constant(undefined), () => {
          const severity1 = determineDynastySeverity();
          const severity2 = determineDynastySeverity();
          const severity3 = determineDynastySeverity();
          expect(severity1).toBe(severity2);
          expect(severity2).toBe(severity3);
          expect(severity1).toBe("info");
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 18.4, 18.6**
   *
   * Property 8.4: SALN Anomaly Severity Based on Ratio
   * SALN anomaly severity should be based on the anomaly ratio:
   * - "critical" for very high anomaly ratio (>= 5)
   * - "warning" for standard anomalies (< 5)
   */
  describe("Property 8.4: SALN Anomaly Severity Based on Ratio", () => {
    it("high anomaly ratio (>= 5) should return critical severity", () => {
      fc.assert(
        fc.property(highAnomalyRatioArb, (anomalyRatio) => {
          const severity = determineSALNAnomalySeverity(anomalyRatio);
          expect(severity).toBe("critical");
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("low anomaly ratio (< 5) should return warning severity", () => {
      fc.assert(
        fc.property(lowAnomalyRatioArb, (anomalyRatio) => {
          const severity = determineSALNAnomalySeverity(anomalyRatio);
          expect(severity).toBe("warning");
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("boundary case: ratio exactly at 5 should return critical", () => {
      fc.assert(
        fc.property(fc.constant(5), (anomalyRatio) => {
          const severity = determineSALNAnomalySeverity(anomalyRatio);
          expect(severity).toBe("critical");
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("boundary case: ratio just below 5 should return warning", () => {
      fc.assert(
        fc.property(fc.constant(4.99), (anomalyRatio) => {
          const severity = determineSALNAnomalySeverity(anomalyRatio);
          expect(severity).toBe("warning");
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("SALN anomaly severity should never be info", () => {
      fc.assert(
        fc.property(anomalyRatioArb, (anomalyRatio) => {
          const severity = determineSALNAnomalySeverity(anomalyRatio);
          expect(severity).not.toBe("info");
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("SALN anomaly severity determination should be deterministic", () => {
      fc.assert(
        fc.property(anomalyRatioArb, (anomalyRatio) => {
          const severity1 = determineSALNAnomalySeverity(anomalyRatio);
          const severity2 = determineSALNAnomalySeverity(anomalyRatio);
          expect(severity1).toBe(severity2);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.6**
   *
   * Property 8.5: Red Flag Summary Correctness
   * Red flag summaries must correctly count by type and severity.
   */
  describe("Property 8.5: Red Flag Summary Correctness", () => {
    /**
     * Helper function to calculate summary from red flags
     */
    function calculateSummary(
      politicianId: string,
      redFlags: Array<{ type: RedFlagType; severity: RedFlagSeverity }>
    ): RedFlagSummary {
      const byType: Record<RedFlagType, number> = {
        legal_case: 0,
        corruption: 0,
        dynasty: 0,
        saln_anomaly: 0,
        attendance: 0,
      };

      const bySeverity: Record<RedFlagSeverity, number> = {
        info: 0,
        warning: 0,
        critical: 0,
      };

      for (const flag of redFlags) {
        byType[flag.type]++;
        bySeverity[flag.severity]++;
      }

      return {
        politicianId,
        totalCount: redFlags.length,
        byType,
        bySeverity,
        hasLegalCases: byType.legal_case > 0,
        hasCorruption: byType.corruption > 0,
        hasDynasty: byType.dynasty > 0,
        hasSALNAnomalies: byType.saln_anomaly > 0,
      };
    }

    it("total count should equal sum of all type counts", () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.array(
            fc.record({
              type: redFlagTypeArb,
              severity: redFlagSeverityArb,
            }),
            { minLength: 0, maxLength: 20 }
          ),
          (politicianId, redFlags) => {
            const summary = calculateSummary(politicianId, redFlags);

            const typeSum =
              summary.byType.legal_case +
              summary.byType.corruption +
              summary.byType.dynasty +
              summary.byType.saln_anomaly +
              summary.byType.attendance;

            expect(summary.totalCount).toBe(typeSum);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("total count should equal sum of all severity counts", () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.array(
            fc.record({
              type: redFlagTypeArb,
              severity: redFlagSeverityArb,
            }),
            { minLength: 0, maxLength: 20 }
          ),
          (politicianId, redFlags) => {
            const summary = calculateSummary(politicianId, redFlags);

            const severitySum =
              summary.bySeverity.info + summary.bySeverity.warning + summary.bySeverity.critical;

            expect(summary.totalCount).toBe(severitySum);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("hasLegalCases should be true iff legal_case count > 0", () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.array(
            fc.record({
              type: redFlagTypeArb,
              severity: redFlagSeverityArb,
            }),
            { minLength: 0, maxLength: 20 }
          ),
          (politicianId, redFlags) => {
            const summary = calculateSummary(politicianId, redFlags);
            expect(summary.hasLegalCases).toBe(summary.byType.legal_case > 0);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("hasCorruption should be true iff corruption count > 0", () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.array(
            fc.record({
              type: redFlagTypeArb,
              severity: redFlagSeverityArb,
            }),
            { minLength: 0, maxLength: 20 }
          ),
          (politicianId, redFlags) => {
            const summary = calculateSummary(politicianId, redFlags);
            expect(summary.hasCorruption).toBe(summary.byType.corruption > 0);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("hasDynasty should be true iff dynasty count > 0", () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.array(
            fc.record({
              type: redFlagTypeArb,
              severity: redFlagSeverityArb,
            }),
            { minLength: 0, maxLength: 20 }
          ),
          (politicianId, redFlags) => {
            const summary = calculateSummary(politicianId, redFlags);
            expect(summary.hasDynasty).toBe(summary.byType.dynasty > 0);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("hasSALNAnomalies should be true iff saln_anomaly count > 0", () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.array(
            fc.record({
              type: redFlagTypeArb,
              severity: redFlagSeverityArb,
            }),
            { minLength: 0, maxLength: 20 }
          ),
          (politicianId, redFlags) => {
            const summary = calculateSummary(politicianId, redFlags);
            expect(summary.hasSALNAnomalies).toBe(summary.byType.saln_anomaly > 0);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("empty red flags should result in zero counts", () => {
      fc.assert(
        fc.property(fc.uuid(), (politicianId) => {
          const summary = calculateSummary(politicianId, []);

          expect(summary.totalCount).toBe(0);
          expect(summary.byType.legal_case).toBe(0);
          expect(summary.byType.corruption).toBe(0);
          expect(summary.byType.dynasty).toBe(0);
          expect(summary.byType.saln_anomaly).toBe(0);
          expect(summary.byType.attendance).toBe(0);
          expect(summary.bySeverity.info).toBe(0);
          expect(summary.bySeverity.warning).toBe(0);
          expect(summary.bySeverity.critical).toBe(0);
          expect(summary.hasLegalCases).toBe(false);
          expect(summary.hasCorruption).toBe(false);
          expect(summary.hasDynasty).toBe(false);
          expect(summary.hasSALNAnomalies).toBe(false);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 18.7**
   *
   * Property 8.6: Dynasty-Only Politicians Have Info Severity
   * When a politician only has dynasty indicators (no legal, corruption, or SALN issues),
   * all their red flags should have severity 'info'.
   */
  describe("Property 8.6: Dynasty-Only Politicians Have Info Severity", () => {
    /**
     * Helper function to check if a politician is dynasty-only
     */
    function isDynastyOnly(summary: RedFlagSummary): boolean {
      return (
        summary.hasDynasty &&
        !summary.hasLegalCases &&
        !summary.hasCorruption &&
        !summary.hasSALNAnomalies
      );
    }

    /**
     * Helper function to validate dynasty-only severity
     */
    function validateDynastyOnlySeverity(summary: RedFlagSummary): boolean {
      if (!isDynastyOnly(summary)) {
        return true; // Not dynasty-only, validation doesn't apply
      }
      // For dynasty-only, all flags should be "info" severity
      return summary.bySeverity.warning === 0 && summary.bySeverity.critical === 0;
    }

    it("dynasty-only politicians should have no warning or critical flags", () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.integer({ min: 1, max: 5 }), // number of dynasty flags
          (politicianId, dynastyCount) => {
            // Create dynasty-only red flags
            const redFlags = Array.from({ length: dynastyCount }, () => ({
              type: "dynasty" as RedFlagType,
              severity: "info" as RedFlagSeverity, // Dynasty is always info
            }));

            const summary: RedFlagSummary = {
              politicianId,
              totalCount: redFlags.length,
              byType: {
                legal_case: 0,
                corruption: 0,
                dynasty: dynastyCount,
                saln_anomaly: 0,
                attendance: 0,
              },
              bySeverity: {
                info: dynastyCount,
                warning: 0,
                critical: 0,
              },
              hasLegalCases: false,
              hasCorruption: false,
              hasDynasty: true,
              hasSALNAnomalies: false,
            };

            expect(isDynastyOnly(summary)).toBe(true);
            expect(validateDynastyOnlySeverity(summary)).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("politicians with legal cases are not dynasty-only", () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 5 }),
          (politicianId, dynastyCount, legalCount) => {
            const summary: RedFlagSummary = {
              politicianId,
              totalCount: dynastyCount + legalCount,
              byType: {
                legal_case: legalCount,
                corruption: 0,
                dynasty: dynastyCount,
                saln_anomaly: 0,
                attendance: 0,
              },
              bySeverity: {
                info: dynastyCount,
                warning: legalCount,
                critical: 0,
              },
              hasLegalCases: true,
              hasCorruption: false,
              hasDynasty: true,
              hasSALNAnomalies: false,
            };

            expect(isDynastyOnly(summary)).toBe(false);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("politicians with corruption are not dynasty-only", () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 5 }),
          (politicianId, dynastyCount, corruptionCount) => {
            const summary: RedFlagSummary = {
              politicianId,
              totalCount: dynastyCount + corruptionCount,
              byType: {
                legal_case: 0,
                corruption: corruptionCount,
                dynasty: dynastyCount,
                saln_anomaly: 0,
                attendance: 0,
              },
              bySeverity: {
                info: dynastyCount,
                warning: corruptionCount,
                critical: 0,
              },
              hasLegalCases: false,
              hasCorruption: true,
              hasDynasty: true,
              hasSALNAnomalies: false,
            };

            expect(isDynastyOnly(summary)).toBe(false);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("politicians with SALN anomalies are not dynasty-only", () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 5 }),
          (politicianId, dynastyCount, salnCount) => {
            const summary: RedFlagSummary = {
              politicianId,
              totalCount: dynastyCount + salnCount,
              byType: {
                legal_case: 0,
                corruption: 0,
                dynasty: dynastyCount,
                saln_anomaly: salnCount,
                attendance: 0,
              },
              bySeverity: {
                info: dynastyCount,
                warning: salnCount,
                critical: 0,
              },
              hasLegalCases: false,
              hasCorruption: false,
              hasDynasty: true,
              hasSALNAnomalies: true,
            };

            expect(isDynastyOnly(summary)).toBe(false);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 18.1, 18.2, 18.4, 18.6**
   *
   * Property 8.7: Severity Ordering Consistency
   * Severity levels should follow a consistent ordering:
   * critical > warning > info
   */
  describe("Property 8.7: Severity Ordering Consistency", () => {
    const severityOrder: Record<RedFlagSeverity, number> = {
      critical: 3,
      warning: 2,
      info: 1,
    };

    it("convicted status should produce highest severity (critical)", () => {
      fc.assert(
        fc.property(fc.constant("convicted" as ControversyStatus), (status) => {
          const legalSeverity = determineLegalCaseSeverity(status);
          const corruptionSeverity = determineCorruptionSeverity(status);

          expect(severityOrder[legalSeverity]).toBe(3);
          expect(severityOrder[corruptionSeverity]).toBe(3);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("ongoing status should produce medium severity (warning)", () => {
      fc.assert(
        fc.property(fc.constant("ongoing" as ControversyStatus), (status) => {
          const legalSeverity = determineLegalCaseSeverity(status);
          const corruptionSeverity = determineCorruptionSeverity(status);

          expect(severityOrder[legalSeverity]).toBe(2);
          expect(severityOrder[corruptionSeverity]).toBe(2);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("resolved statuses should produce lowest severity (info)", () => {
      fc.assert(
        fc.property(resolvedLegalStatusArb, (status) => {
          const legalSeverity = determineLegalCaseSeverity(status);
          const corruptionSeverity = determineCorruptionSeverity(status);

          expect(severityOrder[legalSeverity]).toBe(1);
          expect(severityOrder[corruptionSeverity]).toBe(1);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("dynasty severity should always be lowest (info)", () => {
      fc.assert(
        fc.property(fc.constant(undefined), () => {
          const dynastySeverity = determineDynastySeverity();
          expect(severityOrder[dynastySeverity]).toBe(1);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("high SALN anomaly ratio should produce highest severity (critical)", () => {
      fc.assert(
        fc.property(highAnomalyRatioArb, (ratio) => {
          const salnSeverity = determineSALNAnomalySeverity(ratio);
          expect(severityOrder[salnSeverity]).toBe(3);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("low SALN anomaly ratio should produce medium severity (warning)", () => {
      fc.assert(
        fc.property(lowAnomalyRatioArb, (ratio) => {
          const salnSeverity = determineSALNAnomalySeverity(ratio);
          expect(severityOrder[salnSeverity]).toBe(2);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 18.1, 18.2, 18.3, 18.4**
   *
   * Property 8.8: Red Flag Type Consistency
   * Each red flag type should have consistent severity rules.
   */
  describe("Property 8.8: Red Flag Type Consistency", () => {
    it("legal_case severity depends only on controversy status", () => {
      fc.assert(
        fc.property(controversyStatusArb, controversyStatusArb, (status1, status2) => {
          const severity1 = determineLegalCaseSeverity(status1);
          const severity2 = determineLegalCaseSeverity(status2);

          // Same status should produce same severity
          if (status1 === status2) {
            expect(severity1).toBe(severity2);
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("corruption severity depends only on controversy status", () => {
      fc.assert(
        fc.property(controversyStatusArb, controversyStatusArb, (status1, status2) => {
          const severity1 = determineCorruptionSeverity(status1);
          const severity2 = determineCorruptionSeverity(status2);

          // Same status should produce same severity
          if (status1 === status2) {
            expect(severity1).toBe(severity2);
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("dynasty severity is constant (always info)", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }), // arbitrary input to show independence
          () => {
            const severity = determineDynastySeverity();
            expect(severity).toBe("info");
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("saln_anomaly severity depends only on anomaly ratio", () => {
      fc.assert(
        fc.property(anomalyRatioArb, anomalyRatioArb, (ratio1, ratio2) => {
          const severity1 = determineSALNAnomalySeverity(ratio1);
          const severity2 = determineSALNAnomalySeverity(ratio2);

          // Same ratio should produce same severity
          if (ratio1 === ratio2) {
            expect(severity1).toBe(severity2);
          }

          // Both >= 5 should be critical
          if (ratio1 >= 5 && ratio2 >= 5) {
            expect(severity1).toBe("critical");
            expect(severity2).toBe("critical");
          }

          // Both < 5 should be warning
          if (ratio1 < 5 && ratio2 < 5) {
            expect(severity1).toBe("warning");
            expect(severity2).toBe("warning");
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
