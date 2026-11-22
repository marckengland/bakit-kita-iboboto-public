/**
 * Data Pipeline Service Tests
 *
 * Unit tests for the data pipeline scheduler, scrapers, and freshness dashboard.
 *
 * **Validates: Requirements 20.1, 20.2, 20.3, 20.7, 20.8, 20.9**
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { scrapeHouseWebsite } from "./scrapers";
import {
  // Types
  DataSourceType,
  // Constants
  DATA_SOURCES,
  SOURCE_URLS,
  SOURCE_DESCRIPTIONS,
  DEFAULT_SCHEDULES,
  // Helper functions
  generateJobId,
  generateAlertId,
  isValidSource,
  daysSince,
  getNextScheduledTime,
  // Job management
  createScrapeJob,
  getScrapeJob,
  updateScrapeJob,
  getJobsForSource,
  getLatestJob,
  getRecentJobs,
  // Scrape operations
  triggerScrape,
  triggerAllScrapes,
  retryJob,
  getScraper,
  // Alert management
  createScrapeAlert,
  getAlerts,
  acknowledgeAlert,
  getUnacknowledgedAlertCount,
  // Freshness
  getSourceFreshness,
  getDataFreshness,
  checkStaleData,
  // Schedule management
  getScheduleConfig,
  updateScheduleConfig,
  getAllScheduleConfigs,
  setSourceEnabled,
  // Scheduler
  startScheduler,
  stopScheduler,
  isSchedulerRunning,
  // Test utilities
  clearAllJobs,
  clearAllAlerts,
  resetScheduleConfigs,
  // Error
  DataPipelineError,
} from "./data-pipeline.service";

// Keep pipeline orchestration real; replace HTTP/browser extraction at its boundary.
vi.mock("./scrapers", () => ({
  scrapeSenateWebsite: vi.fn().mockResolvedValue([]),
  scrapeHouseWebsite: vi.fn().mockResolvedValue([]),
  scrapeComelecWebsite: vi.fn().mockResolvedValue([]),
  scrapeDbmWebsite: vi.fn().mockResolvedValue([]),
  scrapeCoaWebsite: vi.fn().mockResolvedValue([]),
  scrapeCourtWebsite: vi.fn().mockResolvedValue([]),
  scrapeOmbudsmanWebsite: vi.fn().mockResolvedValue([]),
  scrapePoliticians: vi.fn().mockResolvedValue([]),
}));

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  default: {
    bill: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    politician: {
      findFirst: vi.fn(),
    },
    electionResultRecord: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    project: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    cOAFinding: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    controversy: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock Redis cache
vi.mock("@/lib/redis", () => ({
  cache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(true),
    del: vi.fn().mockResolvedValue(true),
  },
  CACHE_KEYS: {
    POLITICIAN: "politician:",
  },
  CACHE_TTL: {
    SHORT: 60,
    MEDIUM: 300,
    LONG: 3600,
  },
}));

describe("Data Pipeline Service", () => {
  beforeEach(() => {
    vi.stubEnv("AI_RESEARCH_ENABLED", "false");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unexpected external request")));
    vi.mocked(scrapeHouseWebsite).mockReset().mockResolvedValue([]);
    clearAllJobs();
    clearAllAlerts();
    resetScheduleConfigs();
    stopScheduler();
  });

  afterEach(() => {
    try {
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      stopScheduler();
      vi.clearAllMocks();
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });

  // ============================================
  // Constants Tests
  // ============================================

  describe("Constants", () => {
    it("should have all required data sources", () => {
      expect(DATA_SOURCES).toContain("senate");
      expect(DATA_SOURCES).toContain("house");
      expect(DATA_SOURCES).toContain("comelec");
      expect(DATA_SOURCES).toContain("dbm");
      expect(DATA_SOURCES).toContain("coa");
      expect(DATA_SOURCES).toContain("courts");
      expect(DATA_SOURCES).toContain("ombudsman");
    });

    it("should have URLs for all sources", () => {
      for (const source of DATA_SOURCES) {
        expect(SOURCE_URLS[source]).toBeDefined();
        expect(SOURCE_URLS[source]).toMatch(/^https?:\/\//);
      }
    });

    it("should have descriptions for all sources", () => {
      for (const source of DATA_SOURCES) {
        expect(SOURCE_DESCRIPTIONS[source]).toBeDefined();
        expect(SOURCE_DESCRIPTIONS[source].length).toBeGreaterThan(0);
      }
    });

    it("should have default schedules for all sources", () => {
      const scheduledSources = DEFAULT_SCHEDULES.map((s) => s.source);
      for (const source of DATA_SOURCES) {
        expect(scheduledSources).toContain(source);
      }
    });
  });

  // ============================================
  // Helper Functions Tests
  // ============================================

  describe("Helper Functions", () => {
    describe("generateJobId", () => {
      it("should generate unique job IDs", () => {
        const id1 = generateJobId();
        const id2 = generateJobId();
        expect(id1).not.toBe(id2);
        expect(id1).toMatch(/^job_\d+_[a-z0-9]+$/);
      });
    });

    describe("generateAlertId", () => {
      it("should generate unique alert IDs", () => {
        const id1 = generateAlertId();
        const id2 = generateAlertId();
        expect(id1).not.toBe(id2);
        expect(id1).toMatch(/^alert_\d+_[a-z0-9]+$/);
      });
    });

    describe("isValidSource", () => {
      it("should return true for valid sources", () => {
        expect(isValidSource("senate")).toBe(true);
        expect(isValidSource("house")).toBe(true);
        expect(isValidSource("comelec")).toBe(true);
        expect(isValidSource("dbm")).toBe(true);
        expect(isValidSource("coa")).toBe(true);
      });

      it("should return false for invalid sources", () => {
        expect(isValidSource("invalid")).toBe(false);
        expect(isValidSource("")).toBe(false);
        expect(isValidSource("SENATE")).toBe(false);
      });
    });

    describe("daysSince", () => {
      it("should return 0 for today", () => {
        const today = new Date();
        expect(daysSince(today)).toBe(0);
      });

      it("should return correct days for past dates", () => {
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        expect(daysSince(threeDaysAgo)).toBe(3);
      });

      it("should return Infinity for null", () => {
        expect(daysSince(null)).toBe(Infinity);
      });
    });

    describe("getNextScheduledTime", () => {
      it("should return a future date", () => {
        const next = getNextScheduledTime("0 2 * * *");
        expect(next.getTime()).toBeGreaterThan(Date.now());
      });
    });
  });

  // ============================================
  // Job Management Tests
  // ============================================

  describe("Job Management", () => {
    describe("createScrapeJob", () => {
      it("should create a job with pending status", () => {
        const job = createScrapeJob("senate");
        expect(job.source).toBe("senate");
        expect(job.status).toBe("pending");
        expect(job.recordsProcessed).toBe(0);
        expect(job.recordsAdded).toBe(0);
        expect(job.recordsUpdated).toBe(0);
        expect(job.errors).toEqual([]);
        expect(job.retryCount).toBe(0);
      });

      it("should create jobs with unique IDs", () => {
        const job1 = createScrapeJob("senate");
        const job2 = createScrapeJob("senate");
        expect(job1.id).not.toBe(job2.id);
      });
    });

    describe("getScrapeJob", () => {
      it("should return job by ID", () => {
        const created = createScrapeJob("house");
        const retrieved = getScrapeJob(created.id);
        expect(retrieved).toEqual(created);
      });

      it("should return null for non-existent job", () => {
        expect(getScrapeJob("non_existent")).toBeNull();
      });
    });

    describe("updateScrapeJob", () => {
      it("should update job properties", () => {
        const job = createScrapeJob("comelec");
        const updated = updateScrapeJob(job.id, {
          status: "running",
          recordsProcessed: 10,
        });
        expect(updated?.status).toBe("running");
        expect(updated?.recordsProcessed).toBe(10);
      });

      it("should return null for non-existent job", () => {
        expect(updateScrapeJob("non_existent", { status: "running" })).toBeNull();
      });
    });

    describe("getJobsForSource", () => {
      it("should return jobs for specific source", () => {
        createScrapeJob("senate");
        createScrapeJob("senate");
        createScrapeJob("house");

        const senateJobs = getJobsForSource("senate");
        expect(senateJobs.length).toBe(2);
        expect(senateJobs.every((j) => j.source === "senate")).toBe(true);
      });

      it("should return jobs sorted by date descending", () => {
        const job1 = createScrapeJob("dbm");
        // Update job1 to have an earlier start time
        updateScrapeJob(job1.id, { startedAt: new Date(Date.now() - 10000) });
        const job2 = createScrapeJob("dbm");

        const jobs = getJobsForSource("dbm");
        const firstJob = jobs[0];
        const secondJob = jobs[1];
        expect(firstJob?.id).toBe(job2.id);
        expect(secondJob?.id).toBe(job1.id);
      });
    });

    describe("getLatestJob", () => {
      it("should return most recent job for source", () => {
        const job1 = createScrapeJob("coa");
        // Update job1 to have an earlier start time
        updateScrapeJob(job1.id, { startedAt: new Date(Date.now() - 10000) });
        const latest = createScrapeJob("coa");

        expect(getLatestJob("coa")?.id).toBe(latest.id);
      });

      it("should return null if no jobs exist", () => {
        expect(getLatestJob("courts")).toBeNull();
      });
    });

    describe("getRecentJobs", () => {
      it("should return jobs sorted by date", () => {
        createScrapeJob("senate");
        createScrapeJob("house");
        createScrapeJob("comelec");

        const recent = getRecentJobs(2);
        expect(recent.length).toBe(2);
      });

      it("should respect limit parameter", () => {
        for (let i = 0; i < 10; i++) {
          createScrapeJob("senate");
        }

        expect(getRecentJobs(5).length).toBe(5);
      });
    });
  });

  // ============================================
  // Scrape Operations Tests
  // ============================================

  describe("Scrape Operations", () => {
    describe("getScraper", () => {
      it("should return scraper function for each source", () => {
        for (const source of DATA_SOURCES) {
          const scraper = getScraper(source);
          expect(typeof scraper).toBe("function");
        }
      });
    });

    describe("triggerScrape", () => {
      it("should create and run a scrape job", async () => {
        const job = await triggerScrape("senate");
        expect(job.source).toBe("senate");
        expect(["completed", "failed"]).toContain(job.status);
        expect(job.completedAt).not.toBeNull();
      });

      it("should throw error for invalid source", async () => {
        await expect(triggerScrape("invalid" as DataSourceType)).rejects.toThrow(DataPipelineError);
      });
    });

    describe("triggerAllScrapes", () => {
      it("should trigger scrapes for all enabled sources", async () => {
        const jobs = await triggerAllScrapes();
        expect(jobs.length).toBeGreaterThan(0);
      });

      it("should complete jobs for every enabled source", async () => {
        const jobs = await triggerAllScrapes();

        expect(jobs.map((job) => job.source)).toEqual([
          "senate",
          "house",
          "comelec",
          "dbm",
          "coa",
          "courts",
          "ombudsman",
          "politicians",
        ]);
        for (const job of jobs) {
          expect(job.status).toBe("completed");
          expect(job.completedAt).toBeInstanceOf(Date);
          expect(job.errors).toEqual([]);
        }
      });

      it("should leave disabled sources out of the returned jobs", async () => {
        setSourceEnabled("house", false);
        setSourceEnabled("politicians", false);

        const jobs = await triggerAllScrapes();

        expect(jobs.map((job) => job.source)).toEqual([
          "senate",
          "comelec",
          "dbm",
          "coa",
          "courts",
          "ombudsman",
        ]);
      });

      it("should record a scraper failure and continue the other enabled sources", async () => {
        vi.mocked(scrapeHouseWebsite).mockRejectedValueOnce(new Error("House fixture failed"));

        const jobs = await triggerAllScrapes();
        const house = jobs.find((job) => job.source === "house");

        expect(jobs).toHaveLength(8);
        expect(house?.status).toBe("failed");
        expect(house?.errors).toEqual(["House scrape failed: Error: House fixture failed"]);
        expect(house?.completedAt).toBeInstanceOf(Date);
        expect(jobs.filter((job) => job.source !== "house").map((job) => job.status)).toEqual([
          "completed",
          "completed",
          "completed",
          "completed",
          "completed",
          "completed",
          "completed",
        ]);
        expect(
          getAlerts().some((alert) => alert.jobId === house?.id && alert.source === "house")
        ).toBe(true);
      });
    });

    describe("retryJob", () => {
      it("should throw error for non-existent job", async () => {
        await expect(retryJob("non_existent")).rejects.toThrow(DataPipelineError);
      });

      it("should throw error when max retries exceeded", async () => {
        const job = createScrapeJob("senate");
        updateScrapeJob(job.id, { retryCount: 5, status: "failed" });

        await expect(retryJob(job.id)).rejects.toThrow("Max retries");
      });
    });
  });

  // ============================================
  // Alert Management Tests
  // ============================================

  describe("Alert Management", () => {
    describe("createScrapeAlert", () => {
      it("should create alert with correct properties", async () => {
        const alert = await createScrapeAlert("senate", "job_123", "failure", [
          "Connection timeout",
        ]);

        expect(alert.source).toBe("senate");
        expect(alert.jobId).toBe("job_123");
        expect(alert.alertType).toBe("failure");
        expect(alert.severity).toBe("critical");
        expect(alert.acknowledged).toBe(false);
        expect(alert.message).toContain("Connection timeout");
      });

      it("should set warning severity for non-failure alerts", async () => {
        const alert = await createScrapeAlert("house", "job_456", "stale_data", [
          "Data is 10 days old",
        ]);

        expect(alert.severity).toBe("warning");
      });
    });

    describe("getAlerts", () => {
      it("should return all alerts", async () => {
        await createScrapeAlert("senate", "job_1", "failure", ["Error 1"]);
        await createScrapeAlert("house", "job_2", "failure", ["Error 2"]);

        const alerts = getAlerts();
        expect(alerts.length).toBe(2);
      });

      it("should filter by source", async () => {
        await createScrapeAlert("senate", "job_1", "failure", ["Error"]);
        await createScrapeAlert("house", "job_2", "failure", ["Error"]);

        const senateAlerts = getAlerts({ source: "senate" });
        expect(senateAlerts.length).toBe(1);
        const firstAlert = senateAlerts[0];
        expect(firstAlert?.source).toBe("senate");
      });

      it("should filter by acknowledged status", async () => {
        const alert = await createScrapeAlert("senate", "job_1", "failure", ["Error"]);
        await createScrapeAlert("house", "job_2", "failure", ["Error"]);
        acknowledgeAlert(alert.id, "admin_1");

        const unacknowledged = getAlerts({ acknowledged: false });
        expect(unacknowledged.length).toBe(1);
      });

      it("should filter by severity", async () => {
        await createScrapeAlert("senate", "job_1", "failure", ["Error"]);
        await createScrapeAlert("house", "job_2", "stale_data", ["Stale"]);

        const critical = getAlerts({ severity: "critical" });
        expect(critical.length).toBe(1);
      });

      it("should respect limit parameter", async () => {
        for (let i = 0; i < 10; i++) {
          await createScrapeAlert("senate", `job_${i}`, "failure", ["Error"]);
        }

        const limited = getAlerts({ limit: 5 });
        expect(limited.length).toBe(5);
      });
    });

    describe("acknowledgeAlert", () => {
      it("should mark alert as acknowledged", async () => {
        const alert = await createScrapeAlert("senate", "job_1", "failure", ["Error"]);
        const acknowledged = acknowledgeAlert(alert.id, "admin_user");

        expect(acknowledged?.acknowledged).toBe(true);
        expect(acknowledged?.acknowledgedBy).toBe("admin_user");
        expect(acknowledged?.acknowledgedAt).not.toBeNull();
      });

      it("should return null for non-existent alert", () => {
        expect(acknowledgeAlert("non_existent", "admin")).toBeNull();
      });
    });

    describe("getUnacknowledgedAlertCount", () => {
      it("should return count of unacknowledged alerts", async () => {
        const alert1 = await createScrapeAlert("senate", "job_1", "failure", ["Error"]);
        await createScrapeAlert("house", "job_2", "failure", ["Error"]);
        acknowledgeAlert(alert1.id, "admin");

        expect(getUnacknowledgedAlertCount()).toBe(1);
      });
    });
  });

  // ============================================
  // Data Freshness Tests
  // ============================================

  describe("Data Freshness", () => {
    describe("getSourceFreshness", () => {
      it("should return freshness status for source", () => {
        const freshness = getSourceFreshness("senate");
        expect(freshness.source).toBe("senate");
        expect(freshness).toHaveProperty("lastSuccessfulScrape");
        expect(freshness).toHaveProperty("lastAttemptedScrape");
        expect(freshness).toHaveProperty("isStale");
        expect(freshness).toHaveProperty("staleDays");
        expect(freshness).toHaveProperty("nextScheduledScrape");
      });

      it("should mark source as stale when no jobs exist", () => {
        const freshness = getSourceFreshness("senate");
        expect(freshness.isStale).toBe(true);
        expect(freshness.staleDays).toBe(-1); // Infinity converted to -1
      });

      it("should mark source as not stale after successful scrape", () => {
        const job = createScrapeJob("senate");
        updateScrapeJob(job.id, {
          status: "completed",
          completedAt: new Date(),
        });

        const freshness = getSourceFreshness("senate");
        expect(freshness.isStale).toBe(false);
        expect(freshness.staleDays).toBe(0);
      });
    });

    describe("getDataFreshness", () => {
      it("should return freshness report for all sources", async () => {
        const report = await getDataFreshness();
        expect(report.generatedAt).toBeInstanceOf(Date);
        expect(report.sources.length).toBe(DATA_SOURCES.length);
        expect(["healthy", "degraded", "critical"]).toContain(report.overallHealth);
      });

      it("should report critical health when many sources are stale", async () => {
        // All sources are stale by default (no jobs)
        const report = await getDataFreshness();
        expect(report.overallHealth).toBe("critical");
      });

      it("should report healthy when all sources have recent data", async () => {
        // Create successful jobs for all sources
        for (const source of DATA_SOURCES) {
          const job = createScrapeJob(source);
          updateScrapeJob(job.id, {
            status: "completed",
            completedAt: new Date(),
          });
        }

        const report = await getDataFreshness();
        expect(report.overallHealth).toBe("healthy");
      });
    });

    describe("checkStaleData", () => {
      it("should create alerts for stale sources", async () => {
        const alerts = await checkStaleData();
        // All sources are stale by default
        expect(alerts.length).toBeGreaterThan(0);
        expect(alerts.every((a) => a.alertType === "stale_data")).toBe(true);
      });
    });
  });

  // ============================================
  // Schedule Management Tests
  // ============================================

  describe("Schedule Management", () => {
    describe("getScheduleConfig", () => {
      it("should return config for valid source", () => {
        const config = getScheduleConfig("senate");
        expect(config).not.toBeNull();
        expect(config?.source).toBe("senate");
        expect(config?.cronExpression).toBeDefined();
        expect(config?.enabled).toBe(true);
      });
    });

    describe("updateScheduleConfig", () => {
      it("should update schedule configuration", () => {
        const updated = updateScheduleConfig("senate", {
          enabled: false,
          maxRetries: 5,
        });

        expect(updated.enabled).toBe(false);
        expect(updated.maxRetries).toBe(5);
      });

      it("should throw error for invalid source", () => {
        expect(() => updateScheduleConfig("invalid" as DataSourceType, { enabled: false })).toThrow(
          DataPipelineError
        );
      });
    });

    describe("getAllScheduleConfigs", () => {
      it("should return configs for all sources", () => {
        const configs = getAllScheduleConfigs();
        expect(configs.length).toBe(DATA_SOURCES.length);
      });
    });

    describe("setSourceEnabled", () => {
      it("should enable/disable source", () => {
        setSourceEnabled("senate", false);
        expect(getScheduleConfig("senate")?.enabled).toBe(false);

        setSourceEnabled("senate", true);
        expect(getScheduleConfig("senate")?.enabled).toBe(true);
      });
    });
  });

  // ============================================
  // Scheduler Tests
  // ============================================

  describe("Scheduler", () => {
    describe("startScheduler", () => {
      it("should start the scheduler", () => {
        expect(isSchedulerRunning()).toBe(false);
        startScheduler();
        expect(isSchedulerRunning()).toBe(true);
      });

      it("should not start multiple schedulers", () => {
        startScheduler();
        startScheduler(); // Should not throw
        expect(isSchedulerRunning()).toBe(true);
      });
    });

    describe("stopScheduler", () => {
      it("should stop the scheduler", () => {
        startScheduler();
        expect(isSchedulerRunning()).toBe(true);
        stopScheduler();
        expect(isSchedulerRunning()).toBe(false);
      });

      it("should handle stopping when not running", () => {
        stopScheduler(); // Should not throw
        expect(isSchedulerRunning()).toBe(false);
      });
    });
  });

  // ============================================
  // Requirements Validation Tests
  // ============================================

  describe("Requirements Validation", () => {
    /**
     * Requirement 20.1: THE System SHALL automatically scrape or pull data
     * from official government sources including Senate, House of Representatives,
     * COMELEC, DBM, and COA websites on a scheduled basis
     */
    describe("Requirement 20.1 - Scheduled Scraping", () => {
      it("should have scrapers for all required sources", () => {
        const requiredSources: DataSourceType[] = ["senate", "house", "comelec", "dbm", "coa"];

        for (const source of requiredSources) {
          expect(getScraper(source)).toBeDefined();
          expect(typeof getScraper(source)).toBe("function");
        }
      });

      it("should have schedules for all required sources", () => {
        const requiredSources: DataSourceType[] = ["senate", "house", "comelec", "dbm", "coa"];

        for (const source of requiredSources) {
          const config = getScheduleConfig(source);
          expect(config).not.toBeNull();
          expect(config?.cronExpression).toBeDefined();
        }
      });
    });

    /**
     * Requirement 20.2: WHEN new bills are filed in Congress,
     * THE Data_Pipeline SHALL detect and import them within 24 hours
     */
    describe("Requirement 20.2 - Bill Detection Within 24 Hours", () => {
      it("should have daily schedules for Senate and House", () => {
        const senateConfig = getScheduleConfig("senate");
        const houseConfig = getScheduleConfig("house");

        // Both should have stale threshold of 1 day (24 hours)
        expect(senateConfig?.staleDaysThreshold).toBe(1);
        expect(houseConfig?.staleDaysThreshold).toBe(1);
      });
    });

    /**
     * Requirement 20.3: WHEN election results are published by COMELEC,
     * THE Data_Pipeline SHALL import and process them automatically
     */
    describe("Requirement 20.3 - Election Results Import", () => {
      it("should have COMELEC scraper configured", () => {
        const comelecConfig = getScheduleConfig("comelec");
        expect(comelecConfig).not.toBeNull();
        expect(comelecConfig?.enabled).toBe(true);
      });
    });

    /**
     * Requirement 20.7: WHEN source data changes,
     * THE Data_Pipeline SHALL detect the change and update the database accordingly
     */
    describe("Requirement 20.7 - Change Detection", () => {
      it("should track records added and updated separately", async () => {
        const job = await triggerScrape("senate");
        expect(job).toHaveProperty("recordsAdded");
        expect(job).toHaveProperty("recordsUpdated");
        expect(typeof job.recordsAdded).toBe("number");
        expect(typeof job.recordsUpdated).toBe("number");
      });
    });

    /**
     * Requirement 20.8: THE System SHALL maintain a data freshness dashboard
     * showing last update timestamps for each data category
     */
    describe("Requirement 20.8 - Data Freshness Dashboard", () => {
      it("should provide freshness status for each source", async () => {
        const report = await getDataFreshness();

        expect(report.sources.length).toBe(DATA_SOURCES.length);
        for (const status of report.sources) {
          expect(status).toHaveProperty("source");
          expect(status).toHaveProperty("lastSuccessfulScrape");
          expect(status).toHaveProperty("lastAttemptedScrape");
          expect(status).toHaveProperty("isStale");
          expect(status).toHaveProperty("nextScheduledScrape");
        }
      });

      it("should include overall health status", async () => {
        const report = await getDataFreshness();
        expect(["healthy", "degraded", "critical"]).toContain(report.overallHealth);
      });

      it("should include statistics for last 24 hours", async () => {
        const report = await getDataFreshness();
        expect(report).toHaveProperty("totalRecordsLastDay");
        expect(report).toHaveProperty("failedJobsLastDay");
      });
    });

    /**
     * Requirement 20.9: WHEN data import fails or encounters errors,
     * THE System SHALL alert administrators and log the issue
     */
    describe("Requirement 20.9 - Failure Alerts", () => {
      it("should create alerts on scrape failure", async () => {
        // Trigger a scrape that will complete (mock returns empty data)
        await triggerScrape("senate");

        // Manually create a failure alert to test the mechanism
        const alert = await createScrapeAlert("senate", "test_job", "failure", [
          "Connection refused",
        ]);

        expect(alert.alertType).toBe("failure");
        expect(alert.severity).toBe("critical");
        expect(alert.message).toContain("Connection refused");
      });

      it("should track unacknowledged alerts", async () => {
        await createScrapeAlert("senate", "job_1", "failure", ["Error 1"]);
        await createScrapeAlert("house", "job_2", "failure", ["Error 2"]);

        expect(getUnacknowledgedAlertCount()).toBe(2);
      });

      it("should allow acknowledging alerts", async () => {
        const alert = await createScrapeAlert("senate", "job_1", "failure", ["Error"]);
        const acknowledged = acknowledgeAlert(alert.id, "admin_user");

        expect(acknowledged?.acknowledged).toBe(true);
        expect(acknowledged?.acknowledgedBy).toBe("admin_user");
        expect(getUnacknowledgedAlertCount()).toBe(0);
      });
    });
  });
});
