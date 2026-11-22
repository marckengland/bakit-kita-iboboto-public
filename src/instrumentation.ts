/**
 * Next.js Instrumentation Hook
 *
 * Runs once when the server starts. Used to initialize the data pipeline scheduler.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import { logger } from "./lib/logger";

export async function register() {
  // Only run on the server (not during build or in edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.DATA_PIPELINE_ENABLED === "true") {
    const { startScheduler } = await import("@/services/data-pipeline.service");
    startScheduler();
    logger.info("[instrumentation] Data pipeline scheduler initialized");
  }
}
