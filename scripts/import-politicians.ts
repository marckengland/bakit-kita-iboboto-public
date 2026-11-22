/**
 * Import Politicians Script
 * 
 * Fetches politicians from BetterGov Open Congress API and imports them into the database.
 */

import { createPrismaClient } from "./lib/prisma-client";
import { scrapePoliticians } from "../src/services/scrapers";

const prisma = createPrismaClient();

async function main() {
  console.log("🚀 Starting politicians import...\n");

  // Get current count
  const beforeCount = await prisma.politician.count();
  console.log(`📊 Current politicians in database: ${beforeCount}\n`);

  // Scrape politicians from API
  console.log("📡 Fetching politicians from BetterGov API...\n");
  const scrapedPoliticians = await scrapePoliticians();
  console.log(`\n✅ Scraped ${scrapedPoliticians.length} politicians from API\n`);

  // Get existing politicians to avoid duplicates
  const existingPoliticians = await prisma.politician.findMany({
    select: { fullName: true },
  });
  const existingNames = new Set(
    existingPoliticians.map((p) => p.fullName.toLowerCase().trim())
  );

  console.log(`📋 Existing politicians in DB: ${existingNames.size}`);

  // Filter out existing politicians
  const newPoliticians = scrapedPoliticians.filter(
    (p) => !existingNames.has(p.fullName.toLowerCase().trim())
  );

  console.log(`🆕 New politicians to import: ${newPoliticians.length}\n`);

  if (newPoliticians.length === 0) {
    console.log("✅ No new politicians to import!");
    await prisma.$disconnect();
    return;
  }

  // Import new politicians
  let imported = 0;
  let errors = 0;

  for (const pol of newPoliticians) {
    try {
      await prisma.politician.create({
        data: {
          id: crypto.randomUUID(),
          fullName: pol.fullName,
          firstName: pol.firstName,
          middleName: pol.middleName,
          lastName: pol.lastName,
          suffix: pol.suffix,
          updatedAt: new Date(),
        },
      });
      imported++;
      if (imported % 100 === 0) {
        console.log(`  Imported ${imported} politicians...`);
      }
    } catch (error) {
      errors++;
      if (errors <= 5) {
        console.error(`  Error importing ${pol.fullName}:`, error);
      }
    }
  }

  console.log(`\n✅ Import complete!`);
  console.log(`   - Imported: ${imported}`);
  console.log(`   - Errors: ${errors}`);

  // Get final count
  const afterCount = await prisma.politician.count();
  console.log(`\n📊 Total politicians in database: ${afterCount}`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
