import { PublicResearchUnavailableError } from "@/services/public-research.service";
/**
 * Politician Profile Export API Route
 *
 * Exports a politician's profile in HTML format (printable PDF-style).
 * Requirements: 42.1, 42.4, 42.5
 */

import { NextRequest, NextResponse } from "next/server";
import { generateProfileExport } from "@/services/export.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/politicians/[id]/export - Export politician profile
// Requirement 42.1: Allow users to export the profile as PDF
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Politician ID is required" }, { status: 400 });
    }

    const result = await generateProfileExport(id, {
      format: "html",
      includeSourceAttribution: true,
      optimizeForPrint: true,
    });

    return new NextResponse(result.content, {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "X-Export-Date": result.exportedAt.toISOString(),
        "X-Data-Source": result.dataSourceAttribution,
      },
    });
  } catch (error) {
    if (error instanceof PublicResearchUnavailableError) {
      return NextResponse.json(
        { error: "Reviewed research is temporarily unavailable" },
        { status: 503 }
      );
    }
    console.error("Profile export error:", error);

    if (error instanceof Error && error.message === "Politician not found") {
      return NextResponse.json({ error: "Politician not found" }, { status: 404 });
    }

    return NextResponse.json({ error: "Failed to export profile" }, { status: 500 });
  }
}
