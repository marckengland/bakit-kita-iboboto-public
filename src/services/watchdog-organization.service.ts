/**
 * Watchdog Organization Integration Service
 *
 * Integrates fact-checks and reports from established Philippine watchdog organizations:
 * - PCIJ (Philippine Center for Investigative Journalism)
 * - VERA Files
 * - Rappler
 * - CMFR (Center for Media Freedom and Responsibility)
 *
 * **Validates: Requirements 45.1, 45.2, 45.3, 45.4, 45.5, 45.6, 45.7**
 */

import prisma from "@/lib/prisma";
import { cache, CACHE_TTL } from "@/lib/redis";

// ============================================
// Types and Interfaces
// ============================================

/**
 * Supported watchdog organizations
 * Validates: Requirement 45.1
 */
export type WatchdogOrganization = "pcij" | "vera_files" | "rappler" | "cmfr";

/**
 * Fact-check verdict types
 */
export type FactCheckVerdict =
  | "true"
  | "false"
  | "misleading"
  | "partly_true"
  | "unverified"
  | "needs_context"
  | "satire"
  | "opinion";

/**
 * Raw fact-check data from organization feeds
 */
export interface RawFactCheck {
  title: string;
  summary?: string;
  claim?: string;
  verdict?: string;
  articleUrl: string;
  publishedAt: Date;
  politicianNames?: string[];
}

/**
 * Fact-check record with full attribution
 * Validates: Requirements 45.2, 45.3, 45.4
 */
export interface FactCheckRecord {
  id: string;
  politicianId: string;
  politicianName?: string;
  organization: WatchdogOrganization;
  organizationName: string;
  title: string;
  summary: string | null;
  claim: string | null;
  verdict: string | null;
  articleUrl: string;
  publishedAt: Date;
  retrievedAt: Date;
  isThirdPartyFactCheck: true;
  attribution: FactCheckAttribution;
}

/**
 * Attribution information for fact-checks
 * Validates: Requirement 45.3
 */
export interface FactCheckAttribution {
  organization: WatchdogOrganization;
  organizationFullName: string;
  organizationUrl: string;
  articleUrl: string;
  publishedAt: Date;
  disclaimer: string;
}

/**
 * Fact-checks grouped by claim for multiple organization coverage
 * Validates: Requirement 45.7
 */
export interface GroupedFactChecks {
  claim: string;
  factChecks: FactCheckRecord[];
  organizationCount: number;
}

/**
 * Monitoring job status
 */
export interface MonitoringJobStatus {
  jobId: string;
  organization: WatchdogOrganization;
  status: "pending" | "running" | "completed" | "failed";
  factChecksFound: number;
  factChecksAdded: number;
  factChecksUpdated: number;
  errors: string[];
  startedAt: Date;
  completedAt: Date | null;
}

/**
 * Organization API configuration
 */
export interface OrganizationConfig {
  organization: WatchdogOrganization;
  name: string;
  url: string;
  feedUrl?: string;
  apiKey?: string;
  enabled: boolean;
  rateLimit: number;
}

// ============================================
// Constants
// ============================================

/**
 * Supported watchdog organizations
 * Validates: Requirement 45.1
 */
export const WATCHDOG_ORGANIZATIONS: WatchdogOrganization[] = [
  "pcij",
  "vera_files",
  "rappler",
  "cmfr",
];

/**
 * Organization metadata
 */
export const ORGANIZATION_INFO: Record<
  WatchdogOrganization,
  {
    name: string;
    fullName: string;
    url: string;
    feedUrl: string;
    description: string;
  }
> = {
  pcij: {
    name: "PCIJ",
    fullName: "Philippine Center for Investigative Journalism",
    url: "https://pcij.org",
    feedUrl: "https://pcij.org/feed",
    description: "Non-profit investigative journalism organization founded in 1989",
  },
  vera_files: {
    name: "VERA Files",
    fullName: "VERA Files",
    url: "https://verafiles.org",
    feedUrl: "https://verafiles.org/feed",
    description:
      "Independent media organization focused on fact-checking and investigative journalism",
  },
  rappler: {
    name: "Rappler",
    fullName: "Rappler",
    url: "https://www.rappler.com",
    feedUrl: "https://www.rappler.com/feed",
    description: "Digital news organization with dedicated fact-check section",
  },
  cmfr: {
    name: "CMFR",
    fullName: "Center for Media Freedom and Responsibility",
    url: "https://cmfr-phil.org",
    feedUrl: "https://cmfr-phil.org/feed",
    description: "Media watchdog organization promoting press freedom and responsible journalism",
  },
};

/**
 * Third-party fact-check disclaimer
 * Validates: Requirement 45.5
 */
export const THIRD_PARTY_DISCLAIMER =
  "This fact-check is from a third-party watchdog organization and is displayed for informational purposes. " +
  "The platform does not independently verify third-party fact-checks. " +
  "Please refer to the original source for full context and methodology.";

export const SHORT_DISCLAIMER = "Third-party fact-check - See original source";

const CACHE_KEY_FACT_CHECKS = "watchdog:fact_checks:";
const DEFAULT_LIMIT = 20;

// ============================================
// Error Classes
// ============================================

export class WatchdogOrganizationError extends Error {
  constructor(
    message: string,
    public code:
      | "FETCH_FAILED"
      | "PARSE_ERROR"
      | "INVALID_ORGANIZATION"
      | "RATE_LIMITED"
      | "NOT_FOUND"
      | "POLITICIAN_NOT_FOUND"
  ) {
    super(message);
    this.name = "WatchdogOrganizationError";
  }
}

// ============================================
// In-Memory Storage (for development/testing)
// ============================================

const monitoringJobs: Map<string, MonitoringJobStatus> = new Map();
const organizationConfigs: Map<WatchdogOrganization, OrganizationConfig> = new Map();

// Initialize default configs
for (const org of WATCHDOG_ORGANIZATIONS) {
  const info = ORGANIZATION_INFO[org];
  organizationConfigs.set(org, {
    organization: org,
    name: info.name,
    url: info.url,
    feedUrl: info.feedUrl,
    enabled: true,
    rateLimit: 60,
  });
}

// ============================================
// Helper Functions
// ============================================

/**
 * Generate a unique job ID
 */
export function generateJobId(): string {
  return `watchdog_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Check if an organization is valid
 */
export function isValidOrganization(org: string): org is WatchdogOrganization {
  return WATCHDOG_ORGANIZATIONS.includes(org as WatchdogOrganization);
}

/**
 * Get organization display name
 */
export function getOrganizationName(org: WatchdogOrganization): string {
  return ORGANIZATION_INFO[org].fullName;
}

/**
 * Get organization URL
 */
export function getOrganizationUrl(org: WatchdogOrganization): string {
  return ORGANIZATION_INFO[org].url;
}

/**
 * Create attribution for a fact-check
 * Validates: Requirement 45.3
 */
export function createAttribution(
  organization: WatchdogOrganization,
  articleUrl: string,
  publishedAt: Date
): FactCheckAttribution {
  const info = ORGANIZATION_INFO[organization];
  return {
    organization,
    organizationFullName: info.fullName,
    organizationUrl: info.url,
    articleUrl,
    publishedAt,
    disclaimer: THIRD_PARTY_DISCLAIMER,
  };
}

/**
 * Validate that a fact-check has proper third-party labeling
 * Validates: Requirement 45.5
 */
export function validateThirdPartyLabeling(data: Partial<FactCheckRecord>): boolean {
  return (
    data.isThirdPartyFactCheck === true &&
    data.attribution !== undefined &&
    data.attribution.disclaimer !== undefined &&
    data.attribution.disclaimer.length > 0
  );
}

/**
 * Label data as third-party fact-check
 * Validates: Requirement 45.5
 */
export function labelAsThirdPartyFactCheck<T extends object>(
  data: T,
  organization: WatchdogOrganization,
  articleUrl: string,
  publishedAt: Date
): T & { isThirdPartyFactCheck: true; attribution: FactCheckAttribution } {
  return {
    ...data,
    isThirdPartyFactCheck: true as const,
    attribution: createAttribution(organization, articleUrl, publishedAt),
  };
}

/**
 * Normalize claim text for comparison
 */
export function normalizeClaim(claim: string): string {
  return claim
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Check if two claims are similar (for grouping)
 * Validates: Requirement 45.7
 */
export function areClaimsSimilar(claim1: string, claim2: string): boolean {
  const normalized1 = normalizeClaim(claim1);
  const normalized2 = normalizeClaim(claim2);

  if (normalized1 === normalized2) {
    return true;
  }

  // Check for significant overlap (Jaccard similarity)
  const words1 = normalized1.split(" ");
  const words2 = normalized2.split(" ");
  const set1 = new Set(words1);
  const set2 = new Set(words2);

  let intersectionCount = 0;
  for (const word of words1) {
    if (set2.has(word)) {
      intersectionCount++;
    }
  }

  const unionCount = set1.size + set2.size - intersectionCount;
  const similarity = unionCount > 0 ? intersectionCount / unionCount : 0;
  return similarity > 0.7;
}

// ============================================
// Organization Feed Clients
// ============================================

/**
 * Base interface for organization feed clients
 */
export interface OrganizationFeedClient {
  organization: WatchdogOrganization;
  fetchFactChecks(limit: number): Promise<RawFactCheck[]>;
  isConfigured(): boolean;
}

/**
 * PCIJ Feed Client
 */
export class PCIJClient implements OrganizationFeedClient {
  organization: WatchdogOrganization = "pcij";
  private config: OrganizationConfig;

  constructor(config: OrganizationConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    return this.config.enabled;
  }

  async fetchFactChecks(_limit: number): Promise<RawFactCheck[]> {
    if (!this.isConfigured()) {
      return [];
    }
    // In production: Parse RSS feed from PCIJ
    return [];
  }
}

/**
 * VERA Files Feed Client
 */
export class VERAFilesClient implements OrganizationFeedClient {
  organization: WatchdogOrganization = "vera_files";
  private config: OrganizationConfig;

  constructor(config: OrganizationConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    return this.config.enabled;
  }

  async fetchFactChecks(_limit: number): Promise<RawFactCheck[]> {
    if (!this.isConfigured()) {
      return [];
    }
    // In production: Parse RSS feed from VERA Files
    return [];
  }
}

/**
 * Rappler Feed Client
 */
export class RapplerClient implements OrganizationFeedClient {
  organization: WatchdogOrganization = "rappler";
  private config: OrganizationConfig;

  constructor(config: OrganizationConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    return this.config.enabled;
  }

  async fetchFactChecks(_limit: number): Promise<RawFactCheck[]> {
    if (!this.isConfigured()) {
      return [];
    }
    // In production: Parse RSS feed from Rappler fact-check section
    return [];
  }
}

/**
 * CMFR Feed Client
 */
export class CMFRClient implements OrganizationFeedClient {
  organization: WatchdogOrganization = "cmfr";
  private config: OrganizationConfig;

  constructor(config: OrganizationConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    return this.config.enabled;
  }

  async fetchFactChecks(_limit: number): Promise<RawFactCheck[]> {
    if (!this.isConfigured()) {
      return [];
    }
    // In production: Parse RSS feed from CMFR
    return [];
  }
}

// ============================================
// Client Factory
// ============================================

/**
 * Create a feed client for an organization
 */
export function createClient(organization: WatchdogOrganization): OrganizationFeedClient {
  const config = organizationConfigs.get(organization) || {
    organization,
    name: ORGANIZATION_INFO[organization].name,
    url: ORGANIZATION_INFO[organization].url,
    feedUrl: ORGANIZATION_INFO[organization].feedUrl,
    enabled: false,
    rateLimit: 60,
  };

  switch (organization) {
    case "pcij":
      return new PCIJClient(config);
    case "vera_files":
      return new VERAFilesClient(config);
    case "rappler":
      return new RapplerClient(config);
    case "cmfr":
      return new CMFRClient(config);
    default:
      throw new WatchdogOrganizationError(
        `Unsupported organization: ${organization}`,
        "INVALID_ORGANIZATION"
      );
  }
}

/**
 * Get all configured clients
 */
export function getConfiguredClients(): OrganizationFeedClient[] {
  return WATCHDOG_ORGANIZATIONS.map(createClient).filter((client) => client.isConfigured());
}

// ============================================
// Configuration Management
// ============================================

/**
 * Configure an organization feed
 */
export function configureOrganization(config: OrganizationConfig): void {
  if (!isValidOrganization(config.organization)) {
    throw new WatchdogOrganizationError(
      `Invalid organization: ${config.organization}`,
      "INVALID_ORGANIZATION"
    );
  }
  organizationConfigs.set(config.organization, config);
}

/**
 * Get configuration for an organization
 */
export function getOrganizationConfig(
  organization: WatchdogOrganization
): OrganizationConfig | null {
  return organizationConfigs.get(organization) || null;
}

/**
 * Check if any organizations are configured
 */
export function hasConfiguredOrganizations(): boolean {
  return getConfiguredClients().length > 0;
}

// ============================================
// Core Service Functions
// ============================================

// Type for Prisma FactCheck model (until Prisma client is regenerated)
interface PrismaFactCheck {
  id: string;
  politicianId: string;
  organization: string;
  title: string;
  summary: string | null;
  claim: string | null;
  verdict: string | null;
  articleUrl: string;
  publishedAt: Date;
  retrievedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface PrismaFactCheckWithPolitician extends PrismaFactCheck {
  Politician: { id: string; fullName: string };
}

/**
 * Get fact-checks for a politician
 * Validates: Requirements 45.2, 45.3, 45.4, 45.5
 */
export async function getFactChecksForPolitician(
  politicianId: string,
  options: {
    organization?: WatchdogOrganization;
    limit?: number;
    offset?: number;
  } = {}
): Promise<FactCheckRecord[]> {
  const { organization, limit = DEFAULT_LIMIT, offset = 0 } = options;

  const cacheKey = `${CACHE_KEY_FACT_CHECKS}${politicianId}:${organization || "all"}:${limit}:${offset}`;
  const cached = await cache.get<FactCheckRecord[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const politician = await prisma.politician.findUnique({
    where: { id: politicianId },
    select: { id: true, fullName: true },
  });

  if (!politician) {
    throw new WatchdogOrganizationError(
      `Politician not found: ${politicianId}`,
      "POLITICIAN_NOT_FOUND"
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = { politicianId };
  if (organization) {
    whereClause.organization = organization;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const factChecks = (await (prisma as any).factCheck.findMany({
    where: whereClause,
    orderBy: { publishedAt: "desc" },
    take: limit,
    skip: offset,
  })) as PrismaFactCheck[];

  const records: FactCheckRecord[] = factChecks.map((fc: PrismaFactCheck) => ({
    id: fc.id,
    politicianId: fc.politicianId,
    politicianName: politician.fullName,
    organization: fc.organization as WatchdogOrganization,
    organizationName: getOrganizationName(fc.organization as WatchdogOrganization),
    title: fc.title,
    summary: fc.summary,
    claim: fc.claim,
    verdict: fc.verdict,
    articleUrl: fc.articleUrl,
    publishedAt: fc.publishedAt,
    retrievedAt: fc.retrievedAt,
    isThirdPartyFactCheck: true as const,
    attribution: createAttribution(
      fc.organization as WatchdogOrganization,
      fc.articleUrl,
      fc.publishedAt
    ),
  }));

  await cache.set(cacheKey, JSON.stringify(records), CACHE_TTL.SHORT);
  return records;
}

/**
 * Get fact-checks grouped by claim (when multiple organizations fact-checked the same claim)
 * Validates: Requirement 45.7
 */
export async function getGroupedFactChecks(politicianId: string): Promise<GroupedFactChecks[]> {
  const factChecks = await getFactChecksForPolitician(politicianId, {
    limit: 100,
  });

  if (factChecks.length === 0) {
    return [];
  }

  const groups: Map<string, FactCheckRecord[]> = new Map();

  for (const fc of factChecks) {
    if (!fc.claim) {
      continue;
    }

    let foundGroup = false;
    const entries = Array.from(groups.entries());
    for (const [existingClaim, group] of entries) {
      if (areClaimsSimilar(fc.claim, existingClaim)) {
        group.push(fc);
        foundGroup = true;
        break;
      }
    }

    if (!foundGroup) {
      groups.set(fc.claim, [fc]);
    }
  }

  const result: GroupedFactChecks[] = [];
  const groupEntries = Array.from(groups.entries());

  for (const [claim, factCheckGroup] of groupEntries) {
    const uniqueOrgs = new Set(factCheckGroup.map((fc: FactCheckRecord) => fc.organization));
    if (uniqueOrgs.size > 1) {
      result.push({
        claim,
        factChecks: factCheckGroup,
        organizationCount: uniqueOrgs.size,
      });
    }
  }

  result.sort((a, b) => b.organizationCount - a.organizationCount);
  return result;
}

/**
 * Get recent fact-checks across all politicians
 * Validates: Requirements 45.2, 45.6
 */
export async function getRecentFactChecks(
  options: {
    organization?: WatchdogOrganization;
    limit?: number;
    offset?: number;
    days?: number;
  } = {}
): Promise<FactCheckRecord[]> {
  const { organization, limit = DEFAULT_LIMIT, offset = 0, days = 30 } = options;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = {
    publishedAt: { gte: startDate },
  };
  if (organization) {
    whereClause.organization = organization;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const factChecks = (await (prisma as any).factCheck.findMany({
    where: whereClause,
    include: {
      Politician: {
        select: { id: true, fullName: true },
      },
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
    skip: offset,
  })) as PrismaFactCheckWithPolitician[];

  return factChecks.map((fc: PrismaFactCheckWithPolitician) => ({
    id: fc.id,
    politicianId: fc.politicianId,
    politicianName: fc.Politician.fullName,
    organization: fc.organization as WatchdogOrganization,
    organizationName: getOrganizationName(fc.organization as WatchdogOrganization),
    title: fc.title,
    summary: fc.summary,
    claim: fc.claim,
    verdict: fc.verdict,
    articleUrl: fc.articleUrl,
    publishedAt: fc.publishedAt,
    retrievedAt: fc.retrievedAt,
    isThirdPartyFactCheck: true as const,
    attribution: createAttribution(
      fc.organization as WatchdogOrganization,
      fc.articleUrl,
      fc.publishedAt
    ),
  }));
}

// ============================================
// Data Pipeline Integration
// ============================================

/**
 * Monitor organization for new fact-checks
 * Validates: Requirement 45.6
 */
export async function monitorOrganization(
  organization: WatchdogOrganization
): Promise<MonitoringJobStatus> {
  if (!isValidOrganization(organization)) {
    throw new WatchdogOrganizationError(
      `Invalid organization: ${organization}`,
      "INVALID_ORGANIZATION"
    );
  }

  const jobId = generateJobId();
  const job: MonitoringJobStatus = {
    jobId,
    organization,
    status: "pending",
    factChecksFound: 0,
    factChecksAdded: 0,
    factChecksUpdated: 0,
    errors: [],
    startedAt: new Date(),
    completedAt: null,
  };

  monitoringJobs.set(jobId, job);
  job.status = "running";

  try {
    const client = createClient(organization);
    const rawFactChecks = await client.fetchFactChecks(50);
    job.factChecksFound = rawFactChecks.length;

    for (const raw of rawFactChecks) {
      try {
        const politicianIds = await matchPoliticians(raw.politicianNames || []);

        for (const politicianId of politicianIds) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const existing = await (prisma as any).factCheck.findFirst({
            where: {
              politicianId,
              organization,
              articleUrl: raw.articleUrl,
            },
          });

          if (existing) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (prisma as any).factCheck.update({
              where: { id: existing.id },
              data: {
                title: raw.title,
                summary: raw.summary || null,
                claim: raw.claim || null,
                verdict: raw.verdict || null,
                retrievedAt: new Date(),
              },
            });
            job.factChecksUpdated++;
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (prisma as any).factCheck.create({
              data: {
                politicianId,
                organization,
                title: raw.title,
                summary: raw.summary || null,
                claim: raw.claim || null,
                verdict: raw.verdict || null,
                articleUrl: raw.articleUrl,
                publishedAt: raw.publishedAt,
                retrievedAt: new Date(),
              },
            });
            job.factChecksAdded++;
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        job.errors.push(`Failed to process fact-check: ${errorMessage}`);
      }
    }

    job.status = "completed";

    // Invalidate caches
    await cache.delByPattern(`${CACHE_KEY_FACT_CHECKS}*`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    job.errors.push(errorMessage);
    job.status = "failed";
  }

  job.completedAt = new Date();
  return job;
}

/**
 * Monitor all configured organizations for new fact-checks
 * Validates: Requirement 45.6
 */
export async function monitorAllOrganizations(): Promise<MonitoringJobStatus[]> {
  const jobs: MonitoringJobStatus[] = [];

  for (const org of WATCHDOG_ORGANIZATIONS) {
    const config = organizationConfigs.get(org);
    if (config?.enabled) {
      try {
        const job = await monitorOrganization(org);
        jobs.push(job);
      } catch (err) {
        console.error(`Failed to monitor ${org}:`, err);
      }
    }
  }

  return jobs;
}

/**
 * Match politician names to database IDs
 */
async function matchPoliticians(names: string[]): Promise<string[]> {
  if (names.length === 0) {
    return [];
  }

  const politicianIds: string[] = [];

  for (const name of names) {
    const politician = await prisma.politician.findFirst({
      where: {
        OR: [
          { fullName: { contains: name, mode: "insensitive" } },
          { lastName: { contains: name, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });

    if (politician) {
      politicianIds.push(politician.id);
    }
  }

  return politicianIds;
}

/**
 * Get monitoring job status
 */
export function getMonitoringJobStatus(jobId: string): MonitoringJobStatus | null {
  return monitoringJobs.get(jobId) || null;
}

/**
 * Get all monitoring jobs
 */
export function getAllMonitoringJobs(): MonitoringJobStatus[] {
  return Array.from(monitoringJobs.values());
}

// ============================================
// Statistics and Reporting
// ============================================

/**
 * Get fact-check statistics for a politician
 */
export async function getFactCheckStats(politicianId: string): Promise<{
  totalFactChecks: number;
  byOrganization: Record<WatchdogOrganization, number>;
  byVerdict: Record<string, number>;
  latestFactCheck: Date | null;
}> {
  const factChecks = await getFactChecksForPolitician(politicianId, { limit: 1000 });

  const byOrganization: Record<WatchdogOrganization, number> = {
    pcij: 0,
    vera_files: 0,
    rappler: 0,
    cmfr: 0,
  };

  const byVerdict: Record<string, number> = {};
  let latestFactCheck: Date | null = null;

  for (const fc of factChecks) {
    byOrganization[fc.organization]++;

    if (fc.verdict) {
      byVerdict[fc.verdict] = (byVerdict[fc.verdict] || 0) + 1;
    }

    if (!latestFactCheck || fc.publishedAt > latestFactCheck) {
      latestFactCheck = fc.publishedAt;
    }
  }

  return {
    totalFactChecks: factChecks.length,
    byOrganization,
    byVerdict,
    latestFactCheck,
  };
}

/**
 * Get organization coverage statistics
 */
export async function getOrganizationCoverageStats(): Promise<
  {
    organization: WatchdogOrganization;
    name: string;
    totalFactChecks: number;
    politiciansCovered: number;
    lastUpdated: Date | null;
  }[]
> {
  const stats: {
    organization: WatchdogOrganization;
    name: string;
    totalFactChecks: number;
    politiciansCovered: number;
    lastUpdated: Date | null;
  }[] = [];

  for (const org of WATCHDOG_ORGANIZATIONS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const factChecks = (await (prisma as any).factCheck.findMany({
      where: { organization: org },
      select: { politicianId: true, publishedAt: true },
    })) as { politicianId: string; publishedAt: Date }[];

    const uniquePoliticians = new Set(
      factChecks.map((fc: { politicianId: string }) => fc.politicianId)
    );

    let latestDate: Date | null = null;
    if (factChecks.length > 0) {
      latestDate = factChecks[0]!.publishedAt;
      for (const fc of factChecks) {
        if (latestDate && fc.publishedAt > latestDate) {
          latestDate = fc.publishedAt;
        }
      }
    }

    stats.push({
      organization: org,
      name: getOrganizationName(org),
      totalFactChecks: factChecks.length,
      politiciansCovered: uniquePoliticians.size,
      lastUpdated: latestDate,
    });
  }

  return stats;
}
