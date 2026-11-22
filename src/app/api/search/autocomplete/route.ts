/**
 * Autocomplete API Endpoint
 *
 * Provides autocomplete suggestions for politician search.
 * Uses PostgreSQL for reviewed cohort names and when Elasticsearch is unavailable.
 * Requirements: 11.5
 */

import { NextRequest, NextResponse } from "next/server";
import { hasImportedReleasedProfile, searchService } from "@/lib/search";
import { getReleasedProfile } from "@/lib/release-data";
import { prisma } from "@/lib/prisma";

async function prismaFallback(query: string, limit: number) {
  const politicians = await prisma.politician.findMany({
    where: {
      isActive: true,
      OR: [
        { fullName: { contains: query, mode: "insensitive" } },
        { nickname: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { firstName: { contains: query, mode: "insensitive" } },
      ],
    },
    take: limit,
    select: {
      id: true,
      fullName: true,
      Position: {
        where: { isCurrent: true },
        take: 1,
        select: { title: true, jurisdiction: true },
      },
      PartyAffiliation: {
        where: { isCurrent: true },
        take: 1,
        include: { PoliticalParty: { select: { name: true } } },
      },
    },
    orderBy: { fullName: "asc" },
  });

  return politicians.map((p) => {
    const reviewedBatch = getReleasedProfile(p.id, p.fullName);
    const position = p.Position[0];
    const party = p.PartyAffiliation[0]?.PoliticalParty;
    return {
      id: p.id,
      text: p.fullName,
      type: "politician" as const,
      subtext: reviewedBatch
        ? `${reviewedBatch.office} observed ${reviewedBatch.observedOn}`
        : position
          ? `${position.title}, ${position.jurisdiction}${party ? ` (${party.name})` : ""}`
          : party?.name,
      popularityScore: 0,
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 20);

    if (!query || query.length < 1) {
      return NextResponse.json({ suggestions: [] });
    }

    if (query.trim() && (await hasImportedReleasedProfile(query))) {
      const suggestions = await prismaFallback(query.trim(), limit);
      return NextResponse.json({ suggestions, query });
    }

    try {
      const suggestions = await searchService.autocomplete(query, limit);
      return NextResponse.json({ suggestions, query });
    } catch {
      // ES unavailable — fall back to Prisma
      const suggestions = await prismaFallback(query, limit);
      return NextResponse.json({ suggestions, query });
    }
  } catch (error) {
    console.error("Autocomplete API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch autocomplete suggestions" },
      { status: 500 }
    );
  }
}
