/**
 * Admin AI Research API
 *
 * Allows admins to trigger AI research manually and view results.
 *
 * POST /api/admin/ai-research - Trigger AI research
 * GET /api/admin/ai-research - Get research status/history
 */

import { NextRequest, NextResponse } from "next/server";

type ResearchType =
  | "missing_data"
  | "controversies"
  | "fact_checks"
  | "election_history"
  | "net_worth"
  | "red_flags"
  | "party_affiliations"
  | "all";

/**
 * POST - Trigger AI research
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      type = "missing_data",
      maxPoliticians = 10,
      politicianId,
    }: { type?: ResearchType; maxPoliticians?: number; politicianId?: string } = body;

    const {
      researchMissingData,
      researchControversies,
      researchFactChecks,
      researchElectionHistory,
      researchNetWorth,
      researchRedFlags,
      researchPartyAffiliations,
      researchAll,
      researchPolitician,
    } = await import("@/services/ai-research.service");

    // Single politician research
    if (politicianId) {
      const prisma = (await import("@/lib/prisma")).default;
      const pol = await prisma.politician.findUnique({
        where: { id: politicianId },
        select: { fullName: true, birthday: true, birthplace: true },
      });

      if (!pol) {
        return NextResponse.json({ error: "Politician not found" }, { status: 404 });
      }

      // For single politician, research all requested fields
      const fieldMap: Record<
        string,
        Array<
          | "birthday"
          | "birthplace"
          | "controversies"
          | "fact_checks"
          | "election_history"
          | "net_worth"
          | "red_flags"
          | "party"
        >
      > = {
        missing_data: [
          ...(!pol.birthday ? ["birthday" as const] : []),
          ...(!pol.birthplace ? ["birthplace" as const] : []),
        ],
        controversies: ["controversies"],
        fact_checks: ["fact_checks"],
        election_history: ["election_history"],
        net_worth: ["net_worth"],
        red_flags: ["red_flags"],
        party_affiliations: ["party"],
        all: [
          ...(!pol.birthday ? ["birthday" as const] : []),
          ...(!pol.birthplace ? ["birthplace" as const] : []),
          "controversies",
          "fact_checks",
          "election_history",
          "net_worth",
          "red_flags",
          "party",
        ],
      };

      const fields = fieldMap[type] ?? fieldMap.missing_data ?? [];

      if (fields.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No missing fields to research",
        });
      }

      const result = await researchPolitician(politicianId, pol.fullName, fields);

      return NextResponse.json({
        success: true,
        result: {
          politicianName: result.politicianName,
          findings: result.findings,
          totalSourcesChecked: result.totalSourcesChecked,
        },
      });
    }

    // Batch research by type
    const runners: Record<ResearchType, () => Promise<unknown>> = {
      missing_data: () => researchMissingData(maxPoliticians),
      controversies: () => researchControversies(maxPoliticians),
      fact_checks: () => researchFactChecks(maxPoliticians),
      election_history: () => researchElectionHistory(maxPoliticians),
      net_worth: () => researchNetWorth(maxPoliticians),
      red_flags: () => researchRedFlags(maxPoliticians),
      party_affiliations: () => researchPartyAffiliations(maxPoliticians),
      all: () => researchAll(maxPoliticians),
    };

    const runner = runners[type];
    if (!runner) {
      return NextResponse.json(
        { error: `Invalid research type: ${type}. Valid: ${Object.keys(runners).join(", ")}` },
        { status: 400 }
      );
    }

    const report = (await runner()) as {
      startedAt: Date;
      completedAt: Date;
      politiciansResearched: number;
      fieldsUpdated: number;
      fieldsSkippedLowConfidence: number;
      errors: string[];
    };

    return NextResponse.json({
      success: true,
      report: {
        type,
        startedAt: report.startedAt.toISOString(),
        completedAt: report.completedAt.toISOString(),
        durationMs: report.completedAt.getTime() - report.startedAt.getTime(),
        politiciansResearched: report.politiciansResearched,
        fieldsUpdated: report.fieldsUpdated,
        fieldsSkippedLowConfidence: report.fieldsSkippedLowConfidence,
        errors: report.errors,
      },
    });
  } catch (error) {
    console.error("[admin-ai-research] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Get AI research stats
 */
export async function GET() {
  try {
    const prisma = (await import("@/lib/prisma")).default;

    // Get stats on AI-processed source attributions
    const aiAttributions = await prisma.sourceAttribution.count({
      where: { isAIProcessed: true },
    });

    // Get breakdown by field
    const byField = await prisma.sourceAttribution.groupBy({
      by: ["fieldName"],
      where: { isAIProcessed: true },
      _count: true,
    });

    // Get politicians with/without key data
    const totalPoliticians = await prisma.politician.count();
    const withBirthday = await prisma.politician.count({
      where: { birthday: { not: null } },
    });
    const withBirthplace = await prisma.politician.count({
      where: { birthplace: { not: null } },
    });
    const withControversies = await prisma.politician.count({
      where: { Controversy: { some: {} } },
    });
    const withFactChecks = await prisma.politician.count({
      where: { FactCheck: { some: {} } },
    });
    const withElectionHistory = await prisma.politician.count({
      where: { ElectionResultRecord: { some: {} } },
    });
    const withSALN = await prisma.politician.count({
      where: { SALNRecord: { some: {} } },
    });
    const withRedFlags = await prisma.politician.count({
      where: { RedFlag: { some: {} } },
    });
    const withParty = await prisma.politician.count({
      where: { PartyAffiliation: { some: { isCurrent: true } } },
    });

    const pct = (n: number) => ((n / totalPoliticians) * 100).toFixed(1);

    return NextResponse.json({
      success: true,
      stats: {
        aiAttributions,
        byField: byField.map((f) => ({
          field: f.fieldName,
          count: f._count,
        })),
        coverage: {
          total: totalPoliticians,
          withBirthday,
          withBirthplace,
          withControversies,
          withFactChecks,
          withElectionHistory,
          withSALN,
          withRedFlags,
          withParty,
          birthdayPercent: pct(withBirthday),
          birthplacePercent: pct(withBirthplace),
          controversiesPercent: pct(withControversies),
          factChecksPercent: pct(withFactChecks),
          electionHistoryPercent: pct(withElectionHistory),
          salnPercent: pct(withSALN),
          redFlagsPercent: pct(withRedFlags),
          partyPercent: pct(withParty),
        },
      },
    });
  } catch (error) {
    console.error("[admin-ai-research] Error:", error);
    return NextResponse.json({ success: false, error: "Failed to get stats" }, { status: 500 });
  }
}
