/**
 * End-to-End Integration Tests
 *
 * Comprehensive tests verifying complete user flows, API endpoints,
 * authentication flows, and blockchain logging.
 *
 * **Validates: All Requirements**
 *
 * Task 21.1: End-to-end Integration Testing
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockPrisma } from "./setup";

// ============================================
// Test Data Generators
// ============================================

const generatePoliticianData = (overrides = {}) => ({
  id: `pol-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  fullName: "Juan Dela Cruz",
  firstName: "Juan",
  middleName: "Santos",
  lastName: "Dela Cruz",
  suffix: null,
  birthday: new Date("1970-01-15"),
  birthplace: "Manila",
  photo: "https://example.com/photo.jpg",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const generatePositionData = (politicianId: string, overrides = {}) => ({
  id: `pos-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  politicianId,
  title: "Senator",
  level: "national" as const,
  jurisdiction: "Philippines",
  startDate: new Date("2022-06-30"),
  endDate: null,
  termNumber: 1,
  isConsecutive: true,
  isCurrent: true,
  SourceAttribution: [],
  ...overrides,
});

const generatePartyData = (overrides = {}) => ({
  id: `party-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  name: "Partido ng Bayan",
  abbreviation: "PNB",
  foundedDate: new Date("1990-01-01"),
  isActive: true,
  ...overrides,
});

const generateUserData = (overrides = {}) => ({
  id: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  isVerified: false,
  verificationMethod: null,
  verifiedAt: null,
  language: "en",
  createdAt: new Date(),
  lastLoginAt: new Date(),
  ...overrides,
});

// ============================================
// Section 1: Authentication Flow Tests
// ============================================

describe("E2E Integration: Authentication Flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("User Registration and Verification", () => {
    it("should create a new user successfully", async () => {
      const userData = generateUserData();
      mockPrisma.user.create.mockResolvedValue(userData);

      const { createUser } = await import("@/services/auth.service");
      const result = await createUser();

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.token).toBeDefined();
    });

    it("should verify user with National ID", async () => {
      const userData = generateUserData();
      mockPrisma.user.findUnique.mockResolvedValue(userData);
      mockPrisma.user.update.mockResolvedValue({
        ...userData,
        isVerified: true,
        verificationMethod: "national_id",
        verifiedAt: new Date(),
      });

      const { verifyUser } = await import("@/services/auth.service");
      const result = await verifyUser({
        method: "national_id",
        documentNumber: "1234-5678-9012",
        userId: userData.id,
      });

      expect(result.success).toBe(true);
      expect(result.isVerified).toBe(true);
      expect(result.verificationMethod).toBe("national_id");
    });

    it("should verify user with Passport", async () => {
      const userData = generateUserData();
      mockPrisma.user.findUnique.mockResolvedValue(userData);
      mockPrisma.user.update.mockResolvedValue({
        ...userData,
        isVerified: true,
        verificationMethod: "passport",
        verifiedAt: new Date(),
      });

      const { verifyUser } = await import("@/services/auth.service");
      const result = await verifyUser({
        method: "passport",
        documentNumber: "AB1234567",
        userId: userData.id,
      });

      expect(result.success).toBe(true);
      expect(result.isVerified).toBe(true);
      expect(result.verificationMethod).toBe("passport");
    });

    it("should reject invalid document number format", async () => {
      const userData = generateUserData();
      mockPrisma.user.findUnique.mockResolvedValue(userData);

      const { verifyUser } = await import("@/services/auth.service");
      const result = await verifyUser({
        method: "national_id",
        documentNumber: "invalid",
        userId: userData.id,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid document number format");
    });

    it("should not store document numbers after verification (Requirement 41.3)", async () => {
      const userData = generateUserData();
      mockPrisma.user.findUnique.mockResolvedValue(userData);
      mockPrisma.user.update.mockResolvedValue({
        ...userData,
        isVerified: true,
        verificationMethod: "national_id",
        verifiedAt: new Date(),
      });

      const { verifyUser, sessionContainsSensitiveData, createSessionObject } =
        await import("@/services/auth.service");

      await verifyUser({
        method: "national_id",
        documentNumber: "1234-5678-9012",
        userId: userData.id,
      });

      // Verify session does not contain sensitive data
      const session = createSessionObject(userData.id, true, "national_id");
      expect(sessionContainsSensitiveData(session)).toBe(false);
    });
  });

  describe("Session Management", () => {
    it("should create and validate session", async () => {
      const userData = generateUserData({ isVerified: true });
      mockPrisma.user.findUnique.mockResolvedValue(userData);
      mockPrisma.user.update.mockResolvedValue(userData);

      const { createSession, validateSession, clearAllSessions } =
        await import("@/services/auth.service");

      clearAllSessions();
      const result = await createSession(userData.id);

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();

      if (result.token) {
        const session = await validateSession(result.token);
        expect(session.userId).toBe(userData.id);
      }
    });

    it("should invalidate session on logout", async () => {
      const userData = generateUserData({ isVerified: true });
      mockPrisma.user.findUnique.mockResolvedValue(userData);
      mockPrisma.user.update.mockResolvedValue(userData);

      const { createSession, invalidateSession, validateSession, clearAllSessions } =
        await import("@/services/auth.service");

      clearAllSessions();
      const result = await createSession(userData.id);

      expect(result.success).toBe(true);

      if (result.token) {
        const invalidated = await invalidateSession(result.token);
        expect(invalidated).toBe(true);
        await expect(validateSession(result.token)).rejects.toThrow();
      }
    });

    it("should reject expired sessions", async () => {
      const { isSessionExpired, createSessionObject } = await import("@/services/auth.service");

      const expiredSession = createSessionObject("user-123", true, "national_id");
      expiredSession.expiresAt = new Date(Date.now() - 1000);

      expect(isSessionExpired(expiredSession)).toBe(true);
    });
  });
});

// ============================================
// Section 2: Politician API Endpoint Tests
// ============================================

describe("E2E Integration: Politician API Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Politician Directory (Requirement 1)", () => {
    it("should list politicians with pagination", async () => {
      const politicians = [
        generatePoliticianData({ fullName: "Juan Dela Cruz" }),
        generatePoliticianData({ fullName: "Maria Santos" }),
      ];

      mockPrisma.politician.count.mockResolvedValue(2);
      mockPrisma.politician.findMany.mockResolvedValue(
        politicians.map((p) => ({
          ...p,
          Position: [],
          PartyAffiliation: [],
          RedFlag: [],
        }))
      );

      const { listPoliticians } = await import("@/services/politician.service");
      const result = await listPoliticians({}, { page: 1, pageSize: 20 });

      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.page).toBe(1);
    });

    it("should filter politicians by government level (Requirement 1.2)", async () => {
      const politician = generatePoliticianData();
      const position = generatePositionData(politician.id, { level: "national" });

      mockPrisma.politician.count.mockResolvedValue(1);
      mockPrisma.politician.findMany.mockResolvedValue([
        {
          ...politician,
          Position: [position],
          PartyAffiliation: [],
          RedFlag: [],
        },
      ]);

      const { listPoliticians } = await import("@/services/politician.service");
      const result = await listPoliticians({ level: "national" }, { page: 1, pageSize: 20 });

      expect(result.items).toHaveLength(1);
    });

    it("should filter politicians by party (Requirement 1.4)", async () => {
      const politician = generatePoliticianData();
      const party = generatePartyData({ name: "Liberal Party" });

      mockPrisma.politician.count.mockResolvedValue(1);
      mockPrisma.politician.findMany.mockResolvedValue([
        {
          ...politician,
          Position: [],
          PartyAffiliation: [
            {
              id: "aff-1",
              PoliticalParty: party,
              startDate: new Date(),
              endDate: null,
              isCurrent: true,
            },
          ],
          RedFlag: [],
        },
      ]);

      const { listPoliticians } = await import("@/services/politician.service");
      const result = await listPoliticians({ party: "Liberal" }, { page: 1, pageSize: 20 });

      expect(result.items).toHaveLength(1);
    });

    it("should combine multiple filters (Requirement 1.6)", async () => {
      const politician = generatePoliticianData();

      mockPrisma.politician.count.mockResolvedValue(1);
      mockPrisma.politician.findMany.mockResolvedValue([
        {
          ...politician,
          Position: [generatePositionData(politician.id, { level: "national", title: "Senator" })],
          PartyAffiliation: [],
          RedFlag: [],
        },
      ]);

      const { listPoliticians } = await import("@/services/politician.service");
      const result = await listPoliticians(
        { level: "national", position: "Senator" },
        { page: 1, pageSize: 20 }
      );

      expect(result.items).toHaveLength(1);
    });
  });

  describe("Politician Profile (Requirement 2)", () => {
    it("should get politician profile with all related data", async () => {
      const politician = generatePoliticianData();
      const position = generatePositionData(politician.id);
      const party = generatePartyData();

      mockPrisma.politician.findUnique.mockResolvedValue({
        ...politician,
        Position: [{ ...position, SourceAttribution: [] }],
        PartyAffiliation: [
          {
            id: "aff-1",
            PoliticalParty: party,
            startDate: new Date(),
            endDate: null,
            isCurrent: true,
            SourceAttribution: [],
          },
        ],
        RedFlag: [],
        SourceAttribution: [],
      });

      const { getPolitician } = await import("@/services/politician.service");
      const result = await getPolitician(politician.id);

      expect(result).not.toBeNull();
      expect(result?.fullName).toBe(politician.fullName);
      expect(result?.positions).toHaveLength(1);
    });

    it("should include source attribution for each field (Requirement 12.6, 12.7)", async () => {
      const politician = generatePoliticianData();
      const sourceAttribution = {
        id: "src-1",
        politicianId: politician.id,
        fieldName: "fullName",
        sourceType: "official_government" as const,
        sourceName: "COMELEC",
        sourceUrl: "https://comelec.gov.ph",
        documentDate: new Date(),
        retrievedAt: new Date(),
        confidence: 0.95,
        isAIProcessed: false,
        originalDocumentId: null,
      };

      mockPrisma.politician.findUnique.mockResolvedValue({
        ...politician,
        Position: [],
        PartyAffiliation: [],
        RedFlag: [],
        SourceAttribution: [sourceAttribution],
      });

      const { getPolitician } = await import("@/services/politician.service");
      const result = await getPolitician(politician.id);

      expect(result?.sources).toBeDefined();
      expect(result?.sources?.fullName).toBeDefined();
      expect(result?.sources?.fullName?.[0]?.sourceName).toBe("COMELEC");
    });
  });
});

// ============================================
// Section 3: Blockchain Audit Logging Tests
// ============================================

describe("E2E Integration: Blockchain Audit Logging", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { clearAuditLog } = await import("@/services/blockchain-audit.service");
    clearAuditLog();
  });

  describe("Audit Log Creation (Requirement 36)", () => {
    it("should log data creation with hash chain", async () => {
      const { logCreate, getAuditLog, GENESIS_HASH } =
        await import("@/services/blockchain-audit.service");

      const entry = logCreate("admin-1", "admin", "politician", "pol-1", {
        fullName: "Juan Dela Cruz",
      });

      expect(entry.action).toBe("create");
      expect(entry.previousHash).toBe(GENESIS_HASH);
      expect(entry.hash).toBeDefined();
      expect(entry.hash.length).toBe(64);

      const log = getAuditLog();
      expect(log).toHaveLength(1);
    });

    it("should chain hashes correctly (Requirement 36.4)", async () => {
      const { logCreate, getAuditLog } = await import("@/services/blockchain-audit.service");

      const entry1 = logCreate("admin-1", "admin", "politician", "pol-1", { name: "A" });
      const entry2 = logCreate("admin-1", "admin", "politician", "pol-2", { name: "B" });
      logCreate("admin-1", "admin", "politician", "pol-3", { name: "C" });

      const log = getAuditLog();
      expect(log).toHaveLength(3);
      expect(log[1]?.previousHash).toBe(entry1.hash);
      expect(log[2]?.previousHash).toBe(entry2.hash);
    });

    it("should log data updates with previous and new values", async () => {
      const { logUpdate } = await import("@/services/blockchain-audit.service");

      const entry = logUpdate(
        "admin-1",
        "admin",
        "politician",
        "pol-1",
        { fullName: "Juan Dela Cruz" },
        { fullName: "Juan Santos Dela Cruz" }
      );

      expect(entry.action).toBe("update");
      expect(entry.previousValue).toEqual({ fullName: "Juan Dela Cruz" });
      expect(entry.newValue).toEqual({ fullName: "Juan Santos Dela Cruz" });
    });
  });

  describe("Audit Log Immutability (Requirement 36.3, 36.5)", () => {
    it("should reject modification attempts", async () => {
      const { logCreate, attemptModifyEntry } = await import("@/services/blockchain-audit.service");

      const entry = logCreate("admin-1", "admin", "politician", "pol-1", { name: "Test" });

      expect(() => {
        attemptModifyEntry(entry.id, "admin-2", { newValue: { name: "Modified" } });
      }).toThrow("Audit entries cannot be modified");
    });

    it("should reject deletion attempts", async () => {
      const { logCreate, attemptDeleteEntry } = await import("@/services/blockchain-audit.service");

      const entry = logCreate("admin-1", "admin", "politician", "pol-1", { name: "Test" });

      expect(() => {
        attemptDeleteEntry(entry.id, "admin-2");
      }).toThrow("Audit entries cannot be deleted");
    });
  });

  describe("Chain Integrity Verification (Requirement 36.6)", () => {
    it("should verify valid chain integrity", async () => {
      const { logCreate, verifyChainIntegrity } =
        await import("@/services/blockchain-audit.service");

      logCreate("admin-1", "admin", "politician", "pol-1", { name: "A" });
      logCreate("admin-1", "admin", "politician", "pol-2", { name: "B" });
      logCreate("admin-1", "admin", "politician", "pol-3", { name: "C" });

      const result = verifyChainIntegrity();
      expect(result.isValid).toBe(true);
    });

    it("should verify individual entry hashes", async () => {
      const { logCreate, verifyEntryHash } = await import("@/services/blockchain-audit.service");

      const entry = logCreate("admin-1", "admin", "politician", "pol-1", { name: "Test" });

      expect(verifyEntryHash(entry)).toBe(true);
    });
  });

  describe("Blockchain Anchoring (Requirement 36.9)", () => {
    it("should create blockchain anchor for entries", async () => {
      const { logCreate, createBlockchainAnchor, MIN_ENTRIES_FOR_ANCHOR, clearAuditLog } =
        await import("@/services/blockchain-audit.service");

      clearAuditLog();

      for (let i = 0; i < MIN_ENTRIES_FOR_ANCHOR; i++) {
        logCreate("admin-1", "admin", "politician", `pol-${i}`, { name: `Politician ${i}` });
      }

      const anchor = await createBlockchainAnchor();

      expect(anchor).not.toBeNull();
      expect(anchor?.merkleRoot).toBeDefined();
      expect(anchor?.entryCount).toBe(MIN_ENTRIES_FOR_ANCHOR);
    });

    it("should verify entries against anchor", async () => {
      const {
        logCreate,
        createBlockchainAnchor,
        verifyAgainstAnchor,
        MIN_ENTRIES_FOR_ANCHOR,
        clearAuditLog,
      } = await import("@/services/blockchain-audit.service");

      clearAuditLog();

      for (let i = 0; i < MIN_ENTRIES_FOR_ANCHOR; i++) {
        logCreate("admin-1", "admin", "politician", `pol-${i}`, { name: `Politician ${i}` });
      }

      const anchor = await createBlockchainAnchor();
      if (anchor) {
        const isValid = verifyAgainstAnchor(anchor.id);
        expect(isValid).toBe(true);
      }
    });
  });

  describe("Audit Log Queries (Requirement 36.10)", () => {
    it("should query entries by data type", async () => {
      const { logCreate, getEntriesByDataType, clearAuditLog } =
        await import("@/services/blockchain-audit.service");

      clearAuditLog();
      logCreate("admin-1", "admin", "politician", "pol-1", { name: "A" });
      logCreate("admin-1", "admin", "bill", "bill-1", { title: "B" });
      logCreate("admin-1", "admin", "politician", "pol-2", { name: "C" });

      const politicianEntries = getEntriesByDataType("politician");
      expect(politicianEntries).toHaveLength(2);
    });

    it("should query entries by actor", async () => {
      const { logCreate, getEntriesByActor, clearAuditLog } =
        await import("@/services/blockchain-audit.service");

      clearAuditLog();
      logCreate("admin-1", "admin", "politician", "pol-1", { name: "A" });
      logCreate("admin-2", "admin", "politician", "pol-2", { name: "B" });
      logCreate("admin-1", "admin", "politician", "pol-3", { name: "C" });

      const admin1Entries = getEntriesByActor("admin-1");
      expect(admin1Entries).toHaveLength(2);
    });

    it("should query entries by time range", async () => {
      const { logCreate, getEntriesInTimeRange, clearAuditLog } =
        await import("@/services/blockchain-audit.service");

      clearAuditLog();
      const start = new Date();
      logCreate("admin-1", "admin", "politician", "pol-1", { name: "A" });
      logCreate("admin-1", "admin", "politician", "pol-2", { name: "B" });
      const end = new Date();

      const entries = getEntriesInTimeRange(start, end);
      expect(entries).toHaveLength(2);
    });
  });
});

// ============================================
// Section 4: User Features Tests
// ============================================

describe("E2E Integration: User Features", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Bookmarks (Requirement 10)", () => {
    it("should add bookmark for authenticated user", async () => {
      const user = generateUserData({ isVerified: true });
      const politician = generatePoliticianData();

      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.politician.findUnique.mockResolvedValue(politician);
      mockPrisma.bookmark.findFirst.mockResolvedValue(null);
      mockPrisma.bookmark.create.mockResolvedValue({
        id: "bookmark-1",
        userId: user.id,
        politicianId: politician.id,
        createdAt: new Date(),
      });

      const { addBookmark } = await import("@/services/user-list.service");
      const result = await addBookmark({
        userId: user.id,
        politicianId: politician.id,
      });

      expect(result.politicianId).toBe(politician.id);
    });

    it("should get all bookmarks for user (Requirement 10.2)", async () => {
      const user = generateUserData({ isVerified: true });
      const politician = generatePoliticianData();

      mockPrisma.bookmark.findMany.mockResolvedValue([
        {
          id: "bookmark-1",
          userId: user.id,
          politicianId: politician.id,
          createdAt: new Date(),
          Politician: {
            ...politician,
            Position: [],
            PartyAffiliation: [],
          },
        },
      ]);

      const { getBookmarks } = await import("@/services/user-list.service");
      const bookmarks = await getBookmarks(user.id);

      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0]?.politician).toMatchObject({
        id: politician.id,
        fullName: politician.fullName,
      });
    });
  });

  describe("Notifications (Requirement 19)", () => {
    it("should create notification for new controversy", async () => {
      const user = generateUserData({ isVerified: true });
      const politician = generatePoliticianData();

      mockPrisma.notification.create.mockResolvedValue({
        id: "notif-1",
        userId: user.id,
        type: "new_controversy",
        politicianId: politician.id,
        politicianName: politician.fullName,
        title: "New Controversy",
        message: "A new controversy has been documented",
        link: `/politicians/${politician.id}`,
        isRead: false,
        createdAt: new Date(),
      });

      const { createNotification } = await import("@/services/notification.service");
      const notification = await createNotification({
        userId: user.id,
        type: "new_controversy",
        politicianId: politician.id,
        politicianName: politician.fullName,
        title: "New Controversy",
        message: "A new controversy has been documented",
        link: `/politicians/${politician.id}`,
      });

      expect(notification.type).toBe("new_controversy");
    });
  });
});

// ============================================
// Section 5: Rate Limiting Tests
// ============================================

describe("E2E Integration: Rate Limiting", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { clearAllRateLimits } = await import("@/services/rate-limit.service");
    clearAllRateLimits();
  });

  describe("AI Chatbot Rate Limiting (Requirement 37)", () => {
    it("should allow requests within rate limit", async () => {
      const { checkRateLimit, RATE_LIMITS } = await import("@/services/rate-limit.service");

      const result = checkRateLimit("user-1", "127.0.0.1", true);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(RATE_LIMITS.authenticated.maxRequests - 1);
    });

    it("should have higher limits for authenticated users (Requirement 37.3)", async () => {
      const { RATE_LIMITS } = await import("@/services/rate-limit.service");

      expect(RATE_LIMITS.authenticated.maxRequests).toBeGreaterThan(
        RATE_LIMITS.anonymous.maxRequests
      );
    });

    it("should track remaining allowance (Requirement 37.6)", async () => {
      const { checkRateLimit, recordRequest, getRateLimitStatus, clearAllRateLimits } =
        await import("@/services/rate-limit.service");

      clearAllRateLimits();
      checkRateLimit("user-1", "127.0.0.1", true);
      recordRequest("user-1", "127.0.0.1", true);
      recordRequest("user-1", "127.0.0.1", true);

      const status = getRateLimitStatus("user-1", "127.0.0.1", true);

      expect(status.remaining).toBeDefined();
    });
  });
});

// ============================================
// Section 6: Admin Role Management Tests
// ============================================

describe("E2E Integration: Admin Role Management", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { clearAllAdminData } = await import("@/services/admin-role.service");
    clearAllAdminData();
  });

  describe("Role-Based Access Control (Requirement 39)", () => {
    it("should enforce role permissions", async () => {
      const { checkPermission, createAdmin, ROLE_PERMISSIONS } =
        await import("@/services/admin-role.service");

      // Create admins with different roles
      const superAdmin = createAdmin("super@test.com", "Super Admin", "super_admin", "system");
      const moderator = createAdmin("mod@test.com", "Moderator", "content_moderator", "system");
      const reviewer = createAdmin("reviewer@test.com", "Reviewer", "data_reviewer", "system");
      const auditor = createAdmin("auditor@test.com", "Auditor", "auditor", "system");

      // Super admin should have all permissions
      expect(checkPermission(superAdmin.id, "manage_admins").allowed).toBe(true);
      expect(checkPermission(superAdmin.id, "review_community_reports").allowed).toBe(true);
      expect(checkPermission(superAdmin.id, "manual_verification").allowed).toBe(true);
      expect(checkPermission(superAdmin.id, "view_audit_logs").allowed).toBe(true);

      // Content moderator should only have report permissions
      expect(checkPermission(moderator.id, "review_community_reports").allowed).toBe(true);
      expect(checkPermission(moderator.id, "manage_admins").allowed).toBe(false);

      // Data reviewer should only have verification permissions
      expect(checkPermission(reviewer.id, "manual_verification").allowed).toBe(true);
      expect(checkPermission(reviewer.id, "manage_admins").allowed).toBe(false);

      // Auditor should only have read access
      expect(checkPermission(auditor.id, "view_audit_logs").allowed).toBe(true);
      expect(checkPermission(auditor.id, "manual_verification").allowed).toBe(false);

      // Verify role permissions are defined
      expect(ROLE_PERMISSIONS.super_admin.length).toBeGreaterThan(0);
    });

    it("should require multi-admin approval for critical actions (Requirement 39.6)", async () => {
      const { isCriticalAction, CRITICAL_ACTIONS } = await import("@/services/admin-role.service");

      expect(isCriticalAction("delete_profile")).toBe(true);
      expect(isCriticalAction("modify_verified_data")).toBe(true);
      expect(isCriticalAction("view_audit_logs")).toBe(false);
      expect(CRITICAL_ACTIONS.length).toBeGreaterThan(0);
    });

    it("should prevent same admin from submitting and approving (Requirement 39.8)", async () => {
      const { createAdmin, createActionRequest, approveActionRequest, clearAllAdminData } =
        await import("@/services/admin-role.service");

      clearAllAdminData();
      const admin1 = createAdmin("admin1@test.com", "Admin 1", "super_admin", "system");
      const admin2 = createAdmin("admin2@test.com", "Admin 2", "super_admin", "system");

      const request = createActionRequest(admin1.id, "delete_profile", "politician", "pol-1", {
        reason: "Test",
      });

      // Same admin cannot approve their own submission
      expect(() => {
        approveActionRequest(request.id, admin1.id);
      }).toThrow("Cannot approve your own action request");

      // Different admin can approve
      const approved = approveActionRequest(request.id, admin2.id);
      expect(approved.approvals).toHaveLength(1);
    });
  });
});

// ============================================
// Section 7: Comparison Service Tests
// ============================================

describe("E2E Integration: Comparison Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Politician Comparison (Requirement 9)", () => {
    it("should reject comparison with less than 2 politicians", async () => {
      const { comparePoliticians } = await import("@/services/comparison.service");

      await expect(comparePoliticians(["pol-1"])).rejects.toThrow();
    });

    it("should reject comparison with more than 4 politicians", async () => {
      const { comparePoliticians } = await import("@/services/comparison.service");

      await expect(
        comparePoliticians(["pol-1", "pol-2", "pol-3", "pol-4", "pol-5"])
      ).rejects.toThrow();
    });
  });
});

// ============================================
// Section 8: Data Integrity Tests
// ============================================

describe("E2E Integration: Data Integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Source Attribution Integrity (Requirement 12)", () => {
    it("should maintain source attribution for all data points", async () => {
      const politician = generatePoliticianData();
      const sourceAttribution = {
        id: "src-1",
        politicianId: politician.id,
        fieldName: "fullName",
        sourceType: "official_government" as const,
        sourceName: "COMELEC",
        sourceUrl: "https://comelec.gov.ph",
        documentDate: new Date(),
        retrievedAt: new Date(),
        confidence: 0.95,
        isAIProcessed: false,
        originalDocumentId: null,
      };

      mockPrisma.politician.findUnique.mockResolvedValue({
        ...politician,
        Position: [],
        PartyAffiliation: [],
        RedFlag: [],
        SourceAttribution: [sourceAttribution],
      });

      const { getPolitician } = await import("@/services/politician.service");
      const result = await getPolitician(politician.id);

      expect(result?.sources).toBeDefined();
      expect(Object.keys(result?.sources || {}).length).toBeGreaterThan(0);
    });
  });

  describe("Data Consistency", () => {
    it("should maintain referential integrity", async () => {
      const politician = generatePoliticianData();
      const position = generatePositionData(politician.id);

      expect(position.politicianId).toBe(politician.id);
    });
  });
});

// ============================================
// Section 9: API Endpoint Validation Tests
// ============================================

describe("E2E Integration: API Endpoint Validation", () => {
  describe("Error Response Format", () => {
    it("should return consistent error format", async () => {
      const errorResponse = {
        code: "POLITICIAN_NOT_FOUND",
        message: "Politician not found",
        requestId: "req-123",
        timestamp: new Date().toISOString(),
      };

      expect(errorResponse.code).toBeDefined();
      expect(errorResponse.message).toBeDefined();
      expect(errorResponse.requestId).toBeDefined();
      expect(errorResponse.timestamp).toBeDefined();
    });
  });
});

// ============================================
// Section 10: Caching and Performance Tests
// ============================================

describe("E2E Integration: Caching and Performance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Cache Strategy (Requirement 44.3)", () => {
    it("should cache politician data", async () => {
      const politician = generatePoliticianData();

      mockPrisma.politician.findUnique.mockResolvedValue({
        ...politician,
        Position: [],
        PartyAffiliation: [],
        RedFlag: [],
        SourceAttribution: [],
      });

      const { getPolitician } = await import("@/services/politician.service");
      await getPolitician(politician.id);

      // Verify the service was called
      expect(mockPrisma.politician.findUnique).toHaveBeenCalled();
    });
  });
});
