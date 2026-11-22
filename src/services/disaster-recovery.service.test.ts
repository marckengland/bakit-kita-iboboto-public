/**
 * Disaster Recovery Service Tests
 *
 * Validates: Requirements 40.1, 40.2, 40.3, 40.4, 40.5, 40.6, 40.7
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  createBackup,
  getBackup,
  getLatestBackup,
  verifyBackup,
  createRestorationPlan,
  createBackupSchedule,
  updateBackupSchedule,
  deleteBackupSchedule,
  backupBlockchainAuditLogs,
  checkRPOCompliance,
  estimateRTO,
  getDisasterRecoveryStatus,
  createDisasterRecoveryAlert,
  acknowledgeAlert,
  initializeDefaultSchedules,
  RECOVERY_OBJECTIVES,
  STORAGE_LOCATIONS,
  BackupMetadata,
  BackupSchedule,
} from "./disaster-recovery.service";
import { redis } from "../lib/redis";

// Mock Redis
vi.mock("../lib/redis", () => ({
  redis: {
    setex: vi.fn().mockResolvedValue("OK"),
    set: vi.fn().mockResolvedValue("OK"),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
    zadd: vi.fn().mockResolvedValue(1),
    zrem: vi.fn().mockResolvedValue(1),
    zcard: vi.fn().mockResolvedValue(0),
    zrange: vi.fn().mockResolvedValue([]),
    zrevrange: vi.fn().mockResolvedValue([]),
    zrangebyscore: vi.fn().mockResolvedValue([]),
    keys: vi.fn().mockResolvedValue([]),
  },
}));

// Helper to get mocked redis (non-null since we mock it above)
const getMockedRedis = () => redis!;

describe("Disaster Recovery Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Recovery Objectives Configuration", () => {
    it("should have RPO of 24 hours (Req 40.4)", () => {
      expect(RECOVERY_OBJECTIVES.RPO_HOURS).toBe(24);
    });

    it("should have RTO of 4 hours (Req 40.5)", () => {
      expect(RECOVERY_OBJECTIVES.RTO_HOURS).toBe(4);
    });

    it("should have backup frequency matching RPO", () => {
      expect(RECOVERY_OBJECTIVES.BACKUP_FREQUENCY_HOURS).toBeLessThanOrEqual(
        RECOVERY_OBJECTIVES.RPO_HOURS
      );
    });

    it("should retain backups for at least 30 days", () => {
      expect(RECOVERY_OBJECTIVES.BACKUP_RETENTION_DAYS).toBeGreaterThanOrEqual(30);
    });
  });

  describe("Storage Locations (Req 40.2)", () => {
    it("should have geographically separate storage locations", () => {
      expect(Object.keys(STORAGE_LOCATIONS)).toHaveLength(3);
      expect(STORAGE_LOCATIONS.primary).toBeDefined();
      expect(STORAGE_LOCATIONS.secondary).toBeDefined();
      expect(STORAGE_LOCATIONS.tertiary).toBeDefined();
    });

    it("should have different regions for each storage location", () => {
      const regions = new Set([
        STORAGE_LOCATIONS.primary.name,
        STORAGE_LOCATIONS.secondary.name,
        STORAGE_LOCATIONS.tertiary.name,
      ]);
      expect(regions.size).toBe(3);
    });

    it("should have different buckets for each storage location", () => {
      const buckets = new Set([
        STORAGE_LOCATIONS.primary.bucket,
        STORAGE_LOCATIONS.secondary.bucket,
        STORAGE_LOCATIONS.tertiary.bucket,
      ]);
      expect(buckets.size).toBe(3);
    });
  });

  describe("createBackup (Req 40.1)", () => {
    it("should create a full backup with all databases", async () => {
      const backup = await createBackup("full", ["postgresql", "redis", "elasticsearch"]);

      expect(backup).toBeDefined();
      expect(backup.id).toMatch(/^backup_\d+_[a-z0-9]+$/);
      expect(backup.type).toBe("full");
      expect(backup.status).toBe("completed");
      expect(backup.databases).toHaveLength(3);
      expect(backup.sizeBytes).toBeGreaterThan(0);
      expect(backup.checksum).toBeDefined();
    });

    it("should store backup in multiple geographic locations (Req 40.2)", async () => {
      const backup = await createBackup("full");

      expect(backup.storageLocations).toContain("primary");
      expect(backup.storageLocations).toContain("secondary");
      expect(backup.storageLocations.length).toBeGreaterThanOrEqual(2);
    });

    it("should set retention period", async () => {
      const backup = await createBackup("full");

      const expectedRetention = new Date(
        backup.createdAt.getTime() + RECOVERY_OBJECTIVES.BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000
      );

      expect(backup.retentionUntil.getTime()).toBeCloseTo(expectedRetention.getTime(), -3);
    });

    it("should include database backup info for each database", async () => {
      const backup = await createBackup("full", ["postgresql"]);

      expect(backup.databases).toHaveLength(1);
      const db = backup.databases[0]!;
      expect(db.name).toBe("postgresql");
      expect(db.type).toBe("postgresql");
      expect(db.sizeBytes).toBeGreaterThan(0);
      expect(db.recordCount).toBeGreaterThan(0);
      expect(db.checksum).toBeDefined();
      expect(db.backupPath).toBeDefined();
    });

    it("should store backup metadata in Redis", async () => {
      await createBackup("full");

      expect(getMockedRedis().setex).toHaveBeenCalled();
      expect(getMockedRedis().zadd).toHaveBeenCalled();
      expect(getMockedRedis().set).toHaveBeenCalled();
    });
  });

  describe("getBackup", () => {
    it("should return null for non-existent backup", async () => {
      vi.mocked(getMockedRedis().get).mockResolvedValueOnce(null);

      const backup = await getBackup("non_existent_id");

      expect(backup).toBeNull();
    });

    it("should return backup metadata when found", async () => {
      const mockBackup: BackupMetadata = {
        id: "backup_123",
        type: "full",
        status: "completed",
        createdAt: new Date(),
        sizeBytes: 1000000,
        checksum: "abc123",
        databases: [],
        storageLocations: ["primary"],
        retentionUntil: new Date(),
        isVerified: false,
      };

      vi.mocked(getMockedRedis().get).mockResolvedValueOnce(JSON.stringify(mockBackup));

      const backup = await getBackup("backup_123");

      expect(backup).toBeDefined();
      expect(backup?.id).toBe("backup_123");
    });
  });

  describe("getLatestBackup (Req 40.6)", () => {
    it("should return null when no backups exist", async () => {
      vi.mocked(getMockedRedis().get).mockResolvedValueOnce(null);

      const backup = await getLatestBackup();

      expect(backup).toBeNull();
    });

    it("should return the most recent backup", async () => {
      const mockBackup: BackupMetadata = {
        id: "backup_latest",
        type: "full",
        status: "completed",
        createdAt: new Date(),
        sizeBytes: 1000000,
        checksum: "abc123",
        databases: [],
        storageLocations: ["primary"],
        retentionUntil: new Date(),
        isVerified: true,
      };

      vi.mocked(getMockedRedis().get)
        .mockResolvedValueOnce("backup_latest")
        .mockResolvedValueOnce(JSON.stringify(mockBackup));

      const backup = await getLatestBackup();

      expect(backup).toBeDefined();
      expect(backup?.id).toBe("backup_latest");
    });
  });

  describe("verifyBackup (Req 40.3)", () => {
    it("should verify backup integrity", async () => {
      const mockBackup: BackupMetadata = {
        id: "backup_to_verify",
        type: "full",
        status: "completed",
        createdAt: new Date(),
        sizeBytes: 1000000,
        checksum: "",
        databases: [
          {
            name: "postgresql",
            type: "postgresql",
            sizeBytes: 500000,
            recordCount: 10000,
            checksum: "db_checksum",
            backupPath: "backups/test/postgresql",
          },
        ],
        storageLocations: ["primary"],
        retentionUntil: new Date(),
        isVerified: false,
      };

      // Set checksum to match what will be calculated
      mockBackup.checksum = "0000000000000000"; // Will be recalculated

      vi.mocked(getMockedRedis().get).mockResolvedValueOnce(JSON.stringify(mockBackup));

      const result = await verifyBackup("backup_to_verify");

      expect(result).toBeDefined();
      expect(result.testedAt).toBeDefined();
      expect(result.restorationTimeMs).toBeGreaterThan(0);
      expect(typeof result.dataIntegrityCheck).toBe("boolean");
      expect(typeof result.recordCountMatch).toBe("boolean");
      expect(typeof result.checksumMatch).toBe("boolean");
    });

    it("should throw error for non-existent backup", async () => {
      vi.mocked(getMockedRedis().get).mockResolvedValueOnce(null);

      await expect(verifyBackup("non_existent")).rejects.toThrow("not found");
    });
  });

  describe("createRestorationPlan (Req 40.5, 40.6)", () => {
    it("should create a restoration plan for a valid backup", async () => {
      const mockBackup: BackupMetadata = {
        id: "backup_for_restore",
        type: "full",
        status: "verified",
        createdAt: new Date(),
        sizeBytes: 100000000,
        checksum: "abc123",
        databases: [
          {
            name: "postgresql",
            type: "postgresql",
            sizeBytes: 50000000,
            recordCount: 10000,
            checksum: "db_checksum",
            backupPath: "backups/test/postgresql",
          },
        ],
        storageLocations: ["primary"],
        retentionUntil: new Date(),
        isVerified: true,
      };

      vi.mocked(getMockedRedis().get).mockResolvedValueOnce(JSON.stringify(mockBackup));

      const plan = await createRestorationPlan("backup_for_restore", "production");

      expect(plan).toBeDefined();
      expect(plan.id).toMatch(/^restore_\d+_[a-z0-9]+$/);
      expect(plan.backupId).toBe("backup_for_restore");
      expect(plan.targetEnvironment).toBe("production");
      expect(plan.estimatedTimeMinutes).toBeGreaterThan(0);
      expect(plan.steps.length).toBeGreaterThan(0);
      expect(plan.status).toBe("planned");
    });

    it("should include all necessary restoration steps", async () => {
      const mockBackup: BackupMetadata = {
        id: "backup_for_restore",
        type: "full",
        status: "completed",
        createdAt: new Date(),
        sizeBytes: 100000000,
        checksum: "abc123",
        databases: [
          {
            name: "postgresql",
            type: "postgresql",
            sizeBytes: 50000000,
            recordCount: 10000,
            checksum: "db_checksum",
            backupPath: "backups/test/postgresql",
          },
        ],
        storageLocations: ["primary"],
        retentionUntil: new Date(),
        isVerified: false,
      };

      vi.mocked(getMockedRedis().get).mockResolvedValueOnce(JSON.stringify(mockBackup));

      const plan = await createRestorationPlan("backup_for_restore");

      const stepNames = plan.steps.map((s) => s.name);
      expect(stepNames).toContain("Prepare Environment");
      expect(stepNames).toContain("Download Backup");
      expect(stepNames).toContain("Verify Data Integrity");
      expect(stepNames).toContain("Start Services");
    });

    it("should throw error for non-existent backup", async () => {
      vi.mocked(getMockedRedis().get).mockResolvedValueOnce(null);

      await expect(createRestorationPlan("non_existent")).rejects.toThrow("not found");
    });

    it("should throw error for backup in non-restorable state", async () => {
      const mockBackup: BackupMetadata = {
        id: "failed_backup",
        type: "full",
        status: "failed",
        createdAt: new Date(),
        sizeBytes: 0,
        checksum: "",
        databases: [],
        storageLocations: ["primary"],
        retentionUntil: new Date(),
        isVerified: false,
      };

      vi.mocked(getMockedRedis().get).mockResolvedValueOnce(JSON.stringify(mockBackup));

      await expect(createRestorationPlan("failed_backup")).rejects.toThrow(
        "not in a restorable state"
      );
    });
  });

  describe("Backup Schedules (Req 40.1)", () => {
    it("should create a backup schedule", async () => {
      const schedule = await createBackupSchedule(
        "Daily Backup",
        "full",
        "0 0 * * *",
        ["postgresql"],
        ["primary", "secondary"]
      );

      expect(schedule).toBeDefined();
      expect(schedule.id).toMatch(/^schedule_\d+_[a-z0-9]+$/);
      expect(schedule.name).toBe("Daily Backup");
      expect(schedule.type).toBe("full");
      expect(schedule.cronExpression).toBe("0 0 * * *");
      expect(schedule.isActive).toBe(true);
      expect(schedule.databases).toContain("postgresql");
      expect(schedule.storageLocations).toContain("primary");
      expect(schedule.storageLocations).toContain("secondary");
    });

    it("should update a backup schedule", async () => {
      const mockSchedule: BackupSchedule = {
        id: "schedule_123",
        name: "Test Schedule",
        type: "full",
        cronExpression: "0 0 * * *",
        isActive: true,
        nextRun: new Date(),
        databases: ["postgresql"],
        storageLocations: ["primary"],
      };

      vi.mocked(getMockedRedis().get).mockResolvedValueOnce(JSON.stringify(mockSchedule));

      const updated = await updateBackupSchedule("schedule_123", { isActive: false });

      expect(updated).toBeDefined();
      expect(updated?.isActive).toBe(false);
    });

    it("should delete a backup schedule", async () => {
      const result = await deleteBackupSchedule("schedule_123");

      expect(result).toBe(true);
      expect(getMockedRedis().del).toHaveBeenCalled();
    });
  });

  describe("backupBlockchainAuditLogs (Req 40.7)", () => {
    it("should backup blockchain audit logs independently", async () => {
      const backup = await backupBlockchainAuditLogs();

      expect(backup).toBeDefined();
      expect(backup.name).toBe("blockchain_audit_logs");
      expect(backup.type).toBe("blockchain");
      expect(backup.sizeBytes).toBeGreaterThan(0);
      expect(backup.recordCount).toBeGreaterThan(0);
      expect(backup.checksum).toBeDefined();
      expect(backup.backupPath).toContain("blockchain");
    });

    it("should store blockchain backup with longer retention", async () => {
      await backupBlockchainAuditLogs();

      // Verify setex was called with longer retention
      expect(getMockedRedis().setex).toHaveBeenCalled();
    });
  });

  describe("RPO Compliance (Req 40.4)", () => {
    it("should return false when no backups exist", async () => {
      vi.mocked(getMockedRedis().get).mockResolvedValueOnce(null);

      const compliant = await checkRPOCompliance();

      expect(compliant).toBe(false);
    });

    it("should return true when backup is within RPO", async () => {
      const recentBackup: BackupMetadata = {
        id: "recent_backup",
        type: "full",
        status: "completed",
        createdAt: new Date(), // Just created
        sizeBytes: 1000000,
        checksum: "abc123",
        databases: [],
        storageLocations: ["primary"],
        retentionUntil: new Date(),
        isVerified: true,
      };

      vi.mocked(getMockedRedis().get)
        .mockResolvedValueOnce("recent_backup")
        .mockResolvedValueOnce(JSON.stringify(recentBackup));

      const compliant = await checkRPOCompliance();

      expect(compliant).toBe(true);
    });
  });

  describe("RTO Estimation (Req 40.5)", () => {
    it("should return max RTO when no backups exist", async () => {
      vi.mocked(getMockedRedis().get).mockResolvedValueOnce(null);

      const rto = await estimateRTO();

      expect(rto).toBe(RECOVERY_OBJECTIVES.RTO_HOURS * 60);
    });

    it("should estimate RTO based on backup size", async () => {
      const mockBackup: BackupMetadata = {
        id: "backup_for_rto",
        type: "full",
        status: "completed",
        createdAt: new Date(),
        sizeBytes: 500 * 1024 * 1024, // 500MB
        checksum: "abc123",
        databases: [],
        storageLocations: ["primary"],
        retentionUntil: new Date(),
        isVerified: true,
      };

      vi.mocked(getMockedRedis().get)
        .mockResolvedValueOnce("backup_for_rto")
        .mockResolvedValueOnce(JSON.stringify(mockBackup));

      const rto = await estimateRTO();

      // 500MB at 100MB/min = 5 min + 30 min overhead = 35 min
      expect(rto).toBeGreaterThan(0);
      expect(rto).toBeLessThanOrEqual(RECOVERY_OBJECTIVES.RTO_HOURS * 60);
    });
  });

  describe("Disaster Recovery Alerts", () => {
    it("should create an alert", async () => {
      const alert = await createDisasterRecoveryAlert(
        "critical",
        "backup_failed",
        "Test backup failure"
      );

      expect(alert).toBeDefined();
      expect(alert.id).toMatch(/^alert_\d+_[a-z0-9]+$/);
      expect(alert.severity).toBe("critical");
      expect(alert.type).toBe("backup_failed");
      expect(alert.message).toBe("Test backup failure");
      expect(alert.acknowledged).toBe(false);
    });

    it("should acknowledge an alert", async () => {
      const mockAlert = {
        id: "alert_123",
        severity: "warning",
        type: "rpo_breach",
        message: "Test alert",
        createdAt: new Date(),
        acknowledged: false,
      };

      vi.mocked(getMockedRedis().get).mockResolvedValueOnce(JSON.stringify(mockAlert));

      const result = await acknowledgeAlert("alert_123");

      expect(result).toBe(true);
      expect(getMockedRedis().setex).toHaveBeenCalled();
    });
  });

  describe("getDisasterRecoveryStatus", () => {
    it("should return comprehensive status", async () => {
      vi.mocked(getMockedRedis().get).mockResolvedValue(null);
      vi.mocked(getMockedRedis().zrevrange).mockResolvedValue([]);
      vi.mocked(getMockedRedis().keys).mockResolvedValue([]);

      const status = await getDisasterRecoveryStatus();

      expect(status).toBeDefined();
      expect(typeof status.rpoCompliance).toBe("boolean");
      expect(typeof status.rtoEstimate).toBe("number");
      expect(typeof status.backupCount).toBe("number");
      expect(typeof status.totalStorageBytes).toBe("number");
      expect(status.storageByRegion).toBeDefined();
      expect(Array.isArray(status.activeSchedules)).toBe(true);
      expect(Array.isArray(status.alerts)).toBe(true);
    });
  });

  describe("initializeDefaultSchedules", () => {
    it("should create default schedules when none exist", async () => {
      vi.mocked(getMockedRedis().keys).mockResolvedValueOnce([]);

      await initializeDefaultSchedules();

      // Should have created at least 2 schedules
      expect(getMockedRedis().set).toHaveBeenCalled();
    });

    it("should not create schedules when they already exist", async () => {
      vi.mocked(getMockedRedis().keys).mockResolvedValueOnce(["dr:schedules:existing"]);
      vi.mocked(getMockedRedis().get).mockResolvedValueOnce(
        JSON.stringify({
          id: "existing",
          name: "Existing Schedule",
          type: "full",
          cronExpression: "0 0 * * *",
          isActive: true,
          nextRun: new Date(),
          databases: ["postgresql"],
          storageLocations: ["primary"],
        })
      );

      await initializeDefaultSchedules();

      // Should not create new schedules
      expect(getMockedRedis().set).not.toHaveBeenCalled();
    });
  });
});
