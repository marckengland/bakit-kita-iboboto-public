/**
 * Web Scrapers for Philippine Government Data Sources
 * Uses Playwright for reliable browser-based scraping
 */

import { chromium, Browser, Page } from "playwright";
import { logger } from "../../lib/logger";

// ============================================
// Types
// ============================================

export interface ScrapedBill {
  billNumber: string;
  title: string;
  summary: string;
  filingDate: Date;
  status: "pending" | "passed" | "vetoed" | "lapsed" | "withdrawn";
  republicActNumber?: string;
  congress: number;
  session: number;
  authors?: string[];
  sourceUrl?: string;
}

export interface ScrapedPolitician {
  fullName: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  position: string;
  chamber: "senate" | "house";
  district?: string;
  party?: string;
  isActive: boolean;
  termStart?: Date;
  termEnd?: Date;
  photo?: string;
  sourceUrl?: string;
}

export interface ScrapedElection {
  candidateName: string;
  year: number;
  type: "national" | "local" | "barangay" | "special";
  position: string;
  jurisdiction: string;
  result: "won" | "lost";
  votes: number;
  totalVotes: number;
}

export interface ScrapedProject {
  name: string;
  agency: string;
  budget: number;
  year: number;
  status: string;
}

export interface ScrapedCoaFinding {
  agency: string;
  year: number;
  finding: string;
  amount?: number;
  status: string;
}

export interface ScrapedCourtCase {
  caseNumber: string;
  title: string;
  court: string;
  filingDate: Date;
  status: string;
  decision?: string;
}

export interface ScrapedOmbudsmanCase {
  caseNumber: string;
  respondent: string;
  offense: string;
  filingDate: Date;
  status: string;
  decision?: string;
}

// ============================================
// Browser Management
// ============================================

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance) {
    browserInstance = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browserInstance;
}

async function getPage(): Promise<Page> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    viewport: { width: 1920, height: 1080 },
  });
  return context.newPage();
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

// ============================================
// Senate Scraper - Using BetterGov Open Congress API
// ============================================

/**
 * Pagination response from BetterGov API
 */
interface BetterGovPaginatedResponse {
  success: boolean;
  data: Array<{
    name?: string;
    bill_number?: number;
    title?: string;
    long_title?: string;
    congress_website_title?: string;
    subtype?: string;
    date_filed?: string;
    congress?: number;
    authors?: Array<{ first_name: string; last_name: string }>;
    senate_website_permalink?: string;
  }>;
  meta?: {
    total?: number;
    page?: number;
    per_page?: number;
    last_page?: number;
  };
}

/**
 * Fetch all pages from BetterGov API with pagination support
 */
async function fetchAllPages(
  baseUrl: string,
  maxPages: number = 10,
  perPage: number = 100
): Promise<BetterGovPaginatedResponse["data"]> {
  const allData: BetterGovPaginatedResponse["data"] = [];
  let currentPage = 1;
  let hasMore = true;

  while (hasMore && currentPage <= maxPages) {
    const url = `${baseUrl}&page=${currentPage}&limit=${perPage}`;
    logger.info(`Fetching page ${currentPage}: ${url}`);

    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        console.error(`API request failed for page ${currentPage}: ${response.status}`);
        break;
      }

      const result: BetterGovPaginatedResponse = await response.json();

      if (!result.success || !result.data || result.data.length === 0) {
        hasMore = false;
        break;
      }

      allData.push(...result.data);
      logger.info(
        `Page ${currentPage}: fetched ${result.data.length} records (total: ${allData.length})`
      );

      // Check if there are more pages
      if (result.meta?.last_page) {
        hasMore = currentPage < result.meta.last_page;
      } else {
        // If no meta info, check if we got a full page
        hasMore = result.data.length >= perPage;
      }

      currentPage++;

      // Small delay to be respectful to the API
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Error fetching page ${currentPage}:`, error);
      break;
    }
  }

  return allData;
}

export async function scrapeSenateWebsite(): Promise<ScrapedBill[]> {
  const bills: ScrapedBill[] = [];

  try {
    logger.info("Fetching Senate bills from BetterGov Open Congress API with pagination...");

    // Fetch all pages of Senate bills from the current Congress (20th)
    const allDocs = await fetchAllPages(
      "https://open-congress-api.bettergov.ph/api/documents?congress=20&subtype=SB",
      50, // Max 50 pages to get all bills
      100 // 100 per page
    );

    logger.info(`Total documents fetched: ${allDocs.length}`);

    for (const doc of allDocs) {
      // Filter for Senate bills only (double-check)
      if (doc.subtype !== "SB") {
        continue;
      }

      // Get the best available title
      const title = doc.title || doc.long_title || doc.congress_website_title || "Untitled Bill";
      const truncatedTitle = title.substring(0, 500);

      // Skip if no meaningful title
      if (truncatedTitle === "Untitled Bill" || !truncatedTitle.trim()) {
        continue;
      }

      // Parse filing date
      let filingDate = new Date();
      if (doc.date_filed) {
        const parsed = new Date(doc.date_filed);
        if (!isNaN(parsed.getTime())) {
          filingDate = parsed;
        }
      }

      // Determine status (API doesn't provide status, default to pending)
      const status: ScrapedBill["status"] = "pending";

      bills.push({
        billNumber: doc.name || `SBN-${doc.bill_number}`,
        title: truncatedTitle,
        summary: (doc.long_title || truncatedTitle).substring(0, 300),
        filingDate,
        status,
        congress: doc.congress || 19,
        session: 1,
        authors: doc.authors?.map?.(
          (a: { first_name: string; last_name: string }) => `${a.first_name} ${a.last_name}`
        ),
        sourceUrl: doc.senate_website_permalink || undefined,
      });
    }

    logger.info(`Scraped ${bills.length} Senate bills from BetterGov API`);
  } catch (error) {
    console.error("Senate API error:", error);

    // Fallback to sample data if API fails
    return [
      {
        billNumber: "SBN-2700",
        title: "Maharlika Investment Fund Act",
        summary: "An Act Establishing the Maharlika Investment Fund",
        filingDate: new Date("2023-01-15"),
        status: "passed",
        congress: 19,
        session: 1,
      },
    ];
  }

  return bills;
}

// ============================================
// House Scraper - Using BetterGov Open Congress API
// ============================================

export async function scrapeHouseWebsite(): Promise<ScrapedBill[]> {
  const bills: ScrapedBill[] = [];

  try {
    logger.info("Fetching House bills from BetterGov Open Congress API with pagination...");

    // Fetch all pages of House bills from the current Congress (20th)
    const allDocs = await fetchAllPages(
      "https://open-congress-api.bettergov.ph/api/documents?congress=20&subtype=HB",
      100, // Max 100 pages (House has many more bills)
      100 // 100 per page
    );

    logger.info(`Total House documents fetched: ${allDocs.length}`);

    for (const doc of allDocs) {
      // Skip if not a House bill
      if (doc.subtype !== "HB") {
        continue;
      }

      // Get the best available title
      const title = doc.title || doc.long_title || doc.congress_website_title || "Untitled Bill";
      const truncatedTitle = title.substring(0, 500);

      // Parse filing date
      let filingDate = new Date();
      if (doc.date_filed) {
        const parsed = new Date(doc.date_filed);
        if (!isNaN(parsed.getTime())) {
          filingDate = parsed;
        }
      }

      // Determine status (API doesn't provide status, default to pending)
      const status: ScrapedBill["status"] = "pending";

      bills.push({
        billNumber: doc.name || `HBN-${doc.bill_number}`,
        title: truncatedTitle,
        summary: (doc.long_title || doc.congress_website_title || truncatedTitle).substring(0, 300),
        filingDate,
        status,
        congress: doc.congress || 19,
        session: 1,
        authors: doc.authors?.map(
          (a: { first_name: string; last_name: string }) => `${a.first_name} ${a.last_name}`
        ),
      });
    }

    logger.info(`Scraped ${bills.length} House bills from BetterGov API`);
  } catch (error) {
    console.error("House API error:", error);

    // Fallback to sample data if API fails
    return [
      {
        billNumber: "HBN-1234",
        title: "Sample House Bill",
        summary: "A sample House bill for testing",
        filingDate: new Date("2023-01-15"),
        status: "pending",
        congress: 19,
        session: 1,
      },
    ];
  }

  return bills;
}

// ============================================
// COMELEC Scraper
// ============================================

export async function scrapeComelecWebsite(): Promise<ScrapedElection[]> {
  const elections: ScrapedElection[] = [];
  let page: Page | null = null;

  try {
    page = await getPage();

    logger.info("Scraping COMELEC data...");

    await page.goto("https://comelec.gov.ph/?r=Elections/ElectionResults", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    await page.waitForSelector("table", { timeout: 10000 }).catch(() => null);

    const data = await page.evaluate(() => {
      const results: Array<{ name: string; position: string; votes: string; result: string }> = [];
      const rows = document.querySelectorAll("table tr");

      rows.forEach((row, i) => {
        if (i === 0) {
          return;
        }
        const cells = row.querySelectorAll("td");
        if (cells.length < 3) {
          return;
        }

        results.push({
          name: cells[0]?.textContent?.trim() || "",
          position: cells[1]?.textContent?.trim() || "",
          votes: cells[2]?.textContent?.trim().replace(/,/g, "") || "",
          result: cells[3]?.textContent?.trim().toLowerCase() || "",
        });
      });

      return results;
    });

    for (const item of data) {
      if (!item.name || !item.position) {
        continue;
      }

      elections.push({
        candidateName: item.name,
        year: new Date().getFullYear(),
        type: "national",
        position: item.position,
        jurisdiction: "Philippines",
        result: item.result.includes("won") ? "won" : "lost",
        votes: parseInt(item.votes) || 0,
        totalVotes: 0,
      });
    }

    logger.info(`Scraped ${elections.length} election records`);
  } catch (error) {
    console.error("COMELEC scraping error:", error);
  } finally {
    if (page) {
      await page.close();
    }
  }

  return elections;
}

// ============================================
// DBM Scraper
// ============================================

export async function scrapeDbmWebsite(): Promise<ScrapedProject[]> {
  const projects: ScrapedProject[] = [];
  let page: Page | null = null;

  try {
    page = await getPage();

    logger.info("Scraping DBM data...");

    await page.goto("https://www.dbm.gov.ph/index.php/programs-projects", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    await page.waitForSelector("table, article", { timeout: 10000 }).catch(() => null);

    const data = await page.evaluate(() => {
      const results: Array<{ name: string; agency: string; budget: string }> = [];
      const rows = document.querySelectorAll("table tr");

      rows.forEach((row, i) => {
        if (i === 0) {
          return;
        }
        const cells = row.querySelectorAll("td");
        if (cells.length < 2) {
          return;
        }

        results.push({
          name: cells[0]?.textContent?.trim() || "",
          agency: cells[1]?.textContent?.trim() || "",
          budget: cells[2]?.textContent?.trim().replace(/[₱,]/g, "") || "",
        });
      });

      return results;
    });

    for (const item of data) {
      if (!item.name) {
        continue;
      }

      projects.push({
        name: item.name,
        agency: item.agency || "Various",
        budget: parseFloat(item.budget) || 0,
        year: new Date().getFullYear(),
        status: "ongoing",
      });
    }

    logger.info(`Scraped ${projects.length} DBM projects`);
  } catch (error) {
    console.error("DBM scraping error:", error);
  } finally {
    if (page) {
      await page.close();
    }
  }

  return projects;
}

// ============================================
// COA Scraper
// ============================================

export async function scrapeCoaWebsite(): Promise<ScrapedCoaFinding[]> {
  const findings: ScrapedCoaFinding[] = [];
  let page: Page | null = null;

  try {
    page = await getPage();

    logger.info("Scraping COA data...");

    await page.goto("https://www.coa.gov.ph/index.php/reports/annual-audit-reports", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    await page.waitForSelector("table, article", { timeout: 10000 }).catch(() => null);

    const data = await page.evaluate(() => {
      const results: Array<{ agency: string; year: string; finding: string }> = [];
      const rows = document.querySelectorAll("table tr");

      rows.forEach((row, i) => {
        if (i === 0) {
          return;
        }
        const cells = row.querySelectorAll("td");
        if (cells.length < 2) {
          return;
        }

        results.push({
          agency: cells[0]?.textContent?.trim() || "",
          year: cells[1]?.textContent?.trim() || "",
          finding: cells[2]?.textContent?.trim() || "",
        });
      });

      return results;
    });

    for (const item of data) {
      if (!item.agency) {
        continue;
      }

      findings.push({
        agency: item.agency,
        year: parseInt(item.year) || new Date().getFullYear(),
        finding: item.finding || "Annual Audit Report",
        status: "reported",
      });
    }

    logger.info(`Scraped ${findings.length} COA findings`);
  } catch (error) {
    console.error("COA scraping error:", error);
  } finally {
    if (page) {
      await page.close();
    }
  }

  return findings;
}

// ============================================
// Court Scraper
// ============================================

export async function scrapeCourtWebsite(): Promise<ScrapedCourtCase[]> {
  const cases: ScrapedCourtCase[] = [];
  let page: Page | null = null;

  try {
    page = await getPage();

    logger.info("Scraping Supreme Court data...");

    await page.goto("https://elibrary.judiciary.gov.ph/", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    await page.waitForSelector("table", { timeout: 10000 }).catch(() => null);

    const data = await page.evaluate(() => {
      const results: Array<{ caseNumber: string; title: string; date: string; status: string }> =
        [];
      const rows = document.querySelectorAll("table tr");

      rows.forEach((row, i) => {
        if (i === 0) {
          return;
        }
        const cells = row.querySelectorAll("td");
        if (cells.length < 2) {
          return;
        }

        results.push({
          caseNumber: cells[0]?.textContent?.trim() || "",
          title: cells[1]?.textContent?.trim() || "",
          date: cells[2]?.textContent?.trim() || "",
          status: cells[3]?.textContent?.trim() || "",
        });
      });

      return results;
    });

    for (const item of data) {
      if (!item.caseNumber || !item.title) {
        continue;
      }

      let filingDate = new Date();
      if (item.date) {
        const parsed = new Date(item.date);
        if (!isNaN(parsed.getTime())) {
          filingDate = parsed;
        }
      }

      cases.push({
        caseNumber: item.caseNumber,
        title: item.title,
        court: "Supreme Court",
        filingDate,
        status: item.status || "decided",
      });
    }

    logger.info(`Scraped ${cases.length} court cases`);
  } catch (error) {
    console.error("Court scraping error:", error);
  } finally {
    if (page) {
      await page.close();
    }
  }

  return cases;
}

// ============================================
// Ombudsman Scraper
// ============================================

export async function scrapeOmbudsmanWebsite(): Promise<ScrapedOmbudsmanCase[]> {
  const cases: ScrapedOmbudsmanCase[] = [];
  let page: Page | null = null;

  try {
    page = await getPage();

    logger.info("Scraping Ombudsman data...");

    await page.goto("https://www.ombudsman.gov.ph/", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    await page.waitForSelector("table", { timeout: 10000 }).catch(() => null);

    const data = await page.evaluate(() => {
      const results: Array<{
        caseNumber: string;
        respondent: string;
        offense: string;
        status: string;
      }> = [];
      const rows = document.querySelectorAll("table tr");

      rows.forEach((row, i) => {
        if (i === 0) {
          return;
        }
        const cells = row.querySelectorAll("td");
        if (cells.length < 2) {
          return;
        }

        results.push({
          caseNumber: cells[0]?.textContent?.trim() || "",
          respondent: cells[1]?.textContent?.trim() || "",
          offense: cells[2]?.textContent?.trim() || "",
          status: cells[3]?.textContent?.trim() || "",
        });
      });

      return results;
    });

    for (const item of data) {
      if (!item.caseNumber || !item.respondent) {
        continue;
      }

      cases.push({
        caseNumber: item.caseNumber,
        respondent: item.respondent,
        offense: item.offense || "Administrative",
        filingDate: new Date(),
        status: item.status || "pending",
      });
    }

    logger.info(`Scraped ${cases.length} Ombudsman cases`);
  } catch (error) {
    console.error("Ombudsman scraping error:", error);
  } finally {
    if (page) {
      await page.close();
    }
  }

  return cases;
}

// ============================================
// Export
// ============================================

export const scrapers = {
  senate: scrapeSenateWebsite,
  house: scrapeHouseWebsite,
  comelec: scrapeComelecWebsite,
  dbm: scrapeDbmWebsite,
  coa: scrapeCoaWebsite,
  courts: scrapeCourtWebsite,
  ombudsman: scrapeOmbudsmanWebsite,
  politicians: scrapePoliticians,
};

// ============================================
// Politicians Scraper - Using BetterGov Open Congress API
// ============================================

/**
 * Known aliases/nicknames for Philippine politicians
 * Maps "firstname lastname" variations to help identify same person
 * Format: "alias_firstname" -> "canonical_lastname" (only for unique mappings)
 * For ambiguous nicknames (like "bong" which could be Go or Revilla), we rely on last name matching
 */
const KNOWN_ALIASES: Record<string, string> = {
  // Unique nickname -> last name mappings
  bato: "dela rosa",
  robinhood: "padilla",
  jinggoy: "estrada",
  ping: "lacson",
  koko: "pimentel",
  tito: "sotto",
  jv: "ejercito",
  bam: "aquino",
  chiz: "escudero",
  sonny: "angara",
  nancy: "binay",
  migz: "zubiri",
  win: "gatchalian",
  toby: "tiangco",
  manny: "pacquiao",
  gringo: "honasan",
  dick: "gordon",
  mar: "roxas",
  noynoy: "aquino",
  digong: "duterte",
  "inday sara": "duterte",
  bbm: "marcos",
  bongbong: "marcos",
  sandro: "marcos",
};

/**
 * Known name variations - maps variations of the same person
 * Key: normalized "firstname lastname", Value: canonical "firstname lastname"
 */
const NAME_VARIATIONS: Record<string, string> = {
  // Dela Rosa variations
  "ronald dela rosa": "ronald dela rosa",
  "bato dela rosa": "ronald dela rosa",
  "ronald bato dela rosa": "ronald dela rosa",

  // Padilla variations
  "robinhood padilla": "robin padilla",
  "robin padilla": "robin padilla",
  "robinhood c padilla": "robin padilla",

  // Estrada variations
  "jinggoy estrada": "jose ejercito estrada",
  "jose ejercito estrada": "jose ejercito estrada",
  "joseph ejercito estrada": "jose ejercito estrada",

  // Go variations
  "bong go": "christopher go",
  "christopher go": "christopher go",
  "christopher lawrence go": "christopher go",

  // Revilla variations
  "bong revilla": "ramon revilla",
  "ramon revilla": "ramon revilla",
  "ramon bong revilla": "ramon revilla",

  // Lacson variations
  "ping lacson": "panfilo lacson",
  "panfilo lacson": "panfilo lacson",

  // Sotto variations
  "tito sotto": "vicente sotto",
  "vicente sotto": "vicente sotto",

  // Pacquiao variations
  "manny pacquiao": "emmanuel pacquiao",
  "emmanuel pacquiao": "emmanuel pacquiao",

  // Marcos variations
  "bbm marcos": "ferdinand marcos",
  "bongbong marcos": "ferdinand marcos",
  "ferdinand marcos": "ferdinand marcos",
  "ferdinand romualdez marcos": "ferdinand marcos",
};

/**
 * Normalize a name for comparison (lowercase, remove extra spaces, handle common variations)
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,]/g, "")
    .replace(/\bjr\b\.?/gi, "")
    .replace(/\bsr\b\.?/gi, "")
    .replace(/\biii\b/gi, "")
    .replace(/\bii\b/gi, "")
    .replace(/\biv\b/gi, "")
    .trim();
}

/**
 * Extract last name from full name
 */
function extractLastName(fullName: string): string {
  const parts = normalizeName(fullName).split(" ");
  // Last name is typically the last part (unless it's a suffix)
  return parts[parts.length - 1] || "";
}

/**
 * Get canonical name if this is a known variation
 */
function getCanonicalName(fullName: string): string {
  const normalized = normalizeName(fullName);
  return NAME_VARIATIONS[normalized] || normalized;
}

/**
 * Check if two names likely refer to the same person
 */
function isSamePerson(name1: string, name2: string): boolean {
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);

  // Exact match after normalization
  if (norm1 === norm2) {
    return true;
  }

  // Check if both map to the same canonical name
  const canonical1 = getCanonicalName(name1);
  const canonical2 = getCanonicalName(name2);
  if (canonical1 === canonical2) {
    return true;
  }

  // Extract last names
  const lastName1 = extractLastName(name1);
  const lastName2 = extractLastName(name2);

  // If last names don't match, not the same person
  if (lastName1 !== lastName2) {
    return false;
  }

  // Check if either first name is a known alias for this last name
  const parts1 = norm1.split(" ");
  const parts2 = norm2.split(" ");
  const firstName1 = parts1[0] || "";
  const firstName2 = parts2[0] || "";

  // Check alias mapping
  const alias1Target = KNOWN_ALIASES[firstName1];
  const alias2Target = KNOWN_ALIASES[firstName2];

  // If both first names map to the same last name (or one is the alias of the other)
  if (alias1Target === lastName1 || alias2Target === lastName2) {
    return true;
  }

  // Check if one name contains the other (e.g., "Robin" vs "Robinhood")
  if (firstName1.length > 2 && firstName2.length > 2) {
    if (firstName1.includes(firstName2) || firstName2.includes(firstName1)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a name is already in the seen set (considering aliases)
 */
function isNameAlreadySeen(
  fullName: string,
  seenNames: Set<string>,
  seenLastNames: Map<string, string[]>
): boolean {
  const normalized = normalizeName(fullName);

  // Direct match
  if (seenNames.has(normalized)) {
    return true;
  }

  // Check against all names with the same last name
  const lastName = extractLastName(fullName);
  const namesWithSameLastName = seenLastNames.get(lastName) || [];

  for (const existingName of namesWithSameLastName) {
    if (isSamePerson(fullName, existingName)) {
      return true;
    }
  }

  return false;
}

/**
 * Add a name to the seen sets
 */
function markNameAsSeen(
  fullName: string,
  seenNames: Set<string>,
  seenLastNames: Map<string, string[]>
): void {
  const normalized = normalizeName(fullName);
  const lastName = extractLastName(fullName);

  seenNames.add(normalized);

  const existing = seenLastNames.get(lastName) || [];
  existing.push(fullName);
  seenLastNames.set(lastName, existing);
}

/**
 * Fetch all pages from people endpoint with pagination
 */
async function fetchAllPeoplePages(maxRecords: number = 2000): Promise<
  Array<{
    id: string;
    first_name: string;
    last_name: string;
    middle_name?: string;
    name_suffix?: string;
    aliases?: string[];
  }>
> {
  const allData: Array<{
    id: string;
    first_name: string;
    last_name: string;
    middle_name?: string;
    name_suffix?: string;
    aliases?: string[];
  }> = [];

  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore && allData.length < maxRecords) {
    const url = `https://open-congress-api.bettergov.ph/api/people?limit=${limit}&offset=${offset}`;
    logger.info(`Fetching people: offset=${offset}, total so far=${allData.length}`);

    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        console.error(`People API request failed: ${response.status}`);
        break;
      }

      const result = await response.json();

      if (!result.success || !result.data || result.data.length === 0) {
        hasMore = false;
        break;
      }

      allData.push(...result.data);

      // Check pagination
      hasMore = result.pagination?.has_more ?? false;
      offset += limit;

      // Small delay to be respectful to the API
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Error fetching people:`, error);
      break;
    }
  }

  return allData;
}

export async function scrapePoliticians(): Promise<ScrapedPolitician[]> {
  const politicians: ScrapedPolitician[] = [];
  const seenNames = new Set<string>();
  const seenLastNames = new Map<string, string[]>();

  try {
    logger.info("Fetching politicians from BetterGov Open Congress API /api/people endpoint...");

    // Fetch all people from the API
    const people = await fetchAllPeoplePages(2000);

    logger.info(`Fetched ${people.length} people from API`);

    for (const person of people) {
      const fullName =
        `${person.first_name || ""} ${person.middle_name || ""} ${person.last_name || ""}`
          .trim()
          .replace(/\s+/g, " ");

      // Use improved deduplication that handles aliases
      if (isNameAlreadySeen(fullName, seenNames, seenLastNames)) {
        logger.info(`Skipping duplicate (alias): ${fullName}`);
        continue;
      }
      markNameAsSeen(fullName, seenNames, seenLastNames);

      politicians.push({
        fullName,
        firstName: person.first_name || "",
        middleName: person.middle_name || undefined,
        lastName: person.last_name || "",
        suffix: person.name_suffix || undefined,
        position: "Legislator", // Will be determined by position data
        chamber: "house", // Default, will be updated based on actual data
        isActive: true,
      });
    }

    logger.info(`Scraped ${politicians.length} unique politicians from BetterGov API`);
  } catch (error) {
    console.error("Politicians scrape error:", error);

    // Fallback to known current senators (19th Congress) - use canonical names
    return [
      {
        fullName: "Juan Miguel Zubiri",
        firstName: "Juan Miguel",
        lastName: "Zubiri",
        position: "Senator",
        chamber: "senate",
        isActive: true,
      },
      {
        fullName: "Loren Legarda",
        firstName: "Loren",
        lastName: "Legarda",
        position: "Senator",
        chamber: "senate",
        isActive: true,
      },
      {
        fullName: "Cynthia Villar",
        firstName: "Cynthia",
        lastName: "Villar",
        position: "Senator",
        chamber: "senate",
        isActive: true,
      },
      {
        fullName: "Grace Poe",
        firstName: "Grace",
        lastName: "Poe",
        position: "Senator",
        chamber: "senate",
        isActive: true,
      },
      {
        fullName: "Christopher Go",
        firstName: "Christopher",
        lastName: "Go",
        position: "Senator",
        chamber: "senate",
        isActive: true,
      },
      {
        fullName: "Robin Padilla",
        firstName: "Robin",
        lastName: "Padilla",
        position: "Senator",
        chamber: "senate",
        isActive: true,
      },
      {
        fullName: "Risa Hontiveros",
        firstName: "Risa",
        lastName: "Hontiveros",
        position: "Senator",
        chamber: "senate",
        isActive: true,
      },
      {
        fullName: "Imee Marcos",
        firstName: "Imee",
        lastName: "Marcos",
        position: "Senator",
        chamber: "senate",
        isActive: true,
      },
      {
        fullName: "Ronald Dela Rosa",
        firstName: "Ronald",
        lastName: "Dela Rosa",
        position: "Senator",
        chamber: "senate",
        isActive: true,
      },
      {
        fullName: "Jose Ejercito Estrada",
        firstName: "Jose Ejercito",
        lastName: "Estrada",
        position: "Senator",
        chamber: "senate",
        isActive: true,
      },
    ];
  }

  return politicians;
}
