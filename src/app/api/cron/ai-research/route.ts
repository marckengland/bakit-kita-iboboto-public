/**
 * AI Research Cron Endpoint
 *
 * Stages AI research findings and citations for human review.
 * Uses Gemini with web search grounding to find and cross-reference data
 * from credible Philippine sources (Rappler, Inquirer, PhilStar, GMA, etc.).
 *
 * Requires AI_RESEARCH_ENABLED=true. Findings need at least 90% model confidence
 * and two distinct credible article citations; they never update public profiles.
 *
 * Secured by CRON_SECRET, supplied via the Authorization header:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Usage:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://<host>/api/cron/ai-research?max=20&type=controversies"
 *
 * Supported types:
 *   missing_data (default), controversies, fact_checks, election_history,
 *   net_worth, red_flags, party_affiliations, all
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";

export const maxDuration = 300; // 5 minutes max for serverless

export async function GET(request: NextRequest) {
  const unauthorized = verifyCronAuth(request);
  if (unauthorized) {
    return unauthorized;
  }

  const { searchParams } = new URL(request.url);
  const maxPoliticians = parseInt(searchParams.get("max") || "10", 10);
  const researchType = searchParams.get("type") || "missing_data";

  try {
    const {
      researchMissingData,
      researchControversies,
      researchFactChecks,
      researchElectionHistory,
      researchNetWorth,
      researchRedFlags,
      researchPartyAffiliations,
      researchEducation,
      researchAll,
    } = await import("@/services/ai-research.service");

    const runners: Record<string, () => Promise<unknown>> = {
      missing_data: () => researchMissingData(maxPoliticians),
      education: () => researchEducation(maxPoliticians),
      controversies: () => researchControversies(maxPoliticians),
      fact_checks: () => researchFactChecks(maxPoliticians),
      election_history: () => researchElectionHistory(maxPoliticians),
      net_worth: () => researchNetWorth(maxPoliticians),
      red_flags: () => researchRedFlags(maxPoliticians),
      party_affiliations: () => researchPartyAffiliations(maxPoliticians),
      all: () => researchAll(maxPoliticians),
    };

    const runner = runners[researchType];
    if (!runner) {
      return NextResponse.json(
        {
          error: `Invalid type: ${researchType}. Valid: ${Object.keys(runners).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const report = (await runner()) as {
      startedAt: Date;
      completedAt: Date;
      politiciansResearched: number;
      fieldsUpdated: number;
      findingsStaged: number;
      fieldsSkippedLowConfidence: number;
      errors: string[];
    };

    return NextResponse.json({
      success: true,
      report: {
        type: researchType,
        startedAt: report.startedAt.toISOString(),
        completedAt: report.completedAt.toISOString(),
        durationMs: report.completedAt.getTime() - report.startedAt.getTime(),
        politiciansResearched: report.politiciansResearched,
        fieldsUpdated: report.fieldsUpdated,
        findingsStaged: report.findingsStaged,
        fieldsSkippedLowConfidence: report.fieldsSkippedLowConfidence,
        errors: report.errors,
      },
    });
  } catch (error) {
    console.error("[ai-research-cron] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
