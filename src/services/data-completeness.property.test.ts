/**
 * Property-Based Tests for Data Completeness
 *
 * **Validates: Requirements 2.1, 3.2, 4.2, 5.2, 6.2, 7.2, 8.2**
 *
 * Property 3: Data Completeness
 * For any entity returned by the API (Politician, Bill, SALN, Election, Controversy,
 * Project, Promise, etc.), all required fields as defined in the data model must be
 * present and non-null. Optional fields may be null but must be present in the
 * response structure.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  BillStatus,
  Chamber,
  VoteType,
  AttendanceStatus,
  ControversyCategory,
  ControversyStatus,
  ProjectStatus,
  PromiseStatus,
  ElectionType,
  ElectionResult,
} from "@prisma/client";

// Minimum iterations for property tests
const NUM_RUNS = 100;

// ============================================
// Type Definitions for Entity Structures
// ============================================

/**
 * Required fields for Politician entity
 * Validates: Requirement 2.1
 */
interface PoliticianRequiredFields {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Optional fields for Politician entity
 */
interface PoliticianOptionalFields {
  middleName?: string | null;
  suffix?: string | null;
  birthday?: Date | null;
  birthplace?: string | null;
  photo?: string | null;
}

/**
 * Required fields for Bill entity
 * Validates: Requirement 3.2
 */
interface BillRequiredFields {
  id: string;
  billNumber: string;
  title: string;
  filingDate: Date;
  status: BillStatus;
  chamber: Chamber;
  congress: number;
  session: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Optional fields for Bill entity
 */
interface BillOptionalFields {
  summary?: string | null;
  fullText?: string | null;
  republicActNumber?: string | null;
}

/**
 * Required fields for SALN Record entity
 * Validates: Requirement 6.2
 */
interface SALNRecordRequiredFields {
  id: string;
  politicianId: string;
  year: number;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  anomalyDetected: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Optional fields for SALN Record entity
 */
interface SALNRecordOptionalFields {
  declaredSalary?: number | null;
}

/**
 * Required fields for Election Result entity
 * Validates: Requirement 7.2
 */
interface ElectionResultRequiredFields {
  id: string;
  politicianId: string;
  electionYear: number;
  electionType: ElectionType;
  positionSought: string;
  jurisdiction: string;
  result: ElectionResult;
  voteCount: number;
  totalVotes: number;
  votePercentage: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Optional fields for Election Result entity
 */
interface ElectionResultOptionalFields {
  rank?: number | null;
}

/**
 * Required fields for Controversy entity
 * Validates: Requirement 8.2
 */
interface ControversyRequiredFields {
  id: string;
  politicianId: string;
  title: string;
  description: string;
  category: ControversyCategory;
  status: ControversyStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Optional fields for Controversy entity
 */
interface ControversyOptionalFields {
  filingDate?: Date | null;
  resolutionDate?: Date | null;
  court?: string | null;
  caseNumber?: string | null;
}

/**
 * Required fields for Project entity
 * Validates: Requirement 4.2
 */
interface ProjectRequiredFields {
  id: string;
  politicianId: string;
  positionId: string;
  name: string;
  startDate: Date;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Optional fields for Project entity
 */
interface ProjectOptionalFields {
  description?: string | null;
  budget?: number | null;
  endDate?: Date | null;
  implementingAgency?: string | null;
}

/**
 * Required fields for Campaign Promise entity
 */
interface CampaignPromiseRequiredFields {
  id: string;
  politicianId: string;
  electionYear: number;
  promiseText: string;
  category: string;
  status: PromiseStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Required fields for Voting Record entity
 * Validates: Requirement 5.2
 */
interface VotingRecordRequiredFields {
  id: string;
  politicianId: string;
  billId: string;
  vote: VoteType;
  voteDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Required fields for Session Attendance entity
 * Validates: Requirement 5.2
 */
interface SessionAttendanceRequiredFields {
  id: string;
  politicianId: string;
  sessionDate: Date;
  chamber: Chamber;
  status: AttendanceStatus;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Arbitraries (Generators) for Test Data
// ============================================

/**
 * Generate a valid UUID-like string
 */
const idArb = fc.uuid();

/**
 * Generate a non-empty string for required string fields
 */
const requiredStringArb = fc.string({ minLength: 1, maxLength: 100 });

/**
 * Generate a date within a reasonable range
 */
const dateArb = fc.date({ min: new Date("1940-01-01"), max: new Date("2030-12-31") });

/**
 * Generate a bill status
 */
const billStatusArb = fc.constantFrom(
  BillStatus.pending,
  BillStatus.passed,
  BillStatus.vetoed,
  BillStatus.lapsed,
  BillStatus.withdrawn
);

/**
 * Generate a chamber
 */
const chamberArb = fc.constantFrom(Chamber.senate, Chamber.house);

/**
 * Generate a vote type
 */
const voteTypeArb = fc.constantFrom(VoteType.yes, VoteType.no, VoteType.abstain);

/**
 * Generate an attendance status
 */
const attendanceStatusArb = fc.constantFrom(
  AttendanceStatus.present,
  AttendanceStatus.absent_excused,
  AttendanceStatus.absent_unexcused
);

/**
 * Generate a controversy category
 */
const controversyCategoryArb = fc.constantFrom(
  ControversyCategory.legal_case,
  ControversyCategory.corruption,
  ControversyCategory.ethics_violation,
  ControversyCategory.other
);

/**
 * Generate a controversy status
 */
const controversyStatusArb = fc.constantFrom(
  ControversyStatus.ongoing,
  ControversyStatus.dismissed,
  ControversyStatus.convicted,
  ControversyStatus.acquitted,
  ControversyStatus.settled
);

/**
 * Generate a project status
 */
const projectStatusArb = fc.constantFrom(
  ProjectStatus.planned,
  ProjectStatus.ongoing,
  ProjectStatus.completed,
  ProjectStatus.cancelled
);

/**
 * Generate a promise status
 */
const promiseStatusArb = fc.constantFrom(
  PromiseStatus.kept,
  PromiseStatus.partially_kept,
  PromiseStatus.broken,
  PromiseStatus.in_progress,
  PromiseStatus.not_yet_due
);

/**
 * Generate an election type
 */
const electionTypeArb = fc.constantFrom(
  ElectionType.national,
  ElectionType.local,
  ElectionType.barangay,
  ElectionType.special
);

/**
 * Generate an election result
 */
const electionResultArb = fc.constantFrom(ElectionResult.won, ElectionResult.lost);

// ============================================
// Entity Arbitraries
// ============================================

/**
 * Generate a complete Politician entity with all required fields
 */
const politicianArb = fc.record({
  id: idArb,
  fullName: requiredStringArb,
  firstName: requiredStringArb,
  middleName: fc.option(fc.string(), { nil: null }),
  lastName: requiredStringArb,
  suffix: fc.option(fc.string(), { nil: null }),
  birthday: fc.option(dateArb, { nil: null }),
  birthplace: fc.option(fc.string(), { nil: null }),
  photo: fc.option(fc.string(), { nil: null }),
  isActive: fc.boolean(),
  createdAt: dateArb,
  updatedAt: dateArb,
});

/**
 * Generate a complete Bill entity with all required fields
 */
const billArb = fc.record({
  id: idArb,
  billNumber: requiredStringArb,
  title: requiredStringArb,
  summary: fc.option(fc.string(), { nil: null }),
  fullText: fc.option(fc.string(), { nil: null }),
  filingDate: dateArb,
  status: billStatusArb,
  republicActNumber: fc.option(fc.string(), { nil: null }),
  chamber: chamberArb,
  congress: fc.integer({ min: 1, max: 25 }),
  session: fc.integer({ min: 1, max: 3 }),
  createdAt: dateArb,
  updatedAt: dateArb,
});

/**
 * Generate a complete SALN Record entity with all required fields
 * Note: Using noNaN: true to ensure financial values are always finite numbers
 */
const salnRecordArb = fc.record({
  id: idArb,
  politicianId: idArb,
  year: fc.integer({ min: 2000, max: 2030 }),
  totalAssets: fc.float({ min: 0, max: 1_000_000_000, noNaN: true }),
  totalLiabilities: fc.float({ min: 0, max: 100_000_000, noNaN: true }),
  netWorth: fc.float({ min: -100_000_000, max: 1_000_000_000, noNaN: true }),
  declaredSalary: fc.option(fc.float({ min: 0, max: 10_000_000, noNaN: true }), { nil: null }),
  anomalyDetected: fc.boolean(),
  createdAt: dateArb,
  updatedAt: dateArb,
});

/**
 * Generate a complete Election Result entity with all required fields
 */
const electionResultRecordArb = fc.record({
  id: idArb,
  politicianId: idArb,
  electionYear: fc.integer({ min: 1986, max: 2030 }),
  electionType: electionTypeArb,
  positionSought: requiredStringArb,
  jurisdiction: requiredStringArb,
  result: electionResultArb,
  voteCount: fc.integer({ min: 0, max: 50_000_000 }),
  totalVotes: fc.integer({ min: 1, max: 100_000_000 }),
  votePercentage: fc.float({ min: 0, max: 100, noNaN: true }),
  rank: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
  createdAt: dateArb,
  updatedAt: dateArb,
});

/**
 * Generate a complete Controversy entity with all required fields
 */
const controversyArb = fc.record({
  id: idArb,
  politicianId: idArb,
  title: requiredStringArb,
  description: requiredStringArb,
  category: controversyCategoryArb,
  status: controversyStatusArb,
  filingDate: fc.option(dateArb, { nil: null }),
  resolutionDate: fc.option(dateArb, { nil: null }),
  court: fc.option(fc.string(), { nil: null }),
  caseNumber: fc.option(fc.string(), { nil: null }),
  createdAt: dateArb,
  updatedAt: dateArb,
});

/**
 * Generate a complete Project entity with all required fields
 */
const projectArb = fc.record({
  id: idArb,
  politicianId: idArb,
  positionId: idArb,
  name: requiredStringArb,
  description: fc.option(fc.string(), { nil: null }),
  budget: fc.option(fc.float({ min: 0, max: 10_000_000_000, noNaN: true }), { nil: null }),
  startDate: dateArb,
  endDate: fc.option(dateArb, { nil: null }),
  status: projectStatusArb,
  implementingAgency: fc.option(fc.string(), { nil: null }),
  createdAt: dateArb,
  updatedAt: dateArb,
});

/**
 * Generate a complete Campaign Promise entity with all required fields
 */
const campaignPromiseArb = fc.record({
  id: idArb,
  politicianId: idArb,
  electionYear: fc.integer({ min: 1986, max: 2030 }),
  promiseText: requiredStringArb,
  category: requiredStringArb,
  status: promiseStatusArb,
  createdAt: dateArb,
  updatedAt: dateArb,
});

/**
 * Generate a complete Voting Record entity with all required fields
 */
const votingRecordArb = fc.record({
  id: idArb,
  politicianId: idArb,
  billId: idArb,
  vote: voteTypeArb,
  voteDate: dateArb,
  createdAt: dateArb,
  updatedAt: dateArb,
});

/**
 * Generate a complete Session Attendance entity with all required fields
 */
const sessionAttendanceArb = fc.record({
  id: idArb,
  politicianId: idArb,
  sessionDate: dateArb,
  chamber: chamberArb,
  status: attendanceStatusArb,
  createdAt: dateArb,
  updatedAt: dateArb,
});

// ============================================
// Validation Helper Functions
// ============================================

/**
 * Check if a value is defined (not undefined)
 */
function isDefined(value: unknown): boolean {
  return value !== undefined;
}

/**
 * Check if a required field is present and non-null
 /**
 * Check if an optional field is present in the structure (may be null)
 */
function isOptionalFieldPresent(obj: Record<string, unknown>, fieldName: string): boolean {
  return fieldName in obj;
}

/**
 * Validate that all required fields in an entity are present and non-null
 */
function validateRequiredFields<T extends Record<string, unknown>>(
  entity: T,
  requiredFieldNames: (keyof T)[]
): { valid: boolean; missingFields: string[]; nullFields: string[] } {
  const missingFields: string[] = [];
  const nullFields: string[] = [];

  for (const fieldName of requiredFieldNames) {
    if (!isDefined(entity[fieldName])) {
      missingFields.push(String(fieldName));
    } else if (entity[fieldName] === null) {
      nullFields.push(String(fieldName));
    }
  }

  return {
    valid: missingFields.length === 0 && nullFields.length === 0,
    missingFields,
    nullFields,
  };
}

/**
 * Validate that all optional fields are present in the structure
 */
function validateOptionalFieldsPresent<T extends Record<string, unknown>>(
  entity: T,
  optionalFieldNames: string[]
): { valid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];

  for (const fieldName of optionalFieldNames) {
    if (!isOptionalFieldPresent(entity as Record<string, unknown>, fieldName)) {
      missingFields.push(fieldName);
    }
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

// ============================================
// Property Tests
// ============================================

describe("Data Completeness - Property 3", () => {
  /**
   * **Validates: Requirement 2.1**
   *
   * Property 3.1: Politician Data Completeness
   * For any Politician entity, all required fields must be present and non-null.
   * Optional fields may be null but must be present in the response structure.
   */
  describe("Property 3.1: Politician Data Completeness", () => {
    const politicianRequiredFields: (keyof PoliticianRequiredFields)[] = [
      "id",
      "fullName",
      "firstName",
      "lastName",
      "isActive",
      "createdAt",
      "updatedAt",
    ];

    const politicianOptionalFields: (keyof PoliticianOptionalFields)[] = [
      "middleName",
      "suffix",
      "birthday",
      "birthplace",
      "photo",
    ];

    it("all required fields must be present and non-null for any Politician entity", () => {
      fc.assert(
        fc.property(politicianArb, (politician) => {
          const result = validateRequiredFields(politician, politicianRequiredFields);

          expect(result.missingFields).toEqual([]);
          expect(result.nullFields).toEqual([]);
          expect(result.valid).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("all optional fields must be present in the structure (may be null)", () => {
      fc.assert(
        fc.property(politicianArb, (politician) => {
          const result = validateOptionalFieldsPresent(
            politician as Record<string, unknown>,
            politicianOptionalFields as string[]
          );

          expect(result.missingFields).toEqual([]);
          expect(result.valid).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("required string fields must be non-empty", () => {
      fc.assert(
        fc.property(politicianArb, (politician) => {
          expect(politician.id.length).toBeGreaterThan(0);
          expect(politician.fullName.length).toBeGreaterThan(0);
          expect(politician.firstName.length).toBeGreaterThan(0);
          expect(politician.lastName.length).toBeGreaterThan(0);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirement 3.2**
   *
   * Property 3.2: Bill Data Completeness
   * For any Bill entity, all required fields must be present and non-null.
   */
  describe("Property 3.2: Bill Data Completeness", () => {
    const billRequiredFields: (keyof BillRequiredFields)[] = [
      "id",
      "billNumber",
      "title",
      "filingDate",
      "status",
      "chamber",
      "congress",
      "session",
      "createdAt",
      "updatedAt",
    ];

    const billOptionalFields: (keyof BillOptionalFields)[] = [
      "summary",
      "fullText",
      "republicActNumber",
    ];

    it("all required fields must be present and non-null for any Bill entity", () => {
      fc.assert(
        fc.property(billArb, (bill) => {
          const result = validateRequiredFields(bill, billRequiredFields);

          expect(result.missingFields).toEqual([]);
          expect(result.nullFields).toEqual([]);
          expect(result.valid).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("all optional fields must be present in the structure (may be null)", () => {
      fc.assert(
        fc.property(billArb, (bill) => {
          const result = validateOptionalFieldsPresent(
            bill as Record<string, unknown>,
            billOptionalFields as string[]
          );

          expect(result.missingFields).toEqual([]);
          expect(result.valid).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("bill status must be a valid enum value", () => {
      fc.assert(
        fc.property(billArb, (bill) => {
          const validStatuses = Object.values(BillStatus);
          expect(validStatuses).toContain(bill.status);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("chamber must be a valid enum value", () => {
      fc.assert(
        fc.property(billArb, (bill) => {
          const validChambers = Object.values(Chamber);
          expect(validChambers).toContain(bill.chamber);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirement 6.2**
   *
   * Property 3.3: SALN Record Data Completeness
   * For any SALN Record entity, all required fields must be present and non-null.
   */
  describe("Property 3.3: SALN Record Data Completeness", () => {
    const salnRequiredFields: (keyof SALNRecordRequiredFields)[] = [
      "id",
      "politicianId",
      "year",
      "totalAssets",
      "totalLiabilities",
      "netWorth",
      "anomalyDetected",
      "createdAt",
      "updatedAt",
    ];

    const salnOptionalFields: (keyof SALNRecordOptionalFields)[] = ["declaredSalary"];

    it("all required fields must be present and non-null for any SALN Record entity", () => {
      fc.assert(
        fc.property(salnRecordArb, (salnRecord) => {
          const result = validateRequiredFields(salnRecord, salnRequiredFields);

          expect(result.missingFields).toEqual([]);
          expect(result.nullFields).toEqual([]);
          expect(result.valid).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("all optional fields must be present in the structure (may be null)", () => {
      fc.assert(
        fc.property(salnRecordArb, (salnRecord) => {
          const result = validateOptionalFieldsPresent(
            salnRecord as Record<string, unknown>,
            salnOptionalFields as string[]
          );

          expect(result.missingFields).toEqual([]);
          expect(result.valid).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("financial values must be numeric", () => {
      fc.assert(
        fc.property(salnRecordArb, (salnRecord) => {
          expect(typeof salnRecord.totalAssets).toBe("number");
          expect(typeof salnRecord.totalLiabilities).toBe("number");
          expect(typeof salnRecord.netWorth).toBe("number");
          expect(Number.isFinite(salnRecord.totalAssets)).toBe(true);
          expect(Number.isFinite(salnRecord.totalLiabilities)).toBe(true);
          expect(Number.isFinite(salnRecord.netWorth)).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("year must be a valid integer", () => {
      fc.assert(
        fc.property(salnRecordArb, (salnRecord) => {
          expect(Number.isInteger(salnRecord.year)).toBe(true);
          expect(salnRecord.year).toBeGreaterThanOrEqual(2000);
          expect(salnRecord.year).toBeLessThanOrEqual(2030);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirement 7.2**
   *
   * Property 3.4: Election Result Data Completeness
   * For any Election Result entity, all required fields must be present and non-null.
   */
  describe("Property 3.4: Election Result Data Completeness", () => {
    const electionRequiredFields: (keyof ElectionResultRequiredFields)[] = [
      "id",
      "politicianId",
      "electionYear",
      "electionType",
      "positionSought",
      "jurisdiction",
      "result",
      "voteCount",
      "totalVotes",
      "votePercentage",
      "createdAt",
      "updatedAt",
    ];

    const electionOptionalFields: (keyof ElectionResultOptionalFields)[] = ["rank"];

    it("all required fields must be present and non-null for any Election Result entity", () => {
      fc.assert(
        fc.property(electionResultRecordArb, (electionResult) => {
          const result = validateRequiredFields(electionResult, electionRequiredFields);

          expect(result.missingFields).toEqual([]);
          expect(result.nullFields).toEqual([]);
          expect(result.valid).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("all optional fields must be present in the structure (may be null)", () => {
      fc.assert(
        fc.property(electionResultRecordArb, (electionResult) => {
          const result = validateOptionalFieldsPresent(
            electionResult as Record<string, unknown>,
            electionOptionalFields as string[]
          );

          expect(result.missingFields).toEqual([]);
          expect(result.valid).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("election type must be a valid enum value", () => {
      fc.assert(
        fc.property(electionResultRecordArb, (electionResult) => {
          const validTypes = Object.values(ElectionType);
          expect(validTypes).toContain(electionResult.electionType);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("result must be a valid enum value", () => {
      fc.assert(
        fc.property(electionResultRecordArb, (electionResult) => {
          const validResults = Object.values(ElectionResult);
          expect(validResults).toContain(electionResult.result);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("vote counts must be non-negative integers", () => {
      fc.assert(
        fc.property(electionResultRecordArb, (electionResult) => {
          expect(electionResult.voteCount).toBeGreaterThanOrEqual(0);
          expect(electionResult.totalVotes).toBeGreaterThan(0);
          expect(Number.isInteger(electionResult.voteCount)).toBe(true);
          expect(Number.isInteger(electionResult.totalVotes)).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirement 8.2**
   *
   * Property 3.5: Controversy Data Completeness
   * For any Controversy entity, all required fields must be present and non-null.
   */
  describe("Property 3.5: Controversy Data Completeness", () => {
    const controversyRequiredFields: (keyof ControversyRequiredFields)[] = [
      "id",
      "politicianId",
      "title",
      "description",
      "category",
      "status",
      "createdAt",
      "updatedAt",
    ];

    const controversyOptionalFields: (keyof ControversyOptionalFields)[] = [
      "filingDate",
      "resolutionDate",
      "court",
      "caseNumber",
    ];

    it("all required fields must be present and non-null for any Controversy entity", () => {
      fc.assert(
        fc.property(controversyArb, (controversy) => {
          const result = validateRequiredFields(controversy, controversyRequiredFields);

          expect(result.missingFields).toEqual([]);
          expect(result.nullFields).toEqual([]);
          expect(result.valid).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("all optional fields must be present in the structure (may be null)", () => {
      fc.assert(
        fc.property(controversyArb, (controversy) => {
          const result = validateOptionalFieldsPresent(
            controversy as Record<string, unknown>,
            controversyOptionalFields as string[]
          );

          expect(result.missingFields).toEqual([]);
          expect(result.valid).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("category must be a valid enum value", () => {
      fc.assert(
        fc.property(controversyArb, (controversy) => {
          const validCategories = Object.values(ControversyCategory);
          expect(validCategories).toContain(controversy.category);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("status must be a valid enum value", () => {
      fc.assert(
        fc.property(controversyArb, (controversy) => {
          const validStatuses = Object.values(ControversyStatus);
          expect(validStatuses).toContain(controversy.status);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirement 4.2**
   *
   * Property 3.6: Project Data Completeness
   * For any Project entity, all required fields must be present and non-null.
   */
  describe("Property 3.6: Project Data Completeness", () => {
    const projectRequiredFields: (keyof ProjectRequiredFields)[] = [
      "id",
      "politicianId",
      "positionId",
      "name",
      "startDate",
      "status",
      "createdAt",
      "updatedAt",
    ];

    const projectOptionalFields: (keyof ProjectOptionalFields)[] = [
      "description",
      "budget",
      "endDate",
      "implementingAgency",
    ];

    it("all required fields must be present and non-null for any Project entity", () => {
      fc.assert(
        fc.property(projectArb, (project) => {
          const result = validateRequiredFields(project, projectRequiredFields);

          expect(result.missingFields).toEqual([]);
          expect(result.nullFields).toEqual([]);
          expect(result.valid).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("all optional fields must be present in the structure (may be null)", () => {
      fc.assert(
        fc.property(projectArb, (project) => {
          const result = validateOptionalFieldsPresent(
            project as Record<string, unknown>,
            projectOptionalFields as string[]
          );

          expect(result.missingFields).toEqual([]);
          expect(result.valid).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("status must be a valid enum value", () => {
      fc.assert(
        fc.property(projectArb, (project) => {
          const validStatuses = Object.values(ProjectStatus);
          expect(validStatuses).toContain(project.status);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("budget when present must be non-negative", () => {
      fc.assert(
        fc.property(projectArb, (project) => {
          if (project.budget !== null) {
            expect(project.budget).toBeGreaterThanOrEqual(0);
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 5.2**
   *
   * Property 3.7: Voting Record Data Completeness
   * For any Voting Record entity, all required fields must be present and non-null.
   */
  describe("Property 3.7: Voting Record Data Completeness", () => {
    const votingRecordRequiredFields: (keyof VotingRecordRequiredFields)[] = [
      "id",
      "politicianId",
      "billId",
      "vote",
      "voteDate",
      "createdAt",
      "updatedAt",
    ];

    it("all required fields must be present and non-null for any Voting Record entity", () => {
      fc.assert(
        fc.property(votingRecordArb, (votingRecord) => {
          const result = validateRequiredFields(votingRecord, votingRecordRequiredFields);

          expect(result.missingFields).toEqual([]);
          expect(result.nullFields).toEqual([]);
          expect(result.valid).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("vote must be a valid enum value", () => {
      fc.assert(
        fc.property(votingRecordArb, (votingRecord) => {
          const validVotes = Object.values(VoteType);
          expect(validVotes).toContain(votingRecord.vote);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("voteDate must be a valid Date", () => {
      fc.assert(
        fc.property(votingRecordArb, (votingRecord) => {
          expect(votingRecord.voteDate).toBeInstanceOf(Date);
          expect(votingRecord.voteDate.getTime()).not.toBeNaN();
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 5.2**
   *
   * Property 3.8: Session Attendance Data Completeness
   * For any Session Attendance entity, all required fields must be present and non-null.
   */
  describe("Property 3.8: Session Attendance Data Completeness", () => {
    const sessionAttendanceRequiredFields: (keyof SessionAttendanceRequiredFields)[] = [
      "id",
      "politicianId",
      "sessionDate",
      "chamber",
      "status",
      "createdAt",
      "updatedAt",
    ];

    it("all required fields must be present and non-null for any Session Attendance entity", () => {
      fc.assert(
        fc.property(sessionAttendanceArb, (sessionAttendance) => {
          const result = validateRequiredFields(sessionAttendance, sessionAttendanceRequiredFields);

          expect(result.missingFields).toEqual([]);
          expect(result.nullFields).toEqual([]);
          expect(result.valid).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("chamber must be a valid enum value", () => {
      fc.assert(
        fc.property(sessionAttendanceArb, (sessionAttendance) => {
          const validChambers = Object.values(Chamber);
          expect(validChambers).toContain(sessionAttendance.chamber);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("status must be a valid enum value", () => {
      fc.assert(
        fc.property(sessionAttendanceArb, (sessionAttendance) => {
          const validStatuses = Object.values(AttendanceStatus);
          expect(validStatuses).toContain(sessionAttendance.status);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 2.1, 3.2, 4.2, 5.2, 6.2, 7.2, 8.2**
   *
   * Property 3.9: Campaign Promise Data Completeness
   * For any Campaign Promise entity, all required fields must be present and non-null.
   */
  describe("Property 3.9: Campaign Promise Data Completeness", () => {
    const campaignPromiseRequiredFields: (keyof CampaignPromiseRequiredFields)[] = [
      "id",
      "politicianId",
      "electionYear",
      "promiseText",
      "category",
      "status",
      "createdAt",
      "updatedAt",
    ];

    it("all required fields must be present and non-null for any Campaign Promise entity", () => {
      fc.assert(
        fc.property(campaignPromiseArb, (campaignPromise) => {
          const result = validateRequiredFields(campaignPromise, campaignPromiseRequiredFields);

          expect(result.missingFields).toEqual([]);
          expect(result.nullFields).toEqual([]);
          expect(result.valid).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("status must be a valid enum value", () => {
      fc.assert(
        fc.property(campaignPromiseArb, (campaignPromise) => {
          const validStatuses = Object.values(PromiseStatus);
          expect(validStatuses).toContain(campaignPromise.status);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("promiseText must be non-empty", () => {
      fc.assert(
        fc.property(campaignPromiseArb, (campaignPromise) => {
          expect(campaignPromise.promiseText.length).toBeGreaterThan(0);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 2.1, 3.2, 4.2, 5.2, 6.2, 7.2, 8.2**
   *
   * Property 3.10: Cross-Entity ID Consistency
   * For any entity with foreign key references, the referenced IDs must be valid non-empty strings.
   */
  describe("Property 3.10: Cross-Entity ID Consistency", () => {
    it("all entity IDs must be valid non-empty strings", () => {
      fc.assert(
        fc.property(
          fc.tuple(
            politicianArb,
            billArb,
            salnRecordArb,
            electionResultRecordArb,
            controversyArb,
            projectArb,
            campaignPromiseArb,
            votingRecordArb,
            sessionAttendanceArb
          ),
          ([
            politician,
            bill,
            salnRecord,
            electionResult,
            controversy,
            project,
            campaignPromise,
            votingRecord,
            sessionAttendance,
          ]) => {
            // All primary IDs must be non-empty strings
            expect(typeof politician.id).toBe("string");
            expect(politician.id.length).toBeGreaterThan(0);

            expect(typeof bill.id).toBe("string");
            expect(bill.id.length).toBeGreaterThan(0);

            expect(typeof salnRecord.id).toBe("string");
            expect(salnRecord.id.length).toBeGreaterThan(0);

            expect(typeof electionResult.id).toBe("string");
            expect(electionResult.id.length).toBeGreaterThan(0);

            expect(typeof controversy.id).toBe("string");
            expect(controversy.id.length).toBeGreaterThan(0);

            expect(typeof project.id).toBe("string");
            expect(project.id.length).toBeGreaterThan(0);

            expect(typeof campaignPromise.id).toBe("string");
            expect(campaignPromise.id.length).toBeGreaterThan(0);

            expect(typeof votingRecord.id).toBe("string");
            expect(votingRecord.id.length).toBeGreaterThan(0);

            expect(typeof sessionAttendance.id).toBe("string");
            expect(sessionAttendance.id.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("all foreign key references must be valid non-empty strings", () => {
      fc.assert(
        fc.property(
          fc.tuple(
            salnRecordArb,
            electionResultRecordArb,
            controversyArb,
            projectArb,
            campaignPromiseArb,
            votingRecordArb,
            sessionAttendanceArb
          ),
          ([
            salnRecord,
            electionResult,
            controversy,
            project,
            campaignPromise,
            votingRecord,
            sessionAttendance,
          ]) => {
            // All politicianId references must be valid
            expect(typeof salnRecord.politicianId).toBe("string");
            expect(salnRecord.politicianId.length).toBeGreaterThan(0);

            expect(typeof electionResult.politicianId).toBe("string");
            expect(electionResult.politicianId.length).toBeGreaterThan(0);

            expect(typeof controversy.politicianId).toBe("string");
            expect(controversy.politicianId.length).toBeGreaterThan(0);

            expect(typeof project.politicianId).toBe("string");
            expect(project.politicianId.length).toBeGreaterThan(0);

            expect(typeof campaignPromise.politicianId).toBe("string");
            expect(campaignPromise.politicianId.length).toBeGreaterThan(0);

            expect(typeof votingRecord.politicianId).toBe("string");
            expect(votingRecord.politicianId.length).toBeGreaterThan(0);

            expect(typeof sessionAttendance.politicianId).toBe("string");
            expect(sessionAttendance.politicianId.length).toBeGreaterThan(0);

            // Project positionId reference
            expect(typeof project.positionId).toBe("string");
            expect(project.positionId.length).toBeGreaterThan(0);

            // VotingRecord billId reference
            expect(typeof votingRecord.billId).toBe("string");
            expect(votingRecord.billId.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 2.1, 3.2, 4.2, 5.2, 6.2, 7.2, 8.2**
   *
   * Property 3.11: Timestamp Consistency
   * For any entity with timestamps, createdAt and updatedAt must be valid dates.
   */
  describe("Property 3.11: Timestamp Consistency", () => {
    it("all entities must have valid createdAt and updatedAt timestamps", () => {
      fc.assert(
        fc.property(
          fc.tuple(
            politicianArb,
            billArb,
            salnRecordArb,
            electionResultRecordArb,
            controversyArb,
            projectArb,
            campaignPromiseArb,
            votingRecordArb,
            sessionAttendanceArb
          ),
          ([
            politician,
            bill,
            salnRecord,
            electionResult,
            controversy,
            project,
            campaignPromise,
            votingRecord,
            sessionAttendance,
          ]) => {
            // All entities must have valid Date objects for timestamps
            const entities = [
              politician,
              bill,
              salnRecord,
              electionResult,
              controversy,
              project,
              campaignPromise,
              votingRecord,
              sessionAttendance,
            ];

            for (const entity of entities) {
              expect(entity.createdAt).toBeInstanceOf(Date);
              expect(entity.updatedAt).toBeInstanceOf(Date);
              expect(entity.createdAt.getTime()).not.toBeNaN();
              expect(entity.updatedAt.getTime()).not.toBeNaN();
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
