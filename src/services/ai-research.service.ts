/**
 * AI Research Service - Candidate findings for human review
 *
 * When official scrapers return no new data, this service uses AI to:
 * 1. Search for missing politician data (birthdays, photos, controversies, etc.)
 * 2. Cross-reference findings across multiple sources
 * 3. Require high model confidence and two distinct credible article citations
 * 4. Stage proposals and citations for human review; never publish model output
 *
 * Uses Google Gemini with grounding (web search). Reviewers must verify every claim.
 */

import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { logger } from "../lib/logger";

// ============================================
// Types
// ============================================

export interface ResearchQuery {
  politicianId: string;
  politicianName: string;
  fields: ResearchField[];
}

export type ResearchField =
  | "birthday"
  | "birthplace"
  | "photo"
  | "party"
  | "controversies"
  | "education"
  | "positions"
  | "fact_checks"
  | "election_history"
  | "net_worth"
  | "red_flags";

export interface ResearchFinding {
  field: ResearchField;
  value: string;
  sources: SourceCitation[];
  confidence: number; // 0-1
  reasoning: string;
}

export interface SourceCitation {
  name: string;
  url?: string;
  date?: string;
}

export interface ResearchResult {
  politicianId: string;
  politicianName: string;
  findings: ResearchFinding[];
  totalSourcesChecked: number;
  timestamp: Date;
}

export interface AIResearchReport {
  startedAt: Date;
  completedAt: Date;
  politiciansResearched: number;
  fieldsUpdated: number; // Always zero: research never publishes findings
  findingsStaged: number;
  fieldsSkippedLowConfidence: number;
  errors: string[];
}

// ============================================
// Constants
// ============================================

const CONFIDENCE_THRESHOLD = 0.9; // Minimum confidence to accept a finding
const MIN_SOURCES = 2; // Minimum distinct credible article URLs
const RATE_LIMIT_DELAY_MS = 500; // Delay between AI calls (Gemini 3 Pro handles higher throughput)
const PARALLEL_CALLS = 3; // Max concurrent Gemini API calls

// ============================================
// AI Provider
// ============================================

/**
 * Call Gemini API with grounding enabled for web search.
 *
 * INTENTIONALLY Gemini-pinned (not provider-agnostic like the chatbot). This
 * pipeline relies on Gemini's built-in `googleSearch` grounding to fetch and
 * cite *real* sources — the app's core integrity rule is "never fabricate a
 * source." OpenAI / DeepSeek / OpenRouter don't offer equivalent first-party
 * grounded search, so routing this through them would invite hallucinated
 * citations and break that guarantee. Keep this on Gemini unless/until a
 * grounded-search equivalent is wired for another provider.
 */
async function callGeminiWithGrounding(prompt: string): Promise<string> {
  if (process.env.AI_RESEARCH_ENABLED !== "true") {
    throw new Error("AI research is disabled");
  }
  const apiKey = process.env.GOOGLE_AI_API_KEY;

  if (!apiKey || apiKey === "your-google-ai-api-key") {
    throw new Error("GOOGLE_AI_API_KEY not configured");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1, // Low temperature for factual accuracy
          maxOutputTokens: 4096,
        },
        tools: [{ googleSearch: {} }],
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[ai-research] Gemini API error:", errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("No response from Gemini");
  }

  return text;
}

// ============================================
// Research Functions
// ============================================

/**
 * Build a research prompt for a politician
 */
function buildResearchPrompt(name: string, fields: ResearchField[]): string {
  const fieldDescriptions: Record<ResearchField, string> = {
    birthday: "exact date of birth (format: YYYY-MM-DD)",
    birthplace: "place of birth (city/province, Philippines)",
    photo: "official photo URL from government website or credible news source",
    party: "current political party affiliation name and abbreviation",
    controversies:
      'notable legal cases, controversies, or corruption allegations with dates and status. Return as JSON array: [{"title": "...", "description": "...", "category": "legal_case|corruption|ethics_violation|other", "status": "ongoing|dismissed|convicted|acquitted|settled", "date": "YYYY-MM-DD or null"}]',
    education:
      'educational background. Return as JSON array: [{"institution": "University of the Philippines", "degree": "Bachelor of Arts", "field": "Political Science", "level": "bachelors|masters|doctorate|law|medicine|high_school|elementary|vocational|other", "yearStart": 1990, "yearEnd": 1994, "isCompleted": true}]',
    positions: "current and past government positions held",
    fact_checks:
      'recent fact-check articles about this politician from Rappler, Vera Files, or other Philippine fact-checking organizations. Return as JSON array: [{"organization": "...", "title": "...", "claim": "...", "verdict": "true|false|misleading|partly_true|unverifiable", "url": "...", "date": "YYYY-MM-DD"}]',
    election_history:
      'election results history. Return as JSON array: [{"year": 2022, "type": "national|local", "position": "Senator|Representative|...", "jurisdiction": "Philippines|...", "result": "won|lost", "votes": 12345, "totalVotes": 67890}]',
    net_worth:
      'most recent SALN (Statement of Assets, Liabilities, and Net Worth) data. Return as JSON: {"year": 2023, "totalAssets": 50000000, "totalLiabilities": 5000000, "netWorth": 45000000}',
    red_flags:
      'red flags such as dynasty connections, pending legal cases, SALN anomalies, or poor attendance records. Return as JSON array: [{"type": "legal_case|corruption|dynasty|saln_anomaly|attendance", "severity": "info|warning|critical", "title": "...", "description": "..."}]',
  };

  const requestedFields = fields.map((f) => `- ${f}: ${fieldDescriptions[f]}`).join("\n");

  return `You are a Philippine political data researcher. Research the following Filipino politician and provide ONLY verified, factual information.

POLITICIAN: ${name}

REQUESTED DATA:
${requestedFields}

RULES:
1. NEVER use Wikipedia as a source — it is not credible for this project
2. Only use these credible sources: Rappler, Inquirer, PhilStar, GMA News, ABS-CBN, Manila Times, AP News, Reuters, PCIJ, VERA Files, LawPhil
3. Government sources are also acceptable: senate.gov.ph, congress.gov.ph, comelec.gov.ph, dbm.gov.ph
4. For each piece of data, list the specific article URLs where you found it — NOT homepage URLs
5. If sources disagree, note the discrepancy and state which source is more authoritative
6. If you cannot find reliable information for a field, say "NOT_FOUND" for that field
7. For birthdays, the format MUST be YYYY-MM-DD
8. Be careful with political families — multiple members may share similar names (e.g., Marcos Sr. vs Jr., Estrada vs Ejercito)
9. Philippine Senate terms always start June 30 and end June 30
10. Every source URL must be a specific article link, not a homepage or generic page

Respond in this exact JSON format (no markdown, no code blocks, just raw JSON):
{
  "findings": [
    {
      "field": "birthday",
      "value": "1970-01-15",
      "sources": [
        {"name": "Rappler", "url": "https://rappler.com/newsbreak/iq/..."},
        {"name": "PhilStar", "url": "https://philstar.com/headlines/..."}
      ],
      "confidence": 0.95,
      "reasoning": "Both Rappler and PhilStar agree on this date"
    }
  ],
  "totalSourcesChecked": 5
}`;
}

/**
 * Parse AI response into structured findings
 */
function parseResearchResponse(
  response: string,
  politicianId: string,
  politicianName: string
): ResearchResult {
  try {
    // Try to extract JSON from the response
    let jsonStr = response.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    // If response doesn't start with {, try to find JSON object within the text
    if (!jsonStr.startsWith("{")) {
      const jsonMatch = jsonStr.match(/\{[\s\S]*"findings"[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      } else {
        console.warn(
          `[ai-research] No JSON found in response for ${politicianName}, got: ${jsonStr.substring(0, 100)}...`
        );
        return {
          politicianId,
          politicianName,
          findings: [],
          totalSourcesChecked: 0,
          timestamp: new Date(),
        };
      }
    }

    // Try to parse, with repair attempt on failure
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // Attempt common JSON repairs from Gemini output
      const repaired = jsonStr
        // Fix trailing commas before } or ]
        .replace(/,\s*([}\]])/g, "$1")
        // Fix unescaped newlines inside strings
        .replace(/(?<=:\s*"[^"]*)\n([^"]*")/g, "\\n$1")
        // Fix single quotes used instead of double quotes
        .replace(/'/g, '"')
        // Remove control characters
        .replace(/[\x00-\x1F\x7F]/g, (ch) => (ch === "\n" || ch === "\r" || ch === "\t" ? ch : ""));

      try {
        parsed = JSON.parse(repaired);
        logger.info(`[ai-research] Repaired malformed JSON for ${politicianName}`);
      } catch (repairErr) {
        console.error(`[ai-research] Failed to parse response for ${politicianName}:`, repairErr);
        console.error(`[ai-research] Raw response (first 500 chars): ${jsonStr.substring(0, 500)}`);
        return {
          politicianId,
          politicianName,
          findings: [],
          totalSourcesChecked: 0,
          timestamp: new Date(),
        };
      }
    }

    const findings: ResearchFinding[] = (parsed.findings || [])
      .filter((f: Record<string, unknown>) => f.value && f.value !== "NOT_FOUND")
      .map((f: Record<string, unknown>) => ({
        field: f.field as ResearchField,
        value: typeof f.value === "string" ? f.value : JSON.stringify(f.value),
        sources: (f.sources as SourceCitation[]) || [],
        confidence: typeof f.confidence === "number" ? f.confidence : 0,
        reasoning: (f.reasoning as string) || "",
      }));

    return {
      politicianId,
      politicianName,
      findings,
      totalSourcesChecked: parsed.totalSourcesChecked || 0,
      timestamp: new Date(),
    };
  } catch (err) {
    console.error(`[ai-research] Unexpected error processing response for ${politicianName}:`, err);
    return {
      politicianId,
      politicianName,
      findings: [],
      totalSourcesChecked: 0,
      timestamp: new Date(),
    };
  }
}

const CREDIBLE_SOURCE_DOMAINS = [
  "rappler.com",
  "inquirer.net",
  "philstar.com",
  "gmanetwork.com",
  "abs-cbn.com",
  "manilatimes.net",
  "apnews.com",
  "reuters.com",
  "pcij.org",
  "verafiles.org",
  "lawphil.net",
  "senate.gov.ph",
  "congress.gov.ph",
  "comelec.gov.ph",
  "dbm.gov.ph",
  "coa.gov.ph",
  "ombudsman.gov.ph",
  "sc.judiciary.gov.ph",
];

/** Validate citation shape only. A reviewer must verify the article and claim. */
function credibleCitationUrl(source: SourceCitation): string | null {
  if (
    !source ||
    typeof source.name !== "string" ||
    !source.name.trim() ||
    typeof source.url !== "string"
  ) {
    return null;
  }
  try {
    const url = new URL(source.url);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port) {
      return null;
    }
    const hostname = url.hostname.toLowerCase();
    if (
      !CREDIBLE_SOURCE_DOMAINS.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
      )
    ) {
      return null;
    }
    const pathname = decodeURIComponent(url.pathname).replace(/\/+/g, "/");
    // Reject homepages and common section/index pages, including encoded variants.
    if (/^\/(?:index\.(?:html?|php)|news|headlines|latest|philippines)?\/?$/i.test(pathname)) {
      return null;
    }
    // Tracking, fragment, protocol and www variants do not provide another citation.
    return `${hostname.replace(/^www\./, "")}${pathname.replace(/\/$/, "")}`;
  } catch {
    return null;
  }
}

/**
 * Validate a finding meets our quality standards
 */
function isHighConfidence(finding: ResearchFinding): boolean {
  if (
    !Number.isFinite(finding.confidence) ||
    finding.confidence < CONFIDENCE_THRESHOLD ||
    finding.confidence > 1
  ) {
    return false;
  }
  if (!Array.isArray(finding.sources)) {
    return false;
  }

  const urls = new Set<string>();
  for (const source of finding.sources) {
    const url = credibleCitationUrl(source);
    if (!url) {
      return false;
    }
    urls.add(url);
  }
  if (urls.size < MIN_SOURCES) {
    return false;
  }

  // Field-specific validation
  if (finding.field === "birthday") {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(finding.value)) {
      return false;
    }
    const parsed = new Date(finding.value);
    if (isNaN(parsed.getTime())) {
      return false;
    }
    const year = parsed.getFullYear();
    if (year < 1900 || year > 2010) {
      return false;
    }
  }

  return true;
}

// ============================================
// Human review queue
// ============================================

async function stageFinding(politicianId: string, finding: ResearchFinding): Promise<number> {
  // A stable identity makes retries harmless and preserves reviewed proposals.
  const id = createHash("sha256")
    .update(JSON.stringify([politicianId, finding.field, finding.value]))
    .digest("hex");
  const result = await prisma.aIResearchProposal.createMany({
    data: {
      id,
      politicianId,
      fieldName: finding.field,
      value: finding.value,
      sources: finding.sources as unknown as Prisma.InputJsonValue,
      confidence: finding.confidence,
      reasoning: finding.reasoning,
    },
    skipDuplicates: true,
  });
  return result.count;
}

function emptyReport(): AIResearchReport {
  const now = new Date();
  return {
    startedAt: now,
    completedAt: now,
    politiciansResearched: 0,
    fieldsUpdated: 0,
    findingsStaged: 0,
    fieldsSkippedLowConfidence: 0,
    errors: [],
  };
}

// ============================================
// Main Research Functions
// ============================================

/**
 * Research a single politician for missing data
 */
export async function researchPolitician(
  politicianId: string,
  politicianName: string,
  fields: ResearchField[]
): Promise<ResearchResult> {
  if (process.env.AI_RESEARCH_ENABLED !== "true") {
    return {
      politicianId,
      politicianName,
      findings: [],
      totalSourcesChecked: 0,
      timestamp: new Date(),
    };
  }
  logger.info(`[ai-research] Researching ${politicianName} for: ${fields.join(", ")}`);

  const prompt = buildResearchPrompt(politicianName, fields);
  const response = await callGeminiWithGrounding(prompt);
  const result = parseResearchResponse(response, politicianId, politicianName);

  logger.info(
    `[ai-research] ${politicianName}: ${result.findings.length} findings from ${result.totalSourcesChecked} sources`
  );

  return result;
}

/**
 * Core research runner — finds politicians missing data and researches them.
 * Used by all the specific research functions below.
 */
async function runResearchBatch(
  label: string,
  findPoliticians: () => Promise<Array<{ id: string; fullName: string }>>,
  getFields: (pol: { id: string; fullName: string }) => ResearchField[],
  maxPoliticians: number
): Promise<AIResearchReport> {
  if (process.env.AI_RESEARCH_ENABLED !== "true") {
    return emptyReport();
  }
  const startedAt = new Date();
  const errors: string[] = [];
  let findingsStaged = 0;
  let fieldsSkippedLowConfidence = 0;

  logger.info(`[ai-research] Starting AI research: ${label}...`);

  const candidates = await findPoliticians();
  const toResearch = candidates.slice(0, maxPoliticians);

  logger.info(
    `[ai-research] Found ${candidates.length} candidates, researching top ${toResearch.length}`
  );

  for (let i = 0; i < toResearch.length; i += PARALLEL_CALLS) {
    const batch = toResearch.slice(i, i + PARALLEL_CALLS);

    // Process politicians in parallel (up to PARALLEL_CALLS at once)
    const results = await Promise.allSettled(
      batch.map(async (pol) => {
        const fields = getFields(pol);
        if (fields.length === 0) {
          return;
        }

        const result = await researchPolitician(pol.id, pol.fullName, fields);

        for (const finding of result.findings) {
          if (fields.includes(finding.field) && isHighConfidence(finding)) {
            findingsStaged += await stageFinding(pol.id, finding);
          } else {
            fieldsSkippedLowConfidence++;
            logger.info(
              `[ai-research] Skipped ${finding.field} for ${pol.fullName}: field, confidence or citations did not qualify for review`
            );
          }
        }
      })
    );

    for (const r of results) {
      if (r.status === "rejected") {
        const msg = `Research failed: ${r.reason}`;
        console.error(`[ai-research] ${msg}`);
        errors.push(msg);
      }
    }

    // Small delay between batches to avoid rate limits
    if (i + PARALLEL_CALLS < toResearch.length) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
    }
  }

  const completedAt = new Date();
  const report: AIResearchReport = {
    startedAt,
    completedAt,
    politiciansResearched: toResearch.length,
    fieldsUpdated: 0,
    findingsStaged,
    fieldsSkippedLowConfidence,
    errors,
  };

  logger.info(
    `[ai-research] ${label} complete: ${findingsStaged} findings staged for review, ${fieldsSkippedLowConfidence} skipped, ${errors.length} errors`
  );

  return report;
}

// ============================================
// Specific Research Functions
// ============================================

/**
 * Research missing basic data (birthday, birthplace)
 */
export async function researchMissingData(maxPoliticians: number = 20): Promise<AIResearchReport> {
  return runResearchBatch(
    "missing_data",
    async () => {
      const pols = await prisma.politician.findMany({
        where: {
          OR: [{ birthday: null }, { birthplace: null }],
        },
        include: {
          Position: { where: { isCurrent: true }, take: 1 },
          _count: { select: { BillAuthor: true } },
        },
        orderBy: [{ isActive: "desc" }],
        take: maxPoliticians * 3,
      });

      // Sort: current position holders first, then by bill count
      return pols
        .sort((a, b) => {
          const aHas = a.Position.length > 0 ? 1 : 0;
          const bHas = b.Position.length > 0 ? 1 : 0;
          if (aHas !== bHas) {
            return bHas - aHas;
          }
          return b._count.BillAuthor - a._count.BillAuthor;
        })
        .map((p) => ({
          id: p.id,
          fullName: p.fullName,
          _birthday: p.birthday,
          _birthplace: p.birthplace,
        }));
    },
    (pol) => {
      const fields: ResearchField[] = [];
      const p = pol as { _birthday?: Date | null; _birthplace?: string | null };
      if (!p._birthday) {
        fields.push("birthday");
      }
      if (!p._birthplace) {
        fields.push("birthplace");
      }
      return fields;
    },
    maxPoliticians
  );
}

/**
 * Research controversies for active politicians
 */
export async function researchControversies(
  maxPoliticians: number = 10
): Promise<AIResearchReport> {
  return runResearchBatch(
    "controversies",
    async () => {
      return prisma.politician.findMany({
        where: {
          isActive: true,
          Controversy: { none: {} },
          Position: { some: { isCurrent: true } },
        },
        select: { id: true, fullName: true },
        take: maxPoliticians,
      });
    },
    () => ["controversies"],
    maxPoliticians
  );
}

/**
 * Research fact checks for active politicians
 */
export async function researchFactChecks(maxPoliticians: number = 10): Promise<AIResearchReport> {
  return runResearchBatch(
    "fact_checks",
    async () => {
      return prisma.politician.findMany({
        where: {
          isActive: true,
          FactCheck: { none: {} },
          Position: { some: { isCurrent: true } },
        },
        select: { id: true, fullName: true },
        take: maxPoliticians,
      });
    },
    () => ["fact_checks"],
    maxPoliticians
  );
}

/**
 * Research election history for politicians missing it
 */
export async function researchElectionHistory(
  maxPoliticians: number = 10
): Promise<AIResearchReport> {
  return runResearchBatch(
    "election_history",
    async () => {
      return prisma.politician.findMany({
        where: {
          isActive: true,
          ElectionResultRecord: { none: {} },
          Position: { some: { isCurrent: true } },
        },
        select: { id: true, fullName: true },
        take: maxPoliticians,
      });
    },
    () => ["election_history"],
    maxPoliticians
  );
}

/**
 * Research SALN / net worth for active politicians
 */
export async function researchNetWorth(maxPoliticians: number = 10): Promise<AIResearchReport> {
  return runResearchBatch(
    "net_worth",
    async () => {
      return prisma.politician.findMany({
        where: {
          isActive: true,
          SALNRecord: { none: {} },
          Position: { some: { isCurrent: true } },
        },
        select: { id: true, fullName: true },
        take: maxPoliticians,
      });
    },
    () => ["net_worth"],
    maxPoliticians
  );
}

/**
 * Research red flags for active politicians
 */
export async function researchRedFlags(maxPoliticians: number = 10): Promise<AIResearchReport> {
  return runResearchBatch(
    "red_flags",
    async () => {
      return prisma.politician.findMany({
        where: {
          isActive: true,
          RedFlag: { none: {} },
          Position: { some: { isCurrent: true } },
        },
        select: { id: true, fullName: true },
        take: maxPoliticians,
      });
    },
    () => ["red_flags"],
    maxPoliticians
  );
}

/**
 * Research party affiliations for politicians without one
 */
export async function researchPartyAffiliations(
  maxPoliticians: number = 10
): Promise<AIResearchReport> {
  return runResearchBatch(
    "party_affiliations",
    async () => {
      return prisma.politician.findMany({
        where: {
          isActive: true,
          PartyAffiliation: { none: { isCurrent: true } },
          Position: { some: { isCurrent: true } },
        },
        select: { id: true, fullName: true },
        take: maxPoliticians,
      });
    },
    () => ["party"],
    maxPoliticians
  );
}

/**
 * Research education for politicians missing it
 */
export async function researchEducation(maxPoliticians: number = 10): Promise<AIResearchReport> {
  return runResearchBatch(
    "education",
    async () => {
      const pols = await prisma.politician.findMany({
        where: {
          isActive: true,
          Education: { none: {} },
          Position: { some: { isCurrent: true } },
        },
        include: {
          Position: { where: { isCurrent: true }, take: 1 },
          _count: { select: { BillAuthor: true } },
        },
        take: maxPoliticians * 3,
      });

      // Prioritize: senators first, then by bill count (more active = more visible)
      return pols
        .sort((a, b) => {
          const aIsSenator = a.Position.some((p) => p.title.toLowerCase().includes("senator"))
            ? 1
            : 0;
          const bIsSenator = b.Position.some((p) => p.title.toLowerCase().includes("senator"))
            ? 1
            : 0;
          if (aIsSenator !== bIsSenator) {
            return bIsSenator - aIsSenator;
          }
          return b._count.BillAuthor - a._count.BillAuthor;
        })
        .map((p) => ({ id: p.id, fullName: p.fullName }));
    },
    () => ["education"],
    maxPoliticians
  );
}

/**
 * Comprehensive research — runs all research types in sequence.
 * Used as the main AI fallback when official scrapers return nothing.
 */
export async function researchAll(maxPerType: number = 5): Promise<AIResearchReport> {
  const startedAt = new Date();
  if (process.env.AI_RESEARCH_ENABLED !== "true") {
    return emptyReport();
  }
  let totalStaged = 0;
  let totalSkipped = 0;
  const allErrors: string[] = [];
  let totalResearched = 0;

  // Group research types into parallel batches of 2-3
  // to balance speed vs API rate limits
  const batches = [
    [() => researchMissingData(maxPerType), () => researchEducation(maxPerType)],
    [
      () => researchControversies(maxPerType),
      () => researchFactChecks(maxPerType),
      () => researchPartyAffiliations(maxPerType),
    ],
    [
      () => researchElectionHistory(maxPerType),
      () => researchNetWorth(maxPerType),
      () => researchRedFlags(maxPerType),
    ],
  ];

  for (const batch of batches) {
    const results = await Promise.allSettled(batch.map((fn) => fn()));

    for (const r of results) {
      if (r.status === "fulfilled") {
        const report = r.value;
        totalResearched += report.politiciansResearched;
        totalStaged += report.findingsStaged;
        totalSkipped += report.fieldsSkippedLowConfidence;
        allErrors.push(...report.errors);
      } else {
        allErrors.push(`Research batch failed: ${r.reason}`);
      }
    }
  }

  return {
    startedAt,
    completedAt: new Date(),
    politiciansResearched: totalResearched,
    fieldsUpdated: 0,
    findingsStaged: totalStaged,
    fieldsSkippedLowConfidence: totalSkipped,
    errors: allErrors,
  };
}
