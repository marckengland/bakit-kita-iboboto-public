import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import * as research from "@/services/ai-research.service";
import { GET } from "./route";

describe("AI research cron proposal reports", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "synthetic-cron-secret");
    vi.stubEnv("AI_RESEARCH_ENABLED", undefined);
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function request() {
    return new NextRequest("http://localhost/api/cron/ai-research?max=7", {
      headers: { authorization: "Bearer synthetic-cron-secret" },
    });
  }

  it("returns staged findings separately from public updates", async () => {
    vi.stubEnv("AI_RESEARCH_ENABLED", "true");
    const runner = vi.spyOn(research, "researchMissingData").mockResolvedValueOnce({
      startedAt: new Date("2026-11-15T00:00:00Z"),
      completedAt: new Date("2026-11-15T00:00:01Z"),
      politiciansResearched: 7,
      fieldsUpdated: 0,
      findingsStaged: 3,
      fieldsSkippedLowConfidence: 2,
      errors: [],
    });

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      report: {
        type: "missing_data",
        fieldsUpdated: 0,
        findingsStaged: 3,
        politiciansResearched: 7,
        fieldsSkippedLowConfidence: 2,
        durationMs: 1000,
      },
    });
    expect(runner).toHaveBeenCalledWith(7);
  });

  it("performs no provider or database work without the separate AI opt-in", async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      report: { fieldsUpdated: 0, findingsStaged: 0, politiciansResearched: 0 },
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(prisma.politician.findMany).not.toHaveBeenCalled();
    expect(prisma.politician.update).not.toHaveBeenCalled();
  });
});
