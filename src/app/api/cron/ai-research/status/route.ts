/**
 * AI Research Status Endpoint
 *
 * Returns current data coverage gaps so you can monitor
 * how the auto-enrichment is progressing.
 *
 * GET /api/cron/ai-research/status
 * Auth: Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyCronAuth } from "@/lib/cron-auth";

export async function GET(request: NextRequest) {
  const unauthorized = verifyCronAuth(request);
  if (unauthorized) {
    return unauthorized;
  }

  const total = await prisma.politician.count();
  const active = await prisma.politician.count({ where: { isActive: true } });
  const withCurrentPos = await prisma.politician.count({
    where: { Position: { some: { isCurrent: true } } },
  });

  const coverage = {
    education: await prisma.politician.count({ where: { Education: { some: {} } } }),
    saln: await prisma.politician.count({ where: { SALNRecord: { some: {} } } }),
    controversies: await prisma.politician.count({ where: { Controversy: { some: {} } } }),
    electionResults: await prisma.politician.count({
      where: { ElectionResultRecord: { some: {} } },
    }),
    factChecks: await prisma.politician.count({ where: { FactCheck: { some: {} } } }),
    family: await prisma.politician.count({
      where: { FamilyRelationship_FamilyRelationship_politicianIdToPolitician: { some: {} } },
    }),
    party: await prisma.politician.count({ where: { PartyAffiliation: { some: {} } } }),
    attendance: await prisma.politician.count({ where: { SessionAttendance: { some: {} } } }),
    voting: await prisma.politician.count({ where: { VotingRecord: { some: {} } } }),
    bills: await prisma.politician.count({ where: { BillAuthor: { some: {} } } }),
    redFlags: await prisma.politician.count({ where: { RedFlag: { some: {} } } }),
    birthday: await prisma.politician.count({ where: { birthday: { not: null } } }),
    birthplace: await prisma.politician.count({ where: { birthplace: { not: null } } }),
  };

  const gaps = Object.entries(coverage)
    .map(([field, count]) => ({
      field,
      covered: count,
      missing: total - count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => a.percentage - b.percentage);

  const sources = await prisma.sourceAttribution.count();
  const aiSources = await prisma.sourceAttribution.count({ where: { isAIProcessed: true } });

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    politicians: { total, active, withCurrentPosition: withCurrentPos },
    coverage: gaps,
    sources: { total: sources, aiProcessed: aiSources },
  });
}
