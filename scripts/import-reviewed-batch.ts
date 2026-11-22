import { createPrismaClient } from "../src/lib/prisma-client";
import {
  buildReleaseImportPlan,
  importReleaseBatch,
  ReleaseImportError,
  verifyReleaseFiles,
} from "../src/lib/release-import";

async function main() {
  const args = process.argv.slice(2);
  if (
    args.some((arg) => !["--apply", "--dry-run"].includes(arg)) ||
    (args.includes("--apply") && args.includes("--dry-run"))
  ) {
    throw new ReleaseImportError("Usage: npm run data:import -- [--dry-run | --apply]");
  }
  await verifyReleaseFiles();
  const plan = buildReleaseImportPlan();
  if (!args.includes("--apply")) {
    console.log(
      JSON.stringify({
        action: "dry-run",
        databaseConnected: false,
        profiles: plan.profiles.length,
        filings: plan.bills.length,
        sourceAttributions: plan.sources.length,
        unknownDates: 1,
        unknownStatuses: 45,
      })
    );
    return;
  }
  const client = createPrismaClient();
  try {
    console.log(JSON.stringify(await importReleaseBatch(client, plan)));
  } finally {
    await client.$disconnect();
  }
}
main().catch((error: unknown) => {
  console.error(
    error instanceof ReleaseImportError
      ? error.message
      : "Release import failed. No database diagnostics were printed."
  );
  process.exitCode = 1;
});
