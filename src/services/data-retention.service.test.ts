/**
 * Unit Tests for Data Retention Service
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  generateRequestId,
  isPermanentData,
  validateDeletionRequest,
  validateModificationRequest,
  validateFalseDataRemovalRequest,
  processDeletionRequest,
  processModificationRequest,
  processFalseDataRemovalRequest,
  getDeletionRequests,
  getDeletionRequestsByDataId,
  getModificationRequests,
  getFalseDataRemovalRequests,
  clearAllRequests,
  getRequestCounts,
  PERMANENT_DATA_CATEGORIES,
  DataRetentionError,
  DeletionRequest,
  ModificationRequest,
  FalseDataRemovalRequest,
} from "./data-retention.service";
import { clearAuditLog } from "./blockchain-audit.service";

describe("Data Retention Service", () => {
  beforeEach(() => {
    clearAllRequests();
    clearAuditLog();
  });

  describe("generateRequestId", () => {
    it("should generate unique IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateRequestId("del"));
      }
      expect(ids.size).toBe(100);
    });

    it("should include prefix", () => {
      const id = generateRequestId("mod");
      expect(id.startsWith("mod-")).toBe(true);
    });
  });

  describe("isPermanentData", () => {
    it("should return true for politician data", () => {
      expect(isPermanentData("politician")).toBe(true);
    });

    it("should return true for all permanent categories", () => {
      for (const category of PERMANENT_DATA_CATEGORIES) {
        expect(isPermanentData(category)).toBe(true);
      }
    });
  });

  describe("validateDeletionRequest", () => {
    it("should accept valid request", () => {
      const request: DeletionRequest = {
        id: "del-1",
        requestedBy: "user-1",
        requestedAt: new Date(),
        dataCategory: "politician",
        dataId: "pol-1",
        reason: "Test reason",
      };
      expect(validateDeletionRequest(request)).toBe(true);
    });

    it("should reject request without id", () => {
      const request = {
        id: "",
        requestedBy: "user-1",
        requestedAt: new Date(),
        dataCategory: "politician",
        dataId: "pol-1",
        reason: "Test reason",
      } as DeletionRequest;
      expect(validateDeletionRequest(request)).toBe(false);
    });

    it("should reject request without reason", () => {
      const request = {
        id: "del-1",
        requestedBy: "user-1",
        requestedAt: new Date(),
        dataCategory: "politician",
        dataId: "pol-1",
        reason: "",
      } as DeletionRequest;
      expect(validateDeletionRequest(request)).toBe(false);
    });
  });

  describe("validateModificationRequest", () => {
    it("should accept valid request", () => {
      const request: ModificationRequest = {
        id: "mod-1",
        requestedBy: "user-1",
        requestedAt: new Date(),
        dataCategory: "politician",
        dataId: "pol-1",
        currentData: { name: "Old" },
        proposedData: { name: "New" },
        reason: "Correction",
      };
      expect(validateModificationRequest(request)).toBe(true);
    });

    it("should reject request without proposedData", () => {
      const request = {
        id: "mod-1",
        requestedBy: "user-1",
        requestedAt: new Date(),
        dataCategory: "politician",
        dataId: "pol-1",
        currentData: { name: "Old" },
        proposedData: null,
        reason: "Correction",
      } as unknown as ModificationRequest;
      expect(validateModificationRequest(request)).toBe(false);
    });
  });

  describe("validateFalseDataRemovalRequest", () => {
    it("should accept valid request with evidence", () => {
      const request: FalseDataRemovalRequest = {
        id: "rem-1",
        requestedBy: "user-1",
        requestedAt: new Date(),
        dataCategory: "politician",
        dataId: "pol-1",
        fieldToRemove: "birthDate",
        reason: "Incorrect date",
        evidence: ["https://official-source.gov.ph/correction"],
      };
      expect(validateFalseDataRemovalRequest(request)).toBe(true);
    });

    it("should reject request without evidence", () => {
      const request = {
        id: "rem-1",
        requestedBy: "user-1",
        requestedAt: new Date(),
        dataCategory: "politician",
        dataId: "pol-1",
        fieldToRemove: "birthDate",
        reason: "Incorrect date",
        evidence: [],
      } as FalseDataRemovalRequest;
      expect(validateFalseDataRemovalRequest(request)).toBe(false);
    });

    it("should reject request with non-array evidence", () => {
      const request = {
        id: "rem-1",
        requestedBy: "user-1",
        requestedAt: new Date(),
        dataCategory: "politician",
        dataId: "pol-1",
        fieldToRemove: "birthDate",
        reason: "Incorrect date",
        evidence: "not-an-array",
      } as unknown as FalseDataRemovalRequest;
      expect(validateFalseDataRemovalRequest(request)).toBe(false);
    });
  });

  describe("processDeletionRequest", () => {
    it("should reject politician data deletion", () => {
      const request: DeletionRequest = {
        id: "del-1",
        requestedBy: "user-1",
        requestedAt: new Date(),
        dataCategory: "politician",
        dataId: "pol-1",
        reason: "User requested deletion",
      };

      const result = processDeletionRequest(request);

      expect(result.status).toBe("rejected");
      expect(result.loggedToBlockchain).toBe(true);
      expect(result.reason).toContain("permanent");
    });

    it("should reject bill data deletion", () => {
      const request: DeletionRequest = {
        id: "del-2",
        requestedBy: "user-1",
        requestedAt: new Date(),
        dataCategory: "bill",
        dataId: "bill-1",
        reason: "User requested deletion",
      };

      const result = processDeletionRequest(request);

      expect(result.status).toBe("rejected");
      expect(result.loggedToBlockchain).toBe(true);
    });

    it("should store the deletion request", () => {
      const request: DeletionRequest = {
        id: "del-3",
        requestedBy: "user-1",
        requestedAt: new Date(),
        dataCategory: "politician",
        dataId: "pol-1",
        reason: "Test",
      };

      processDeletionRequest(request);

      expect(getDeletionRequests()).toHaveLength(1);
    });

    it("should throw for invalid request", () => {
      const request = {
        id: "",
        requestedBy: "user-1",
        requestedAt: new Date(),
        dataCategory: "politician",
        dataId: "pol-1",
        reason: "Test",
      } as DeletionRequest;

      expect(() => processDeletionRequest(request)).toThrow(DataRetentionError);
    });
  });

  describe("processModificationRequest", () => {
    it("should process valid modification request", async () => {
      const request: ModificationRequest = {
        id: "mod-1",
        requestedBy: "user-1",
        requestedAt: new Date(),
        dataCategory: "politician",
        dataId: "pol-1",
        currentData: { name: "Juan Dela Cruz" },
        proposedData: { name: "Juan Dela Cruz Jr." },
        reason: "Name correction",
      };

      const result = await processModificationRequest(request);

      expect(result.requestId).toBe("mod-1");
      expect(result.loggedToBlockchain).toBe(true);
      expect(["approved", "pending_verification", "rejected"]).toContain(result.status);
    });

    it("should store the modification request", async () => {
      const request: ModificationRequest = {
        id: "mod-2",
        requestedBy: "user-1",
        requestedAt: new Date(),
        dataCategory: "politician",
        dataId: "pol-1",
        currentData: { name: "Old" },
        proposedData: { name: "New" },
        reason: "Correction",
      };

      await processModificationRequest(request);

      expect(getModificationRequests()).toHaveLength(1);
    });

    it("should throw for invalid request", async () => {
      const request = {
        id: "mod-3",
        requestedBy: "user-1",
        requestedAt: new Date(),
        dataCategory: "politician",
        dataId: "pol-1",
        currentData: null,
        proposedData: { name: "New" },
        reason: "Correction",
      } as unknown as ModificationRequest;

      await expect(processModificationRequest(request)).rejects.toThrow(DataRetentionError);
    });
  });

  describe("processFalseDataRemovalRequest", () => {
    it("should process valid false data removal request", async () => {
      const request: FalseDataRemovalRequest = {
        id: "rem-1",
        requestedBy: "admin-1",
        requestedAt: new Date(),
        dataCategory: "politician",
        dataId: "pol-1",
        fieldToRemove: "birthDate",
        reason: "Incorrect date verified by official records",
        evidence: ["https://comelec.gov.ph/records/pol-1"],
      };

      const result = await processFalseDataRemovalRequest(request);

      expect(result.requestId).toBe("rem-1");
      expect(result.loggedToBlockchain).toBe(true);
      expect(["approved", "pending_verification", "rejected"]).toContain(result.status);
    });

    it("should store the removal request", async () => {
      const request: FalseDataRemovalRequest = {
        id: "rem-2",
        requestedBy: "admin-1",
        requestedAt: new Date(),
        dataCategory: "politician",
        dataId: "pol-1",
        fieldToRemove: "birthDate",
        reason: "Incorrect",
        evidence: ["https://source.gov.ph"],
      };

      await processFalseDataRemovalRequest(request);

      expect(getFalseDataRemovalRequests()).toHaveLength(1);
    });

    it("should throw for request without evidence", async () => {
      const request = {
        id: "rem-3",
        requestedBy: "admin-1",
        requestedAt: new Date(),
        dataCategory: "politician",
        dataId: "pol-1",
        fieldToRemove: "birthDate",
        reason: "Incorrect",
        evidence: [],
      } as FalseDataRemovalRequest;

      await expect(processFalseDataRemovalRequest(request)).rejects.toThrow(DataRetentionError);
    });
  });

  describe("Query Functions", () => {
    beforeEach(() => {
      // Create some test requests
      processDeletionRequest({
        id: "del-1",
        requestedBy: "user-1",
        requestedAt: new Date(),
        dataCategory: "politician",
        dataId: "pol-1",
        reason: "Test 1",
      });
      processDeletionRequest({
        id: "del-2",
        requestedBy: "user-2",
        requestedAt: new Date(),
        dataCategory: "politician",
        dataId: "pol-2",
        reason: "Test 2",
      });
    });

    it("getDeletionRequests should return all requests", () => {
      expect(getDeletionRequests()).toHaveLength(2);
    });

    it("getDeletionRequestsByDataId should filter by ID", () => {
      expect(getDeletionRequestsByDataId("pol-1")).toHaveLength(1);
      expect(getDeletionRequestsByDataId("pol-3")).toHaveLength(0);
    });
  });

  describe("getRequestCounts", () => {
    it("should return correct counts", () => {
      processDeletionRequest({
        id: "del-1",
        requestedBy: "user-1",
        requestedAt: new Date(),
        dataCategory: "politician",
        dataId: "pol-1",
        reason: "Test",
      });

      const counts = getRequestCounts();

      expect(counts.deletions).toBe(1);
      expect(counts.modifications).toBe(0);
      expect(counts.falseDataRemovals).toBe(0);
    });
  });

  describe("clearAllRequests", () => {
    it("should clear all requests", () => {
      processDeletionRequest({
        id: "del-1",
        requestedBy: "user-1",
        requestedAt: new Date(),
        dataCategory: "politician",
        dataId: "pol-1",
        reason: "Test",
      });

      expect(getDeletionRequests()).toHaveLength(1);

      clearAllRequests();

      expect(getDeletionRequests()).toHaveLength(0);
    });
  });
});
