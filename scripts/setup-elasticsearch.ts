/**
 * Setup Elasticsearch indices and index all politicians
 *
 * Run with: npx tsx scripts/setup-elasticsearch.ts
 */

import elasticsearch, { initializeIndices, checkHealth, INDICES } from "../src/lib/elasticsearch";
import { searchService, PoliticianSearchDocument } from "../src/lib/search";
import prisma from "../src/lib/prisma";

async function main() {
  console.log("🔍 Setting up Elasticsearch...\n");

  // Check connection
  console.log("Checking Elasticsearch connection...");
  const healthy = await checkHealth();
  if (!healthy) {
    console.error("❌ Elasticsearch is not healthy or not running!");
    console.log("\nMake sure Elasticsearch is running:");
    console.log("  docker compose up -d --wait elasticsearch");
    process.exit(1);
  }
  console.log("✅ Elasticsearch is healthy\n");

  // Delete existing politicians index to remove stale data
  console.log("Deleting existing politicians index (to remove stale data)...");
  try {
    const exists = await elasticsearch.indices.exists({ index: INDICES.POLITICIANS });
    if (exists) {
      await elasticsearch.indices.delete({ index: INDICES.POLITICIANS });
      console.log("✅ Old index deleted\n");
    } else {
      console.log("Index doesn't exist yet, skipping delete\n");
    }
  } catch (err) {
    console.log("Could not delete index:", err);
  }

  // Initialize indices (creates fresh)
  console.log("Creating indices...");
  await initializeIndices();
  console.log("✅ Indices created\n");

  // Fetch all politicians from database
  console.log("Fetching politicians from database...");
  const politicians = await prisma.politician.findMany({
    include: {
      Position: {
        where: { isCurrent: true },
        take: 1,
        orderBy: { startDate: "desc" },
      },
      PartyAffiliation: {
        where: { isCurrent: true },
        take: 1,
        include: { PoliticalParty: true },
      },
      RedFlag: { select: { id: true } },
    },
  });

  console.log(`Found ${politicians.length} politicians\n`);

  if (politicians.length === 0) {
    console.log("No politicians to index. Run the scraper first:");
    console.log("  npm run scrape:politicians");
    process.exit(0);
  }

  // Transform to search documents
  const documents: PoliticianSearchDocument[] = politicians.map((p) => {
    const position = p.Position[0];
    const party = p.PartyAffiliation[0]?.PoliticalParty;

    return {
      id: p.id,
      fullName: p.fullName,
      legalName: p.legalName || undefined,
      firstName: p.firstName,
      middleName: p.middleName || undefined,
      lastName: p.lastName,
      suffix: p.suffix || undefined,
      nickname: (p as any).nickname || undefined,
      currentPosition: position
        ? {
            title: position.title,
            level: position.level,
            jurisdiction: position.jurisdiction,
          }
        : undefined,
      currentParty: party
        ? {
            name: party.name,
            abbreviation: party.abbreviation || "",
          }
        : undefined,
      isActive: p.isActive,
      hasRedFlags: p.RedFlag.length > 0,
      photo: p.photo || undefined,
      popularityScore: 0,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  });

  // Bulk index
  console.log("Indexing politicians...");
  await searchService.bulkIndexPoliticians(documents);
  console.log(`✅ Indexed ${documents.length} politicians\n`);

  console.log("🎉 Elasticsearch setup complete!");

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Setup failed:", error);
  process.exit(1);
});
