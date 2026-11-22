import { NextRequest, NextResponse } from "next/server";
import { getPublicResearchBatch } from "@/services/public-research.service";
import { unavailableResearch, withheldResearch } from "@/lib/case-review";
export const dynamic = "force-dynamic";
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json((await getPublicResearchBatch([id])).get(id) ?? withheldResearch(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(unavailableResearch(), {
      status: 503,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
