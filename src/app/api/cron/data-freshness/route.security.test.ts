import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import {
  triggerAllScrapes,
  checkStaleData,
  getDataFreshness,
} from "@/services/data-pipeline.service";

vi.mock("@/services/data-pipeline.service", () => ({
  triggerAllScrapes: vi.fn(),
  checkStaleData: vi.fn(),
  getDataFreshness: vi.fn(),
}));

describe("data freshness cron authorization", () => {
  beforeEach(() => {
    vi.mocked(triggerAllScrapes).mockResolvedValue([]);
    vi.mocked(checkStaleData).mockResolvedValue([]);
    vi.mocked(getDataFreshness).mockResolvedValue({
      generatedAt: new Date("2026-11-15T00:00:00Z"),
      sources: [],
      overallHealth: "healthy",
      totalRecordsLastDay: 0,
      failedJobsLastDay: 0,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function expectNoPipelineWork() {
    expect(triggerAllScrapes).not.toHaveBeenCalled();
    expect(checkStaleData).not.toHaveBeenCalled();
    expect(getDataFreshness).not.toHaveBeenCalled();
  }

  it("returns 503 without starting pipeline work when CRON_SECRET is absent", async () => {
    vi.stubEnv("CRON_SECRET", undefined);

    const response = await GET(new NextRequest("http://localhost/api/cron/data-freshness"));

    expect(response.status).toBe(503);
    expectNoPipelineWork();
  });

  it.each([
    { name: "missing authorization", authorization: undefined, query: "" },
    { name: "wrong bearer", authorization: "Bearer incorrect", query: "" },
    { name: "query-string secret", authorization: undefined, query: "?secret=cron-test-secret" },
  ])("returns 401 without pipeline work for $name", async ({ authorization, query }) => {
    vi.stubEnv("CRON_SECRET", "cron-test-secret");
    const request = new NextRequest(`http://localhost/api/cron/data-freshness${query}`, {
      headers: authorization ? { authorization } : undefined,
    });

    const response = await GET(request);

    expect(response.status).toBe(401);
    expectNoPipelineWork();
  });

  it("runs the normal pipeline for the matching Bearer secret", async () => {
    vi.stubEnv("CRON_SECRET", "cron-test-secret");

    const response = await GET(
      new NextRequest("http://localhost/api/cron/data-freshness", {
        headers: { authorization: "Bearer cron-test-secret" },
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      jobsRun: 0,
      completed: 0,
      failed: 0,
      totalRecordsAdded: 0,
      totalRecordsUpdated: 0,
      staleAlerts: 0,
      overallHealth: "healthy",
    });
    expect(triggerAllScrapes).toHaveBeenCalledTimes(1);
    expect(checkStaleData).toHaveBeenCalledTimes(1);
    expect(getDataFreshness).toHaveBeenCalledTimes(1);
  });
});
