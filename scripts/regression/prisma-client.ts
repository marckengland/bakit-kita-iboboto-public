import type { PrismaClient } from "@prisma/client";

/** Existing regression tests inject a database double at this boundary. */
export function createPrismaClient(): PrismaClient {
  throw new Error(
    "This is a test-only regression fixture. Standalone database execution is unavailable."
  );
}
