import { createPrismaClient } from "../regression/prisma-client";
import { reviewedCases, updateReviewedCase } from "../lib/reviewed-controversies";

const prisma = createPrismaClient();

async function main() {
  try {
    const result = await updateReviewedCase(
      prisma,
      "Synthetic Person A",
      reviewedCases.syntheticTax
    );
    console.log(`Synthetic tax correction: ${result}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
