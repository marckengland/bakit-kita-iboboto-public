import { createPrismaClient } from "../regression/prisma-client";
import { reviewedCases, updateReviewedCase } from "../lib/reviewed-controversies";

const prisma = createPrismaClient();

// Synthetic regression fixture only. The standalone database factory always refuses execution.
const corrections = [
  { fullName: "Synthetic Person A", entry: reviewedCases.syntheticTax },
  { fullName: "Synthetic Person B", entry: reviewedCases.syntheticLibel },
  { fullName: "Synthetic Person C", entry: reviewedCases.syntheticPlunder },
  { fullName: "Synthetic Person C", entry: reviewedCases.syntheticBribery },
];

async function main() {
  try {
    for (const { fullName, entry } of corrections) {
      const result = await updateReviewedCase(prisma, fullName, entry);
      console.log(`${fullName} — ${entry.title}: ${result}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
