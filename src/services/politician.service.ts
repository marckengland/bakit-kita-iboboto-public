import { getPublicRedFlagsBatch, legacySourceSelect } from "./public-research.service";
/**
 * Politician Service
 *
 * Core service for managing politician data and profiles.
 * Implements requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 12.6, 12.7
 */

import { Prisma, GovernmentLevel, SourceType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getReleasedProfile, releaseData, type ReleasedProfileContext } from "@/lib/release-data";
import {
  PaginationParams,
  PaginatedResult,
  getPrismaPageOptions,
  createPaginatedResult,
} from "@/lib/pagination";
import { enhancedCache, cacheKeyGenerators, EXTENDED_CACHE_TTL } from "@/lib/cache-service";

// ============================================
// Types and Interfaces
// ============================================

/**
 * Source attribution for each data field
 * Validates: Requirements 12.6, 12.7
 */
export interface DataSourceAttribution {
  sourceType: SourceType;
  sourceName: string;
  sourceUrl?: string | null;
  documentDate?: Date | null;
  retrievedAt: Date;
  confidence: number | null;
  isAIProcessed: boolean;
  originalDocumentId?: string | null;
}

/**
 * Filters for listing politicians
 * Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6
 */
export interface PoliticianFilters {
  /** Name-only lookup when optional full-text search is unavailable. */
  name?: string;
  isActive?: boolean;
  level?: GovernmentLevel;
  region?: string;
  province?: string;
  city?: string;
  party?: string;
  position?: string;
  hasRedFlags?: boolean;
}

/**
 * Summary view of a politician for list display
 * Validates: Requirement 1.1
 */
export interface PoliticianSummary {
  id: string;
  fullName: string;
  legalName?: string | null;
  photo?: string | null;
  currentPosition?: {
    title: string;
    level: GovernmentLevel;
    jurisdiction: string;
  } | null;
  currentParty?: {
    name: string;
    abbreviation?: string | null;
  } | null;
  hasRedFlags: boolean | null;
  reviewedBatch?: ReleasedProfileContext;
}

/**
 * Position with source attribution
 */
export interface PositionWithSources {
  id: string;
  title: string;
  level: GovernmentLevel;
  jurisdiction: string;
  startDate: Date;
  endDate?: Date | null;
  termNumber: number;
  isConsecutive: boolean;
  isCurrent: boolean;
  sources: DataSourceAttribution[];
}

/**
 * Party affiliation with source attribution
 */
export interface PartyAffiliationWithSources {
  id: string;
  party: {
    id: string;
    name: string;
    abbreviation?: string | null;
  };
  startDate: Date;
  endDate?: Date | null;
  isCurrent: boolean;
  sources: DataSourceAttribution[];
}

/**
 * Full politician profile with all related data and source attribution
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 12.6, 12.7
 */
export interface PoliticianProfile {
  id: string;
  fullName: string;
  legalName?: string | null;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  suffix?: string | null;
  birthday?: Date | null;
  birthplace?: string | null;
  photo?: string | null;
  /** Catalog visibility for reviewed batch profiles. */
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Related data with sources
  currentPosition?: PositionWithSources | null;
  positions: PositionWithSources[];
  currentParty?: PartyAffiliationWithSources | null;
  partyAffiliations: PartyAffiliationWithSources[];
  hasRedFlags: boolean | null;
  redFlagCount: number | null;
  reviewedBatch?: ReleasedProfileContext;

  // Source attribution for each field
  sources: Record<string, DataSourceAttribution[]>;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Transforms a source attribution from Prisma to the service interface
 */
function transformSourceAttribution(source: {
  sourceType: SourceType;
  sourceName: string;
  sourceUrl: string | null;
  documentDate: Date | null;
  retrievedAt: Date;
  confidence: Prisma.Decimal | null;
  isAIProcessed: boolean;
  originalDocumentId: string | null;
  fieldName: string;
}): DataSourceAttribution {
  return {
    sourceType: source.sourceType,
    sourceName: source.sourceName,
    sourceUrl: source.sourceUrl,
    documentDate: source.documentDate,
    retrievedAt: source.retrievedAt,
    confidence: source.confidence === null ? null : Number(source.confidence),
    isAIProcessed: source.isAIProcessed,
    originalDocumentId: source.originalDocumentId,
  };
}

/**
 * Groups source attributions by field name
 */
function groupSourcesByField(
  sources: Array<{
    sourceType: SourceType;
    sourceName: string;
    sourceUrl: string | null;
    documentDate: Date | null;
    retrievedAt: Date;
    confidence: Prisma.Decimal | null;
    isAIProcessed: boolean;
    originalDocumentId: string | null;
    fieldName: string;
  }>
): Record<string, DataSourceAttribution[]> {
  const grouped: Record<string, DataSourceAttribution[]> = {};

  for (const source of sources) {
    const fieldName = source.fieldName;
    if (!grouped[fieldName]) {
      grouped[fieldName] = [];
    }
    grouped[fieldName]!.push(transformSourceAttribution(source));
  }

  return grouped;
}

// ============================================
// Service Implementation
// ============================================

/**
 * Get a politician by ID with all related data
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 12.6, 12.7
 * Implements caching per Requirement 44.3
 */
export async function getPolitician(id: string): Promise<PoliticianProfile | null> {
  const cacheKey = cacheKeyGenerators.politician(id);

  // Try to get from cache first
  const profile = await enhancedCache.getOrFetch<PoliticianProfile | null>(
    cacheKey,
    async () => {
      const politician = await prisma.politician.findUnique({
        where: { id },
        include: {
          Position: {
            orderBy: { startDate: "desc" },
            include: {
              SourceAttribution: { select: legacySourceSelect },
            },
          },
          PartyAffiliation: {
            orderBy: { startDate: "desc" },
            include: {
              PoliticalParty: true,
              SourceAttribution: { select: legacySourceSelect },
            },
          },
          SourceAttribution: { select: legacySourceSelect },
        },
      });

      return transformPoliticianData(politician);
    },
    EXTENDED_CACHE_TTL.POLITICIAN_PROFILE
  );
  if (!profile) {
    return null;
  }
  const flags = (await getPublicRedFlagsBatch([id])).get(id) ?? [];
  // Old cache entries can carry generic case sources and raw counts.
  const sources = Object.fromEntries(
    Object.entries(profile.sources).filter(
      ([field]) => !/controvers|case_?event|legal_?case|corruption|redflag/i.test(field)
    )
  );
  const reviewedBatch = getReleasedProfile(id);
  const countKnown = flags.length > 0 || !reviewedBatch;
  return {
    ...profile,
    sources,
    hasRedFlags: countKnown ? flags.length > 0 : null,
    redFlagCount: countKnown ? flags.length : null,
    ...(reviewedBatch && { reviewedBatch }),
  };
}

type PoliticianWithRelations = Prisma.PoliticianGetPayload<{
  include: {
    Position: { include: { SourceAttribution: { select: typeof legacySourceSelect } } };
    PartyAffiliation: {
      include: { PoliticalParty: true; SourceAttribution: { select: typeof legacySourceSelect } };
    };
    SourceAttribution: { select: typeof legacySourceSelect };
  };
}>;

/**
 * Transform raw politician data to PoliticianProfile
 * Extracted for caching support
 */
function transformPoliticianData(
  politician: PoliticianWithRelations | null
): PoliticianProfile | null {
  if (!politician) {
    return null;
  }

  // Transform positions with sources
  const positions: PositionWithSources[] = politician.Position.map((pos) => ({
    id: pos.id,
    title: pos.title,
    level: pos.level,
    jurisdiction: pos.jurisdiction,
    startDate: pos.startDate,
    endDate: pos.endDate,
    termNumber: pos.termNumber,
    isConsecutive: pos.isConsecutive,
    isCurrent: pos.isCurrent,
    sources: pos.SourceAttribution.map(transformSourceAttribution),
  }));

  // Find current position (sorted by startDate desc, first isCurrent=true)
  const currentPosition = positions.find((p) => p.isCurrent) || null;

  // Transform party affiliations with sources
  const partyAffiliations: PartyAffiliationWithSources[] = politician.PartyAffiliation.map(
    (aff) => ({
      id: aff.id,
      party: {
        id: aff.PoliticalParty.id,
        name: aff.PoliticalParty.name,
        abbreviation: aff.PoliticalParty.abbreviation,
      },
      startDate: aff.startDate,
      endDate: aff.endDate,
      isCurrent: aff.isCurrent,
      sources: aff.SourceAttribution.map(transformSourceAttribution),
    })
  );

  // Find current party affiliation
  const currentParty = partyAffiliations.find((p) => p.isCurrent) || null;

  // Group source attributions by field name
  const sources = groupSourcesByField(
    politician.SourceAttribution.filter(
      (s) =>
        !s.controversyId &&
        !/controvers|case_?event|legal_?case|corruption|redflag/i.test(s.fieldName)
    )
  );

  return {
    id: politician.id,
    fullName: politician.fullName,
    legalName: politician.legalName,
    firstName: politician.firstName,
    middleName: politician.middleName,
    lastName: politician.lastName,
    suffix: politician.suffix,
    birthday: politician.birthday,
    birthplace: politician.birthplace,
    photo: politician.photo,
    isActive: politician.isActive,
    createdAt: politician.createdAt,
    updatedAt: politician.updatedAt,
    currentPosition,
    positions,
    currentParty,
    partyAffiliations,
    hasRedFlags: false,
    redFlagCount: 0,
    sources,
  };
}

/**
 * Build Prisma where clause from filters
 * Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6
 */
function buildWhereClause(filters: PoliticianFilters): Prisma.PoliticianWhereInput {
  const where: Prisma.PoliticianWhereInput =
    filters.isActive === undefined ? {} : { isActive: filters.isActive };
  const conditions: Prisma.PoliticianWhereInput[] = [];

  if (filters.name?.trim()) {
    const match = { contains: filters.name.trim(), mode: "insensitive" as const };
    conditions.push({
      OR: [
        { fullName: match },
        { legalName: match },
        { nickname: match },
        { firstName: match },
        { lastName: match },
      ],
    });
  }

  // Filter by government level (Requirement 1.2)
  if (filters.level) {
    conditions.push({
      Position: {
        some: {
          isCurrent: true,
          level: filters.level,
        },
      },
    });
  }

  // Filter by region/location (Requirement 1.3)
  // Region, province, and city are part of jurisdiction
  if (filters.region) {
    conditions.push({
      Position: {
        some: {
          isCurrent: true,
          jurisdiction: {
            contains: filters.region,
            mode: "insensitive",
          },
        },
      },
    });
  }

  if (filters.province) {
    conditions.push({
      Position: {
        some: {
          isCurrent: true,
          jurisdiction: {
            contains: filters.province,
            mode: "insensitive",
          },
        },
      },
    });
  }

  if (filters.city) {
    conditions.push({
      Position: {
        some: {
          isCurrent: true,
          jurisdiction: {
            contains: filters.city,
            mode: "insensitive",
          },
        },
      },
    });
  }

  // Filter by political party (Requirement 1.4)
  if (filters.party) {
    conditions.push({
      PartyAffiliation: {
        some: {
          isCurrent: true,
          PoliticalParty: {
            OR: [
              { name: { contains: filters.party, mode: "insensitive" } },
              { abbreviation: { contains: filters.party, mode: "insensitive" } },
            ],
          },
        },
      },
    });
  }

  // Filter by position type (Requirement 1.5)
  // Use exact match to avoid "President" matching "Senate President" or "Vice President"
  if (filters.position) {
    conditions.push({
      Position: {
        some: {
          isCurrent: true,
          title: {
            equals: filters.position,
            mode: "insensitive",
          },
        },
      },
    });
  }

  // Combine all conditions with AND (Requirement 1.6)
  if (conditions.length > 0) {
    where.AND = conditions;
  }

  return where;
}

/**
 * List politicians with filters and pagination
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */
export async function listPoliticians(
  filters: PoliticianFilters = {},
  pagination: PaginationParams = { page: 1, pageSize: 20 }
): Promise<PaginatedResult<PoliticianSummary>> {
  const where = buildWhereClause(filters);
  const matchesObservedMembership =
    (filters.level || filters.position) &&
    (!filters.level || filters.level === GovernmentLevel.national) &&
    (!filters.position || filters.position.toLowerCase() === "senator") &&
    !filters.region &&
    !filters.province &&
    !filters.city &&
    !filters.party;

  // The reviewed observation can match a directory filter without creating a Position record.
  let observedWhere: Prisma.PoliticianWhereInput | undefined;
  if (matchesObservedMembership) {
    observedWhere = {
      ...buildWhereClause({ name: filters.name, isActive: filters.isActive }),
      id: { in: releaseData.profiles.map(({ id }) => id) },
    };
  }

  if (filters.hasRedFlags !== undefined) {
    const candidates = await prisma.politician.findMany({
      where: observedWhere ? { OR: [where, observedWhere] } : where,
      select: { id: true },
    });
    const flags = await getPublicRedFlagsBatch(candidates.map((p) => p.id));
    const eligible = [...flags].filter(([, items]) => items.length > 0).map(([id]) => id);
    if (filters.hasRedFlags && !eligible.length) {
      return createPaginatedResult([], 0, pagination);
    }
    if (filters.hasRedFlags) {
      where.id = { in: eligible };
      if (observedWhere) {
        observedWhere = { AND: [observedWhere, { id: where.id }] };
      }
    } else {
      // The cohort's case coverage is unknown and cannot satisfy a negative flag filter.
      const unknown = candidates.filter(({ id }) => getReleasedProfile(id)).map(({ id }) => id);
      where.id = { notIn: [...new Set([...eligible, ...unknown])] };
      observedWhere = undefined;
    }
  }

  // Position hierarchy for sorting (lower number = higher rank)
  const positionRank: Record<string, number> = {
    President: 1,
    "Vice President": 2,
    "Senate President": 3,
    "House Speaker": 4,
    Senator: 5,
    Representative: 6,
    Governor: 7,
    "Vice Governor": 8,
    Mayor: 9,
    "Vice Mayor": 10,
    Councilor: 11,
    "Barangay Captain": 12,
  };

  const getPositionRank = (title: string | undefined): number => {
    if (!title) {
      return 999;
    }
    if (positionRank[title]) {
      return positionRank[title];
    }
    for (const [pos, rank] of Object.entries(positionRank)) {
      if (title.includes(pos)) {
        return rank;
      }
    }
    return 998;
  };

  // Fetch all matching politicians to sort properly before pagination
  const query = {
    orderBy: { fullName: "asc" },
    include: {
      Position: {
        where: { isCurrent: true },
        take: 1,
        orderBy: { startDate: "desc" },
      },
      PartyAffiliation: {
        where: { isCurrent: true },
        take: 1,
        include: {
          PoliticalParty: true,
        },
      },
    },
  } satisfies Prisma.PoliticianFindManyArgs;
  const [positionMatches, observedMatches] = await Promise.all([
    prisma.politician.findMany({ where, ...query }),
    observedWhere ? prisma.politician.findMany({ where: observedWhere, ...query }) : [],
  ]);
  const politicians = [
    ...new Map([...positionMatches, ...observedMatches].map((p) => [p.id, p])).values(),
  ];

  const publicFlags = await getPublicRedFlagsBatch(politicians.map((p) => p.id));
  // Transform to summary format
  const allItems: PoliticianSummary[] = politicians.map((politician) => {
    const currentPosition = politician.Position[0];
    const currentAffiliation = politician.PartyAffiliation[0];
    const reviewedBatch = getReleasedProfile(politician.id);
    const hasPublishedFlags = (publicFlags.get(politician.id)?.length ?? 0) > 0;

    return {
      id: politician.id,
      fullName: politician.fullName,
      legalName: politician.legalName,
      photo: politician.photo,
      currentPosition: currentPosition
        ? {
            title: currentPosition.title,
            level: currentPosition.level,
            jurisdiction: currentPosition.jurisdiction,
          }
        : null,
      currentParty: currentAffiliation
        ? {
            name: currentAffiliation.PoliticalParty.name,
            abbreviation: currentAffiliation.PoliticalParty.abbreviation,
          }
        : null,
      hasRedFlags: reviewedBatch && !hasPublishedFlags ? null : hasPublishedFlags,
      ...(reviewedBatch && { reviewedBatch }),
    };
  });

  // Sort by position rank, then alphabetically
  allItems.sort((a, b) => {
    const rankA = getPositionRank(a.currentPosition?.title);
    const rankB = getPositionRank(b.currentPosition?.title);
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    return a.fullName.localeCompare(b.fullName);
  });

  // Apply pagination after sorting
  const totalCount = allItems.length;
  const { skip, take } = getPrismaPageOptions(pagination);
  const items = allItems.slice(skip, skip + take);

  return createPaginatedResult(items, totalCount, pagination);
}

/**
 * Check if a politician exists by ID
 */
export async function politicianExists(id: string): Promise<boolean> {
  const count = await prisma.politician.count({
    where: { id },
  });
  return count > 0;
}

/**
 * Get source attributions for a specific politician field
 * Validates: Requirements 12.6, 12.7
 */
export async function getFieldSources(
  politicianId: string,
  fieldName: string
): Promise<DataSourceAttribution[]> {
  const sources = await prisma.sourceAttribution.findMany({
    where: {
      politicianId,
      fieldName,
    },
    orderBy: { retrievedAt: "desc" },
  });

  return sources.map(transformSourceAttribution);
}
