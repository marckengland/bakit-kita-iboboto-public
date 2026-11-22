import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

type ClientOptions = Omit<Prisma.PrismaClientOptions, "adapter" | "accelerateUrl">;

function positiveInteger(url: URL, name: string, fallback: number): number {
  const value = url.searchParams.get(name);
  if (value === null) {
    return fallback;
  }
  const parsed = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`DATABASE_URL ${name} must be a positive integer`);
  }
  url.searchParams.delete(name);
  return parsed;
}

/** Create a separate client and pool; the caller owns its disconnect lifecycle. */
export function createPrismaClient(options: ClientOptions = {}): PrismaClient {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  let url: URL;
  try {
    url = new URL(connectionString);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) {
      throw new Error();
    }
  } catch {
    // URL parsing errors can include their input, so never forward that error.
    throw new Error("DATABASE_URL must be a PostgreSQL URL");
  }

  if (url.searchParams.has("pool_timeout")) {
    throw new Error(
      "DATABASE_URL pool_timeout is not supported by the PostgreSQL driver; " +
        "remove it and use connect_timeout for the shared connection/acquisition timeout"
    );
  }
  const schema = url.searchParams.get("schema") ?? "public";
  if (!schema.trim()) {
    throw new Error("DATABASE_URL schema must not be empty");
  }
  // Prisma 7.10.1 does not escape embedded quotes in ORM schema identifiers.
  // Reject before connecting rather than leave raw SQL and ORM using different rules.
  if (schema.includes('"')) {
    throw new Error("Prisma 7.10.1 does not support schema names containing double quotes");
  }
  url.searchParams.delete("schema");
  const max = positiveInteger(url, "connection_limit", 10);
  const connectionTimeoutMillis = positiveInteger(url, "connect_timeout", 5) * 1000;
  if (connectionTimeoutMillis > 2_147_483_647) {
    throw new Error("DATABASE_URL connect_timeout exceeds the supported timer range");
  }

  // The adapter schema qualifies ORM queries; PostgreSQL's search_path also
  // needs it for unqualified raw SQL. Quote identifiers and escape startup
  // option whitespace/backslashes so the schema stays a single option value.
  const searchPath = `"${schema.replace(/"/g, '""')}"`.replace(/[\\\s]/g, "\\$&");
  const existingOptions = url.searchParams.get("options");
  url.searchParams.delete("options");
  const startupOptions = [existingOptions, `-c search_path=${searchPath}`]
    .filter(Boolean)
    .join(" ");

  const adapter = new PrismaPg(
    {
      connectionString: url.toString(),
      max,
      connectionTimeoutMillis,
      idleTimeoutMillis: 300_000,
      options: startupOptions,
    },
    { schema }
  );
  return new PrismaClient({ ...options, adapter });
}
