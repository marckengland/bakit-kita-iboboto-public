import {
  reviewedCases,
  reviewedSourceInputs,
  type ReviewedSource,
} from "../lib/reviewed-controversies";
import { createPrismaClient } from "../regression/prisma-client";
const prisma = createPrismaClient();

// Compatibility path for the unchanged reviewed-repair regression suite.

interface Entry {
  title: string;
  description: string;
  category: "legal_case" | "corruption" | "ethics_violation" | "other";
  status: "ongoing" | "dismissed" | "convicted" | "acquitted" | "settled";
  filingDate?: string | null;
  previousTitles?: string[];
  sources?: ReviewedSource[];
  court?: string;
  caseNumber?: string;
}

// Invented case inputs used only by the isolated regression suite.
// Unrelated rows are synthetic and exist only to retain the original bulk-input assertions.
const unrelated = (title: string): Entry => ({
  title,
  description: "Synthetic unrelated regression input; not a factual claim.",
  category: "other",
  status: "settled",
  filingDate: null,
});
const controversies: Record<string, Entry[]> = {
  "Synthetic Person A": [
    { ...reviewedCases.syntheticTax },
    unrelated("Fixture A"),
    unrelated("Fixture B"),
    unrelated("Fixture C"),
  ],
  "Synthetic Person C": [
    { ...reviewedCases.syntheticPlunder },
    { ...reviewedCases.syntheticBribery },
  ],
};

async function main() {
  let totalAdded = 0;
  let totalSkipped = 0;

  for (const [name, entries] of Object.entries(controversies)) {
    const politician = await prisma.politician.findFirst({
      where: { fullName: name },
    });

    if (!politician) {
      console.log(`❌ Politician not found: ${name}`);
      continue;
    }

    console.log(`\n${name} (${entries.length} controversies):`);

    for (const entry of entries) {
      // Check for duplicates
      const existing = await prisma.controversy.findFirst({
        where: {
          politicianId: politician.id,
          title: entry.previousTitles
            ? { in: [entry.title, ...entry.previousTitles] }
            : { contains: entry.title.substring(0, 40), mode: "insensitive" },
        },
      });

      if (existing) {
        console.log(`  ⏭️  Already exists: ${entry.title}`);
        totalSkipped++;
        continue;
      }

      await prisma.controversy.create({
        data: {
          id: crypto.randomUUID(),
          politicianId: politician.id,
          title: entry.title,
          description: entry.description,
          category: entry.category,
          status: entry.status,
          filingDate: entry.filingDate ? new Date(entry.filingDate) : null,
          court: entry.court || null,
          caseNumber: entry.caseNumber || null,
          SourceAttribution: entry.sources
            ? { create: reviewedSourceInputs(entry.sources) }
            : undefined,
          updatedAt: new Date(),
        },
      });

      console.log(`  ✅ Added: ${entry.title}`);
      totalAdded++;
    }
  }

  // Final stats
  const totalControversies = await prisma.controversy.count();
  const politiciansWithControversies = await prisma.politician.count({
    where: { Controversy: { some: {} } },
  });

  console.log(`\n=== Summary ===`);
  console.log(`Added: ${totalAdded}`);
  console.log(`Skipped (duplicates): ${totalSkipped}`);
  console.log(`Total controversies in DB: ${totalControversies}`);
  console.log(`Politicians with controversies: ${politiciansWithControversies}`);

  await prisma.$disconnect();
}

main().catch(console.error);
