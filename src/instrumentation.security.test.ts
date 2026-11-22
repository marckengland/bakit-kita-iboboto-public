import { afterEach, describe, expect, it, vi } from "vitest";

const startScheduler = vi.hoisted(() => vi.fn());
vi.mock("@/services/data-pipeline.service", () => ({ startScheduler }));
import { register } from "./instrumentation";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("automatic data pipeline startup", () => {
  it.each(["", "false", "1"])(
    "does not register a scheduler without explicit opt-in (%s)",
    async (value) => {
      vi.stubEnv("NEXT_RUNTIME", "nodejs");
      vi.stubEnv("DATA_PIPELINE_ENABLED", value);
      await register();
      expect(startScheduler).not.toHaveBeenCalled();
    }
  );

  it("registers the scheduler when explicitly enabled in nodejs", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("DATA_PIPELINE_ENABLED", "true");
    await register();
    expect(startScheduler).toHaveBeenCalledOnce();
  });
});
