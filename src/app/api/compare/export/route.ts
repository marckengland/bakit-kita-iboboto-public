import { PublicResearchUnavailableError } from "@/services/public-research.service";
/**
 * Comparison Export API Route
 *
 * Exports politician comparison results in HTML format (printable PDF-style).
 * Requirements: 42.2, 42.4, 42.5
 */

import { NextRequest, NextResponse } from "next/server";
import { generateComparisonExport } from "@/services/export.service";

// GET /api/compare/export - Export comparison results
// Requirement 42.2: Allow users to export the comparison as PDF
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");

    if (!idsParam) {
      return NextResponse.json({ error: "Politician IDs are required" }, { status: 400 });
    }

    const ids = idsParam.split(",").filter(Boolean);

    if (ids.length < 2) {
      return NextResponse.json(
        { error: "At least 2 politicians are required for comparison" },
        { status: 400 }
      );
    }

    if (ids.length > 4) {
      return NextResponse.json({ error: "Maximum 4 politicians can be compared" }, { status: 400 });
    }

    const result = await generateComparisonExport(ids, {
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
    console.error("Comparison export error:", error);

    return NextResponse.json({ error: "Failed to export comparison" }, { status: 500 });
  }
}
