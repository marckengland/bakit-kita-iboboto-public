import { PublicResearchUnavailableError } from "@/services/public-research.service";
/**
 * Search API Endpoint
 *
 * Provides full-text search for politicians with filters.
 * Requirements: 11.1, 11.2, 11.3, 11.4
 */

import { NextRequest, NextResponse } from "next/server";
import { searchByName, searchService, PoliticianSearchFilters } from "@/lib/search";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "20", 10), 50);

    // Build filters from query params - Requirement 11.3
    const filters: PoliticianSearchFilters = {};

    const level = searchParams.get("level");
    if (level && isValidLevel(level)) {
      filters.level = level as PoliticianSearchFilters["level"];
    }

    const region = searchParams.get("region");
    if (region) {
      filters.region = region;
    }

    const province = searchParams.get("province");
    if (province) {
      filters.province = province;
    }

    const city = searchParams.get("city");
    if (city) {
      filters.city = city;
    }

    const party = searchParams.get("party");
    if (party) {
      filters.party = party;
    }

    const position = searchParams.get("position");
    if (position) {
      filters.position = position;
    }

    const hasRedFlags = searchParams.get("hasRedFlags");
    if (hasRedFlags === "true") {
      filters.hasRedFlags = true;
    } else if (hasRedFlags === "false") {
      filters.hasRedFlags = false;
    }

    const isActive = searchParams.get("isActive");
    if (isActive === "true") {
      filters.isActive = true;
    } else if (isActive === "false") {
      filters.isActive = false;
    }

    // Perform search - Requirements 11.1, 11.2
    const lookup = await searchService
      .search(query, filters, page, pageSize)
      .catch(async (error) => {
        if (error instanceof PublicResearchUnavailableError) {
          throw error;
        }
        return searchByName(query, filters, page, pageSize);
      });
    const { results, total } = lookup;

    // Generate alternative suggestions for no results - Requirement 11.4
    let suggestions: string[] = [];
    if (results.length === 0 && query) {
      suggestions = generateAlternativeSuggestions(query);
    }

    return NextResponse.json({
      results,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      query,
      filters,
      suggestions,
      ...(lookup.searchMode && { searchMode: lookup.searchMode }),
    });
  } catch (error) {
    if (error instanceof PublicResearchUnavailableError) {
      return NextResponse.json(
        { error: "Reviewed research is temporarily unavailable" },
        { status: 503 }
      );
    }
    console.error("Search API error:", error);
    return NextResponse.json({ error: "Failed to perform search" }, { status: 500 });
  }
}

function isValidLevel(level: string): boolean {
  const validLevels = ["national", "regional", "provincial", "city", "municipal", "barangay"];
  return validLevels.includes(level);
}

/**
 * Generate alternative search suggestions when no results are found
 * Requirement 11.4
 */
function generateAlternativeSuggestions(query: string): string[] {
  const suggestions: string[] = [];
  const lowerQuery = query.toLowerCase();

  // Common misspellings and alternatives for Philippine political terms
  const alternatives: Record<string, string[]> = {
    // Common name misspellings
    marcos: ["Marcos", "Ferdinand Marcos", "Bongbong Marcos"],
    duterte: ["Duterte", "Rodrigo Duterte", "Sara Duterte"],
    aquino: ["Aquino", "Benigno Aquino", "Cory Aquino"],
    estrada: ["Estrada", "Joseph Estrada", "Jinggoy Estrada"],
    revilla: ["Revilla", "Bong Revilla"],
    pacquiao: ["Pacquiao", "Manny Pacquiao"],

    // Position alternatives
    senator: ["Senator", "Senador"],
    congressman: ["Congressman", "Representative", "Kongresista"],
    mayor: ["Mayor", "Alkalde"],
    governor: ["Governor", "Gobernador"],
    president: ["President", "Pangulo"],

    // Location alternatives
    manila: ["Manila", "City of Manila", "NCR"],
    cebu: ["Cebu", "Cebu City", "Cebu Province"],
    davao: ["Davao", "Davao City", "Davao del Sur"],
    quezon: ["Quezon City", "Quezon Province"],
  };

  // Check for partial matches in alternatives
  for (const [key, values] of Object.entries(alternatives)) {
    if (lowerQuery.includes(key) || key.includes(lowerQuery)) {
      suggestions.push(...values.filter((v) => v.toLowerCase() !== lowerQuery));
    }
  }

  // Add common search terms if query is very short
  if (query.length <= 3) {
    suggestions.push("Senator", "Mayor", "Governor", "Congressman");
  }

  // Return unique suggestions, limited to 5
  return Array.from(new Set(suggestions)).slice(0, 5);
}
