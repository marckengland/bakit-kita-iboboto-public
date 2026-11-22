import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getReleasedProfile } from "@/lib/release-data";

/** Minimal public card data for saved profiles. Deliberately excludes research. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const { id } = await params;
    const profile = await prisma.politician.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        photo: true,
        Position: {
          where: { isCurrent: true },
          orderBy: { startDate: "desc" },
          take: 1,
          select: { title: true, level: true, jurisdiction: true },
        },
      },
    });
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404, headers });
    }
    const reviewedBatch = getReleasedProfile(profile.id);
    return NextResponse.json(
      {
        politician: {
          id: profile.id,
          fullName: profile.fullName,
          photo: profile.photo,
          currentPosition: profile.Position[0] ?? null,
          ...(reviewedBatch && { reviewedBatch }),
        },
      },
      { headers }
    );
  } catch (error) {
    console.error("Saved profile lookup failed:", error);
    return NextResponse.json(
      { error: "Profile temporarily unavailable" },
      { status: 503, headers }
    );
  }
}
