/**
 * Watchdog Organization Utilities
 *
 * Pure functions and constants for watchdog organization integration.
 * These are separated from the main service to enable easier testing.
 *
 * **Validates: Requirements 45.1, 45.3, 45.5, 45.7**
 */

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
// Pure Helper Functions
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
