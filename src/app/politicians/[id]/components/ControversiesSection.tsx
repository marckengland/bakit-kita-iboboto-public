"use client";
import { useOnlineReview } from "@/hooks/useOnlineReview";
import { useState, useEffect } from "react";
import type {
  ConflictDetectionResult,
  ConflictOfInterest,
} from "@/services/conflict-of-interest.service";
import type { PublicResearchEnvelope, PublicResearchRecord, PublicSource } from "@/lib/case-review";
import { researchMessage, eventDateLabel } from "@/lib/case-review-display";
import { SourcesAccordion } from "./SourcesAccordion";
import { useTranslations } from "next-intl";
interface ControversiesSectionProps {
  politicianId: string;
  initialResearch: PublicResearchEnvelope;
  initialConflicts?: ConflictDetectionResult | null;
  showConflicts?: boolean;
}
export function ControversiesSection({
  politicianId,
  initialResearch,
  initialConflicts = null,
  showConflicts = true,
}: ControversiesSectionProps) {
  const onlineReview = useOnlineReview();
  const [research, setResearch] = useState(initialResearch);
  const [conflicts, setConflicts] = useState(initialConflicts);
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch(`/api/politicians/${politicianId}/controversies`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data: PublicResearchEnvelope = await response.json();
        if (!controller.signal.aborted) {
          setResearch(
            data.schemaVersion === 2 &&
              ["available", "withheld", "unavailable"].includes(data.availability)
              ? data
              : { schemaVersion: 2, availability: "unavailable", records: [], totals: null }
          );
        }
      } catch {
        if (!controller.signal.aborted) {
          setResearch({ schemaVersion: 2, availability: "unavailable", records: [], totals: null });
        }
      }
      if (showConflicts && !initialConflicts) {
        try {
          const response = await fetch(`/api/politicians/${politicianId}/conflicts`, {
            signal: controller.signal,
          });
          if (response.ok && !controller.signal.aborted) {
            setConflicts(await response.json());
          }
        } catch (error) {
          if (!controller.signal.aborted) {
            console.error("Failed to fetch conflict findings:", error);
          }
        }
      }
    }
    refresh();
    return () => controller.abort();
  }, [politicianId, initialConflicts, showConflicts]);
  if (!onlineReview) {
    return (
      <p className="card" role="status">
        Case details require an online review check. Reload this page when connected.
      </p>
    );
  }
  return (
    <div className="card space-y-6" id="reviewed-research">
      <h2 className="text-xl font-semibold">Cases</h2>
      {research.availability !== "available" || research.records.length === 0 ? (
        <p role="status">{researchMessage(research.availability)}</p>
      ) : (
        <>
          <div className="space-y-4">
            {research.records
              .filter((r) => r.section === "case")
              .map((r) => (
                <ResearchItem key={r.id} record={r} />
              ))}
          </div>
          <h2 className="text-xl font-semibold">Context and fact checks</h2>
          <div className="space-y-4">
            {research.records
              .filter((r) => r.section === "context")
              .map((r) => (
                <ResearchItem key={r.id} record={r} />
              ))}
          </div>
        </>
      )}
      {showConflicts && conflicts && (
        <section>
          <h2 className="text-xl font-semibold">Conflicts of interest</h2>
          <ConflictOfInterestSection conflicts={conflicts} />
        </section>
      )}
    </div>
  );
}
function reviewSources(sources: PublicSource[]) {
  return sources.map((s) => ({
    ...s,
    documentDate: s.documentDate ? new Date(s.documentDate) : undefined,
    retrievedAt: new Date(s.retrievedAt),
  }));
}
function ResearchItem({ record }: { record: PublicResearchRecord }) {
  return (
    <details className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <summary className="cursor-pointer">
        <span className="font-semibold">{record.title}</span>
        <span className="block text-sm">
          {record.section === "case" ? record.outcome.label : record.contextLabel}
        </span>
        {record.section === "case" &&
          record.relief.map((r) => (
            <span key={r.eventId} className="block text-sm">
              {r.label}
            </span>
          ))}
      </summary>
      <p className="my-3">{record.description}</p>
      {record.events.length > 0 && (
        <>
          <p className="text-sm text-neutral-500">
            Events are listed by record ID. Partial or unknown dates do not establish their order.
          </p>
          <ul className="my-3 space-y-3">
            {record.events.map((event) => (
              <li key={event.id}>
                <p>
                  {eventDateLabel(event.date)}: {event.summary}
                </p>
                <p className="text-sm">
                  {[event.jurisdiction, event.court, event.caseNumber].filter(Boolean).join(" · ")}
                </p>
                <p className="text-sm">
                  {event.evidenceBasis === "attributed_reporting"
                    ? "Reported by the cited source"
                    : "Primary document"}
                  ; finality: {event.finality.replaceAll("_", " ")}
                </p>
                <SourcesAccordion sources={reviewSources(event.sources)} label="Sources" />
              </li>
            ))}
          </ul>
        </>
      )}
      <SourcesAccordion sources={reviewSources(record.sources)} label="Sources" />
    </details>
  );
}
interface ConflictOfInterestSectionProps {
  conflicts: ConflictDetectionResult | null;
}

/**
 * Conflict of Interest Section
 * Requirements: 29.1, 29.2, 29.3
 */
function ConflictOfInterestSection({ conflicts }: ConflictOfInterestSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const t = useTranslations("dataStates");

  if (!conflicts) {
    return <p role="status">{t("unavailable")}</p>;
  }
  if (
    !conflicts.businessInterests.length ||
    conflicts.billsAnalyzed + conflicts.committeesAnalyzed === 0
  ) {
    return (
      <div className="rounded-lg bg-neutral-50 p-6 dark:bg-neutral-800">
        <p className="font-medium">{t("conflictsInsufficient")}</p>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t("conflictsHint")}</p>
      </div>
    );
  }

  if (!conflicts.hasConflicts) {
    return (
      <div className="rounded-lg bg-neutral-50 p-6 text-center dark:bg-neutral-800">
        <svg
          className="mx-auto h-10 w-10 text-neutral-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 8h.01M11 12h1v4m9-4a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="mt-3 font-medium text-neutral-900 dark:text-white">
          {t("conflictsNoMatches")}
        </p>
        <p className="mt-1 text-sm text-neutral-500">{t("conflictsLimited")}</p>
        <p className="mt-2 text-sm text-neutral-500">
          {conflicts.billsAnalyzed} bills; {conflicts.committeesAnalyzed} committee assignments.
        </p>
      </div>
    );
  }

  // Group conflicts by type
  const billConflicts = conflicts.conflicts.filter((c) => c.type === "bill_authorship");
  const committeeConflicts = conflicts.conflicts.filter((c) => c.type === "committee_assignment");

  return (
    <div className="space-y-6">
      {/* Business Interests Summary - Requirement 29.2 */}
      {conflicts.businessInterests.length > 0 && (
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
          <h3 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">
            Declared Business Interests (from SALN)
          </h3>
          <div className="flex flex-wrap gap-2">
            {conflicts.businessInterests.map((interest) => (
              <span
                key={interest.id}
                className="badge bg-neutral-100 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300"
              >
                {interest.industry}: {interest.description.substring(0, 30)}
                {interest.description.length > 30 ? "..." : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Bill Conflicts - Requirements 29.1, 29.2 */}
      {billConflicts.length > 0 && (
        <div className="border-warning-200 dark:border-warning-800 rounded-lg border">
          <div className="bg-warning-50 dark:bg-warning-900/20 flex items-center gap-3 p-4">
            <div className="bg-warning-100 dark:bg-warning-900 rounded-full p-2">
              <svg
                className="text-warning-600 dark:text-warning-400 h-4 w-4"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path
                  fillRule="evenodd"
                  d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-neutral-900 dark:text-white">
                Business Interests vs Bills Authored
              </h3>
              <p className="text-sm text-neutral-500">
                {billConflicts.length} potential conflict{billConflicts.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {billConflicts.map((conflict) => (
              <ConflictItem
                key={conflict.id}
                conflict={conflict}
                isExpanded={expandedId === conflict.id}
                onToggle={() => setExpandedId(expandedId === conflict.id ? null : conflict.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Committee Conflicts - Requirement 29.3 */}
      {committeeConflicts.length > 0 && (
        <div className="border-primary-200 dark:border-primary-800 rounded-lg border">
          <div className="bg-primary-50 dark:bg-primary-900/20 flex items-center gap-3 p-4">
            <div className="bg-primary-100 dark:bg-primary-900 rounded-full p-2">
              <svg
                className="text-primary-600 dark:text-primary-400 h-4 w-4"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-neutral-900 dark:text-white">
                Committee Assignments vs Business Interests
              </h3>
              <p className="text-sm text-neutral-500">
                {committeeConflicts.length} potential conflict
                {committeeConflicts.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {committeeConflicts.map((conflict) => (
              <ConflictItem
                key={conflict.id}
                conflict={conflict}
                isExpanded={expandedId === conflict.id}
                onToggle={() => setExpandedId(expandedId === conflict.id ? null : conflict.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="rounded-lg bg-neutral-50 p-4 dark:bg-neutral-800">
        <p className="text-xs text-neutral-500">
          <strong>Disclaimer:</strong> {conflicts.disclaimer}
        </p>
        <p className="mt-2 text-xs text-neutral-400">
          Analysis based on {conflicts.billsAnalyzed} bills and {conflicts.committeesAnalyzed}{" "}
          committee assignments. Last analyzed: {formatDate(conflicts.lastAnalyzedAt)}
        </p>
      </div>
    </div>
  );
}

interface ConflictItemProps {
  conflict: ConflictOfInterest;
  isExpanded: boolean;
  onToggle: () => void;
}

/**
 * Conflict Item Component
 * Requirement 29.3
 */
function ConflictItem({ conflict, isExpanded, onToggle }: ConflictItemProps) {
  const severityConfig = getSeverityConfigForConflict(conflict.severity);

  return (
    <div className="bg-white dark:bg-neutral-800">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700"
      >
        <div className="flex items-center gap-3">
          <span className={`badge ${severityConfig.badgeClass}`}>{severityConfig.label}</span>
          <span className="font-medium text-neutral-900 dark:text-white">
            {conflict.relatedEntity.name.substring(0, 50)}
            {conflict.relatedEntity.name.length > 50 ? "..." : ""}
          </span>
        </div>
        <svg
          className={`h-5 w-5 text-neutral-400 transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="border-t border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900">
          {/* Conflict Nature */}
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            {conflict.conflictNature}
          </p>

          {/* Details */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-white p-3 dark:bg-neutral-800">
              <p className="text-xs font-semibold text-neutral-500 uppercase">Business Interest</p>
              <p className="mt-1 text-sm text-neutral-900 dark:text-white">
                {conflict.businessInterest.description}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Industry: {conflict.businessInterest.industry} • Value: ₱
                {formatNumber(conflict.businessInterest.value)}
              </p>
            </div>
            <div className="rounded-lg bg-white p-3 dark:bg-neutral-800">
              <p className="text-xs font-semibold text-neutral-500 uppercase">
                Related {conflict.type === "bill_authorship" ? "Bill" : "Committee"}
              </p>
              <p className="mt-1 text-sm text-neutral-900 dark:text-white">
                {conflict.relatedEntity.name}
              </p>
              <p className="mt-1 text-xs text-neutral-500">{conflict.relatedEntity.description}</p>
            </div>
          </div>

          <p className="mt-3 text-xs text-neutral-400">
            Detected: {formatDate(conflict.detectedAt)}
          </p>
        </div>
      )}
    </div>
  );
}

function getSeverityConfigForConflict(severity: string) {
  const configs: Record<string, { label: string; badgeClass: string }> = {
    low: {
      label: "Low",
      badgeClass: "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300",
    },
    medium: {
      label: "Medium",
      badgeClass: "bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-300",
    },
    high: {
      label: "High",
      badgeClass: "bg-error-100 text-error-700 dark:bg-error-900 dark:text-error-300",
    },
  };

  return (
    configs[severity] || {
      label: severity,
      badgeClass: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
    }
  );
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-PH").format(value);
}
