import { publicCaseReadsEnabled } from "./public-research.service";
/**
 * Export Service
 *
 * PDF generation and sharing capabilities for politician profiles,
 * comparisons, and voting lists.
 * Requirements: 42.1, 42.2, 42.3, 42.4, 42.5, 42.6
 */

import type { FilingRefresh } from "@/lib/senate-refresh";
import { answerFromSenateFilings } from "./senate-chat.service";
import type { ReleasedProfileContext } from "@/lib/release-data";
import { getPolitician, PoliticianProfile } from "./politician.service";
import { getSALNHistory } from "./saln.service";
import { getElectionHistory } from "./election.service";
import { getRedFlags } from "./red-flag.service";
import { comparePoliticians, ComparisonResult } from "./comparison.service";
import { getVotingListByLevel, VotingListByLevel } from "./user-list.service";

// ============================================
// Types and Interfaces
// ============================================

/**
 * Export options
 * Validates: Requirement 42.4, 42.5
 */
export interface ExportOptions {
  format: "pdf" | "html";
  includeSourceAttribution?: boolean;
  optimizeForPrint?: boolean;
}

/**
 * Export result
 */
export interface ExportResult {
  content: string;
  contentType: string;
  filename: string;
  exportedAt: Date;
  dataSourceAttribution: string;
}

/**
 * Profile export data
 */
export interface ProfileExportData {
  politician: PoliticianProfile;
  salnRecords: Awaited<ReturnType<typeof getSALNHistory>>;
  electionHistory: Awaited<ReturnType<typeof getElectionHistory>>;
  redFlags: Awaited<ReturnType<typeof getRedFlags>>;
  exportedAt: Date;
}

/**
 * Comparison export data
 */
export interface ComparisonExportData {
  comparison: ComparisonResult;
  exportedAt: Date;
}

/**
 * Voting list export data
 */
export interface VotingListExportData {
  byLevel: VotingListByLevel;
  electionYear: number;
  exportedAt: Date;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date for display
 */
function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format percentage
 */
function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m] || m);
}

function getObservedMembership(context: ReleasedProfileContext): string {
  const observation = `${escapeHtml(context.office)} in Congress ${context.congress} on <a href="${escapeHtml(context.sourceUrl)}">${escapeHtml(context.observedOn)}</a>`;
  if (!context.refresh) {
    return observation;
  }
  const refresh = context.refresh;
  const citations = refresh.sources
    .map(
      (source) =>
        `<a href="${escapeHtml(source.accessUrl ?? source.url)}">${escapeHtml(source.publisher)}: ${escapeHtml(source.locator)}</a>. Source date: ${escapeHtml(source.documentDate ?? "Not established")}. Retrieved: ${escapeHtml(source.retrievedOn ?? "Not recorded")}. Evidence reviewed: ${escapeHtml(source.reviewedOn ?? "Not recorded")}. Access method: ${escapeHtml(source.accessMethod.charAt(0).toLowerCase() + source.accessMethod.slice(1))} ${escapeHtml(source.independence)}`
    )
    .join("<br>");
  const offices = refresh.officeObservations
    .map(
      (item) => `${escapeHtml(item.office)}, ${escapeHtml(item.asOf)}. ${escapeHtml(item.scope)}`
    )
    .join("<br>");
  return `${observation}<br>Elected term begins: ${escapeHtml(refresh.electedTerm.start)}.<br>Scheduled term end: ${escapeHtml(refresh.electedTerm.scheduledEnd)}.<br>These dates do not establish continuous service or current office.<br>${refresh.membershipObservations.map((item) => `Separate membership observation: ${escapeHtml(item.observedOn)}.`).join("<br>")}<br>${offices}<br>${citations}`;
}

function getFilingHistoryHtml(reference: string, refresh: FilingRefresh | undefined): string {
  if (!refresh) {
    return "";
  }
  const events = [...refresh.events]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((event) => {
      const sources = event.sourceIds
        .map((id) => {
          const source = refresh.sources.find((item) => item.id === id)!;
          return `<a href="${escapeHtml(source.accessUrl ?? source.url)}">${escapeHtml(source.publisher)}: ${escapeHtml(source.locator)}</a>. Source date: ${escapeHtml(source.documentDate ?? "Not established")}. Retrieved: ${escapeHtml(source.retrievedOn ?? "Not recorded")}. Evidence reviewed: ${escapeHtml(source.reviewedOn ?? "Not recorded")}. Access method: ${escapeHtml(source.accessMethod.charAt(0).toLowerCase() + source.accessMethod.slice(1))} ${escapeHtml(source.independence)} ${escapeHtml(source.dateMeaning ?? "")}`;
        })
        .join("; ");
      return `<li>${escapeHtml(event.date)}: ${escapeHtml(event.label)}<br>${sources}</li>`;
    })
    .join("");
  const successor = refresh.successor;
  const relationship = successor
    ? `<p>${escapeHtml(reference)} to ${escapeHtml(successor.successorReference)}, a separate successor measure. ${successor.successorEnactment ? `Successor approval: ${escapeHtml(successor.successorEnactment.republicAct)} on ${escapeHtml(successor.successorEnactment.approvedOn)}.` : ""}</p>`
    : "";
  return `<section class="section"><h2>Dated bill history: ${escapeHtml(reference)}</h2><p>These are dated records, agendas and successor events, not a current-status certification. Original bill enactment remains unverified.</p>${relationship}<ol>${events}</ol></section>`;
}

// ============================================
// HTML Template Generation
// ============================================

/**
 * Generate common CSS styles for exports
 * Validates: Requirement 42.5 (optimized for printing)
 */
function getExportStyles(optimizeForPrint: boolean = true): string {
  return `
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-size: 12pt;
        line-height: 1.5;
        color: #1a1a1a;
        background: white;
        ${optimizeForPrint ? "max-width: 800px; margin: 0 auto; padding: 20px;" : ""}
      }
      .header {
        text-align: center;
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 2px solid #0066cc;
      }
      .header h1 {
        font-size: 24pt;
        color: #0066cc;
        margin-bottom: 8px;
      }
      .header .subtitle {
        font-size: 10pt;
        color: #666;
      }
      .section {
        margin-bottom: 24px;
        page-break-inside: avoid;
      }
      .section-title {
        font-size: 14pt;
        font-weight: bold;
        color: #0066cc;
        margin-bottom: 12px;
        padding-bottom: 4px;
        border-bottom: 1px solid #ddd;
      }
      .info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px 24px;
      }
      .info-item {
        display: flex;
        gap: 8px;
      }
      .info-label {
        font-weight: 600;
        color: #444;
        min-width: 120px;
      }
      .info-value {
        color: #1a1a1a;
      }
      .badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 10pt;
        font-weight: 500;
      }
      .badge-warning {
        background: #fff3cd;
        color: #856404;
      }
      .badge-error {
        background: #f8d7da;
        color: #721c24;
      }
      .badge-info {
        background: #d1ecf1;
        color: #0c5460;
      }
      .badge-success {
        background: #d4edda;
        color: #155724;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 8px;
      }
      th, td {
        padding: 8px 12px;
        text-align: left;
        border-bottom: 1px solid #ddd;
      }
      th {
        background: #f5f5f5;
        font-weight: 600;
        color: #444;
      }
      .highlight-high {
        background: #d4edda;
      }
      .highlight-low {
        background: #f8d7da;
      }
      .footer {
        margin-top: 32px;
        padding-top: 16px;
        border-top: 1px solid #ddd;
        font-size: 9pt;
        color: #666;
        text-align: center;
      }
      .red-flag {
        padding: 8px 12px;
        margin-bottom: 8px;
        border-left: 4px solid;
        background: #f8f9fa;
      }
      .red-flag.critical {
        border-color: #dc3545;
      }
      .red-flag.warning {
        border-color: #ffc107;
      }
      .red-flag.info {
        border-color: #17a2b8;
      }
      @media print {
        body {
          padding: 0;
        }
        .section {
          page-break-inside: avoid;
        }
      }
    </style>
  `;
}

/**
 * Generate footer with attribution
 * Validates: Requirement 42.4
 */
function getExportFooter(exportedAt: Date): string {
  return `
    <div class="footer">
      <p><strong>Bakit Kita Iboboto?</strong> - Philippine Political Transparency Platform</p>
      <p>Exported on ${formatDate(exportedAt)}</p>
      <p>Data sourced from official Philippine government records including Senate, House of Representatives, COMELEC, DBM, and COA.</p>
      <p>https://bakitkitaiboboto.ph</p>
    </div>
  `;
}

// ============================================
// Profile Export
// ============================================

/**
 * Generate HTML export for politician profile
 * Validates: Requirements 42.1, 42.4, 42.5
 */
export async function generateProfileExport(
  politicianId: string,
  options: ExportOptions = {
    format: "html",
    includeSourceAttribution: true,
    optimizeForPrint: true,
  }
): Promise<ExportResult> {
  // Fetch all profile data
  const [politician, salnRecords, electionHistory, redFlags] = await Promise.all([
    getPolitician(politicianId),
    getSALNHistory(politicianId),
    getElectionHistory(politicianId),
    getRedFlags(politicianId),
  ]);

  if (!politician) {
    throw new Error("Politician not found");
  }

  const exportedAt = new Date();
  const { reviewedBatch } = politician;
  const positionLabel = reviewedBatch
    ? getObservedMembership(reviewedBatch)
    : escapeHtml(politician.currentPosition?.title ?? "Former Official");
  const status = reviewedBatch
    ? "Current office unknown"
    : politician.isActive
      ? "Active"
      : "Former Official";

  // Generate HTML content
  let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(politician.fullName)} - Profile Export</title>
      ${getExportStyles(options.optimizeForPrint)}
    </head>
    <body>
      <div class="header">
        <h1>${escapeHtml(politician.fullName)}</h1>
        <p class="subtitle">
          ${positionLabel}
          ${politician.currentParty ? ` • ${escapeHtml(politician.currentParty.party.name)}` : ""}
        </p>
      </div>
  `;

  // Personal Information Section
  html += `
      <div class="section">
        <h2 class="section-title">Personal Information</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Full Name:</span>
            <span class="info-value">${escapeHtml(politician.fullName)}</span>
          </div>
          ${
            politician.birthday
              ? `
          <div class="info-item">
            <span class="info-label">Birthday:</span>
            <span class="info-value">${formatDate(politician.birthday)}</span>
          </div>
          `
              : ""
          }
          ${
            politician.birthplace
              ? `
          <div class="info-item">
            <span class="info-label">Birthplace:</span>
            <span class="info-value">${escapeHtml(politician.birthplace)}</span>
          </div>
          `
              : ""
          }
          <div class="info-item">
            <span class="info-label">Status:</span>
            <span class="info-value">${status}</span>
          </div>
        </div>
      </div>
  `;

  if (reviewedBatch) {
    html += `
      <div class="section">
        <h2 class="section-title">Reviewed coverage</h2>
        <p>Selected filings in this batch: ${reviewedBatch.selectedFilingCount}.</p>
        <ul>${reviewedBatch.limitations.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>
      </div>
    `;
  }

  if (reviewedBatch) {
    const answer = await answerFromSenateFilings({ message: "Show filings", politicianId });
    if (answer.senate?.status === "records") {
      html += answer.senate.filings
        .map((filing) => getFilingHistoryHtml(filing.reference, filing.refresh))
        .join("");
    } else {
      html +=
        "<p>Reviewed filing records are unavailable or need review. This does not establish that the person filed nothing.</p>";
    }
  }

  // Position History Section
  if (politician.positions.length > 0) {
    html += `
      <div class="section">
        <h2 class="section-title">Position History</h2>
        <table>
          <thead>
            <tr>
              <th>Position</th>
              <th>Jurisdiction</th>
              <th>Period</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
    `;
    for (const position of politician.positions) {
      const endDate = position.endDate ? formatDate(position.endDate) : "Present";
      html += `
            <tr>
              <td>${escapeHtml(position.title)}</td>
              <td>${escapeHtml(position.jurisdiction)}</td>
              <td>${formatDate(position.startDate)} - ${endDate}</td>
              <td>${position.isCurrent ? '<span class="badge badge-success">Current</span>' : '<span class="badge badge-info">Past</span>'}</td>
            </tr>
      `;
    }
    html += `
          </tbody>
        </table>
      </div>
    `;
  }

  if (!reviewedBatch) {
    html += `<p>Indicators currently shown: ${redFlags.length}.${publicCaseReadsEnabled() ? "" : " Research is being reviewed."} Case details require an online review check.</p>`;
  }

  // Red Flags Section
  if (redFlags.length > 0) {
    html += `
      <div class="section">
        <h2 class="section-title">Red Flags & Indicators</h2>
    `;
    for (const flag of redFlags) {
      const severityClass =
        flag.severity === "critical"
          ? "critical"
          : flag.severity === "warning"
            ? "warning"
            : "info";
      html += `
        <div class="red-flag ${severityClass}">
          <strong>${escapeHtml(flag.title)}</strong>
          <p>${escapeHtml(flag.description)}</p>
        </div>
      `;
    }
    html += `</div>`;
  }

  // SALN Section
  if (salnRecords.length > 0) {
    html += `
      <div class="section">
        <h2 class="section-title">Statement of Assets, Liabilities, and Net Worth (SALN)</h2>
        <table>
          <thead>
            <tr>
              <th>Year</th>
              <th>Total Assets</th>
              <th>Total Liabilities</th>
              <th>Net Worth</th>
              <th>Anomaly</th>
            </tr>
          </thead>
          <tbody>
    `;
    for (const saln of salnRecords) {
      html += `
            <tr>
              <td>${saln.year}</td>
              <td>${formatCurrency(saln.totalAssets)}</td>
              <td>${formatCurrency(saln.totalLiabilities)}</td>
              <td>${formatCurrency(saln.netWorth)}</td>
              <td>${saln.anomalyDetected ? '<span class="badge badge-warning">Detected</span>' : '<span class="badge badge-success">None</span>'}</td>
            </tr>
      `;
    }
    html += `
          </tbody>
        </table>
      </div>
    `;
  }

  // Election History Section
  if (electionHistory.length > 0) {
    html += `
      <div class="section">
        <h2 class="section-title">Election History</h2>
        <table>
          <thead>
            <tr>
              <th>Year</th>
              <th>Position</th>
              <th>Result</th>
              <th>Votes</th>
              <th>Percentage</th>
            </tr>
          </thead>
          <tbody>
    `;
    for (const election of electionHistory) {
      const resultClass = election.result === "won" ? "badge-success" : "badge-error";
      html += `
            <tr>
              <td>${election.electionYear}</td>
              <td>${escapeHtml(election.positionSought)}</td>
              <td><span class="badge ${resultClass}">${election.result.toUpperCase()}</span></td>
              <td>${election.voteCount.toLocaleString()}</td>
              <td>${formatPercentage(election.votePercentage)}</td>
            </tr>
      `;
    }
    html += `
          </tbody>
        </table>
      </div>
    `;
  }

  // Footer
  html += getExportFooter(exportedAt);
  html += `
    </body>
    </html>
  `;

  return {
    content: html,
    contentType: "text/html; charset=utf-8",
    filename: `${politician.fullName.replace(/\s+/g, "-").toLowerCase()}-profile.html`,
    exportedAt,
    dataSourceAttribution: "Data sourced from official Philippine government records",
  };
}

// ============================================
// Comparison Export
// ============================================

/**
 * Generate HTML export for politician comparison
 * Validates: Requirements 42.2, 42.4, 42.5
 */
export async function generateComparisonExport(
  politicianIds: string[],
  options: ExportOptions = {
    format: "html",
    includeSourceAttribution: true,
    optimizeForPrint: true,
  }
): Promise<ExportResult> {
  const comparison = await comparePoliticians(politicianIds);
  const exportedAt = new Date();

  // Generate HTML content
  let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Politician Comparison - Export</title>
      ${getExportStyles(options.optimizeForPrint)}
    </head>
    <body>
      <div class="header">
        <h1>Politician Comparison</h1>
        <p class="subtitle">
          Comparing ${comparison.politicians.map((p) => escapeHtml(p.fullName)).join(" vs ")}
        </p>
      </div>
  `;

  // Politicians Overview
  html += `
      <div class="section">
        <h2 class="section-title">Politicians Overview</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Current Position</th>
              <th>Party</th>
            </tr>
          </thead>
          <tbody>
  `;
  for (const politician of comparison.politicians) {
    const { reviewedBatch } = politician;
    const positionLabel = reviewedBatch
      ? `Current office unknown.<br>${getObservedMembership(reviewedBatch)}.<br>Selected filings: ${reviewedBatch.selectedFilingCount}.`
      : escapeHtml(politician.currentPosition?.title ?? "N/A");
    const partyLabel = escapeHtml(
      politician.currentParty?.name ?? (reviewedBatch ? "Unknown" : "Independent")
    );
    html += `
            <tr>
              <td><strong>${escapeHtml(politician.fullName)}</strong></td>
              <td>${positionLabel}</td>
              <td>${partyLabel}</td>
            </tr>
    `;
  }
  html += `
          </tbody>
        </table>
      </div>
  `;

  for (const [profileId, entry] of Object.entries(comparison.reviewedFilings ?? {})) {
    const name =
      comparison.politicians.find((person) => person.id === profileId)?.fullName ?? profileId;
    html += `<h2>Reviewed history for ${escapeHtml(name)}</h2>`;
    if (entry.status === "records") {
      html += entry.filings
        .map((filing) => getFilingHistoryHtml(filing.reference, filing.refresh))
        .join("");
    } else {
      html +=
        "<p>Reviewed filing records are unavailable or need review. This does not establish that the person filed nothing.</p>";
    }
  }

  // Group metrics by category
  const categories = ["legislative", "financial", "attendance", "promises", "experience"] as const;
  const categoryLabels: Record<string, string> = {
    legislative: "Legislative Record",
    financial: "Financial",
    attendance: "Attendance",
    promises: "Campaign Promises",
    experience: "Experience",
  };

  for (const category of categories) {
    const categoryMetrics = comparison.metrics.filter((m) => m.category === category);
    if (categoryMetrics.length === 0) {
      continue;
    }

    html += `
      <div class="section">
        <h2 class="section-title">${categoryLabels[category]}</h2>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
    `;
    for (const politician of comparison.politicians) {
      html += `<th>${escapeHtml(politician.fullName)}</th>`;
    }
    html += `
            </tr>
          </thead>
          <tbody>
    `;

    for (const metric of categoryMetrics) {
      const diff = comparison.differences.find((d) => d.metricName === metric.name);
      html += `<tr><td><strong>${escapeHtml(metric.name)}</strong></td>`;

      for (const politician of comparison.politicians) {
        const value = metric.values[politician.id];
        const isHighest = diff?.highestPoliticianId === politician.id;
        const isLowest = diff?.lowestPoliticianId === politician.id;
        const highlightClass = metric.higherIsBetter
          ? isHighest
            ? "highlight-high"
            : isLowest
              ? "highlight-low"
              : ""
          : "";

        let displayValue = politician.reviewedBatch ? "Unknown" : "N/A";
        if (value !== null && value !== undefined) {
          if (metric.unit === "PHP" && typeof value === "number") {
            displayValue = formatCurrency(value);
          } else if (metric.unit === "%" && typeof value === "number") {
            displayValue = formatPercentage(value);
          } else if (metric.unit === "years" && typeof value === "number") {
            displayValue = `${value} ${value === 1 ? "year" : "years"}`;
          } else {
            displayValue = String(value);
          }
        }

        html += `<td class="${highlightClass}">${displayValue}</td>`;
      }
      html += `</tr>`;
    }

    html += `
          </tbody>
        </table>
      </div>
    `;
  }

  // Footer
  html += getExportFooter(exportedAt);
  html += `
    </body>
    </html>
  `;

  const politicianNames = comparison.politicians.map((p) => p.fullName.split(" ")[0]).join("-vs-");

  return {
    content: html,
    contentType: "text/html; charset=utf-8",
    filename: `comparison-${politicianNames.toLowerCase()}.html`,
    exportedAt,
    dataSourceAttribution: "Data sourced from official Philippine government records",
  };
}

// ============================================
// Voting List Export (PDF-style HTML)
// ============================================

/**
 * Generate HTML export for voting list
 * Validates: Requirements 42.3, 42.4, 42.5
 */
export async function generateVotingListExport(
  userId: string,
  electionYear: number,
  options: ExportOptions = {
    format: "html",
    includeSourceAttribution: true,
    optimizeForPrint: true,
  }
): Promise<ExportResult> {
  const byLevel = await getVotingListByLevel(userId, electionYear);
  const exportedAt = new Date();

  const levelLabels: Record<string, string> = {
    national: "National",
    regional: "Regional",
    provincial: "Provincial",
    city: "City/Municipal",
    municipal: "Municipal",
    barangay: "Barangay",
  };

  const levelOrder = ["national", "regional", "provincial", "city", "municipal", "barangay"];

  // Count total
  let totalCount = 0;
  for (const items of Object.values(byLevel)) {
    totalCount += items.length;
  }

  // Generate HTML content
  let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>My Voting List - ${electionYear} Elections</title>
      ${getExportStyles(options.optimizeForPrint)}
      <style>
        .voting-item {
          display: flex;
          align-items: center;
          padding: 12px;
          margin-bottom: 8px;
          background: #f8f9fa;
          border-radius: 8px;
          border-left: 4px solid #0066cc;
        }
        .voting-item-position {
          font-weight: 600;
          color: #444;
          min-width: 150px;
        }
        .voting-item-name {
          flex: 1;
          font-size: 14pt;
        }
        .level-section {
          margin-bottom: 24px;
        }
        .level-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }
        .level-count {
          background: #0066cc;
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 10pt;
        }
        .summary-box {
          background: #e7f3ff;
          border: 1px solid #0066cc;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 24px;
          text-align: center;
        }
        .summary-count {
          font-size: 36pt;
          font-weight: bold;
          color: #0066cc;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Aking Voting List</h1>
        <p class="subtitle">${electionYear} Elections</p>
      </div>

      <div class="summary-box">
        <div class="summary-count">${totalCount}</div>
        <p>Kandidato sa iyong voting list</p>
      </div>
  `;

  // Generate sections by level
  for (const level of levelOrder) {
    const items = byLevel[level as keyof VotingListByLevel];
    if (!items || items.length === 0) {
      continue;
    }

    html += `
      <div class="level-section">
        <div class="level-header">
          <h2 class="section-title" style="margin-bottom: 0; border-bottom: none;">${levelLabels[level]}</h2>
          <span class="level-count">${items.length}</span>
        </div>
    `;

    for (const item of items) {
      const name = item.politician?.fullName || "Unknown";
      html += `
        <div class="voting-item">
          <span class="voting-item-position">${escapeHtml(item.position)}</span>
          <span class="voting-item-name">${escapeHtml(name)}</span>
        </div>
      `;
    }

    html += `</div>`;
  }

  // Empty state
  if (totalCount === 0) {
    html += `
      <div class="section" style="text-align: center; padding: 40px;">
        <p style="color: #666;">Walang laman ang voting list mo para sa ${electionYear} elections.</p>
        <p style="color: #666;">Magdagdag ng mga kandidato sa bakitkitaiboboto.ph</p>
      </div>
    `;
  }

  // Footer
  html += getExportFooter(exportedAt);
  html += `
    </body>
    </html>
  `;

  return {
    content: html,
    contentType: "text/html; charset=utf-8",
    filename: `voting-list-${electionYear}.html`,
    exportedAt,
    dataSourceAttribution: "Data sourced from official Philippine government records",
  };
}

// ============================================
// Social Sharing Utilities
// ============================================

/**
 * Social sharing platform types
 */
export type SocialPlatform = "facebook" | "twitter" | "linkedin" | "copy";

/**
 * Generate share URL for different platforms
 * Validates: Requirement 42.6
 */
export function generateShareUrl(
  platform: SocialPlatform,
  url: string,
  title: string,
  description?: string
): string {
  const encodedUrl = encodeURIComponent(url);

  switch (platform) {
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    case "twitter": {
      const tweetText = description ? `${title} - ${description}` : title;
      return `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodeURIComponent(tweetText)}`;
    }
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    case "copy":
      return url;
    default:
      return url;
  }
}

/**
 * Generate share text for different contexts
 */
export function generateShareText(
  type: "profile" | "comparison" | "voting-list",
  data: {
    politicianName?: string;
    politicianNames?: string[];
    electionYear?: number;
    count?: number;
  }
): { title: string; description: string } {
  switch (type) {
    case "profile":
      return {
        title: `${data.politicianName} - Politician Profile`,
        description: `View the complete profile of ${data.politicianName} on Bakit Kita Iboboto? - Philippine Political Transparency Platform`,
      };
    case "comparison":
      const names = data.politicianNames?.join(" vs ") || "Politicians";
      return {
        title: `Politician Comparison: ${names}`,
        description: `Compare ${names} side-by-side on Bakit Kita Iboboto? - Philippine Political Transparency Platform`,
      };
    case "voting-list":
      return {
        title: `My Voting List for ${data.electionYear} Elections`,
        description: `I've selected ${data.count} candidates for the ${data.electionYear} elections. Check out my voting list on Bakit Kita Iboboto?`,
      };
    default:
      return {
        title: "Bakit Kita Iboboto?",
        description: "Philippine Political Transparency Platform",
      };
  }
}
