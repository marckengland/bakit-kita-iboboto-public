/**
 * Simple Politician Search API
 *
 * Prisma-based search for politician name matching.
 * Used by comparison tool and other components that need
 * quick politician lookup without Elasticsearch.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getReleasedProfile } from "@/lib/release-data";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q") || "";
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "10", 10), 20);
    const exclude = request.nextUrl.searchParams.get("exclude")?.split(",").filter(Boolean) || [];

    if (!q || q.length < 1) {
      return NextResponse.json({ results: [] });
    }

    const results = await prisma.politician.findMany({
      where: {
        isActive: true,
        id: exclude.length > 0 ? { notIn: exclude } : undefined,
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { nickname: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { firstName: { contains: q, mode: "insensitive" } },
        ],
      },
      take: limit,
      select: {
        id: true,
        fullName: true,
        photo: true,
        Position: {
          where: { isCurrent: true },
          take: 1,
          select: { title: true, level: true, jurisdiction: true },
        },
        PartyAffiliation: {
          where: { isCurrent: true },
          take: 1,
          include: { PoliticalParty: { select: { name: true, abbreviation: true } } },
        },
      },
      orderBy: { fullName: "asc" },
    });

    const mapped = results.map((p) => {
      const reviewedBatch = getReleasedProfile(p.id);
      return {
        id: p.id,
        fullName: p.fullName,
        photo: p.photo,
        currentPosition: p.Position[0] || undefined,
        currentParty: p.PartyAffiliation[0]
          ? {
              name: p.PartyAffiliation[0].PoliticalParty.name,
              abbreviation: p.PartyAffiliation[0].PoliticalParty.abbreviation,
            }
          : undefined,
        ...(reviewedBatch && { reviewedBatch }),
      };
    });

    return NextResponse.json({ results: mapped });
  } catch (error) {
    console.error("Politician search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
