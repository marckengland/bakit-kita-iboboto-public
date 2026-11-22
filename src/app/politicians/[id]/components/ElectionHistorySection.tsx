/**
 * Election History Section Component
 *
 * Displays election results timeline, opponents with vote counts, and term limit status.
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 46.1, 46.2, 46.3
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { ElectionResultData } from "@/services/election.service";
import { TermLimitStatus } from "@/services/term-limit.service";
import { SourcesAccordion } from "./SourcesAccordion";

interface ElectionHistorySectionProps {
  politicianId: string;
  initialElections?: ElectionResultData[];
  initialTermLimitStatus?: TermLimitStatus | null;
}

export function ElectionHistorySection({
  politicianId,
  initialElections = [],
  initialTermLimitStatus = null,
}: ElectionHistorySectionProps) {
  const [elections, setElections] = useState<ElectionResultData[]>(initialElections);
  const [termLimitStatus, setTermLimitStatus] = useState<TermLimitStatus | null>(
    initialTermLimitStatus
  );
  const [loading, setLoading] = useState(initialElections.length === 0);
  const [expandedElectionId, setExpandedElectionId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [electionsRes, termLimitRes] = await Promise.all([
        fetch(`/api/politicians/${politicianId}/elections`),
        fetch(`/api/politicians/${politicianId}/term-limit`),
      ]);

      if (electionsRes.ok) {
        const data = await electionsRes.json();
        setElections(data);
      }
      if (termLimitRes.ok) {
        const data = await termLimitRes.json();
        setTermLimitStatus(data);
      }
    } catch (error) {
      console.error("Failed to fetch election data:", error);
    } finally {
      setLoading(false);
    }
  }, [politicianId]);

  useEffect(() => {
    if (initialElections.length === 0) {
      fetchData();
    }
  }, [fetchData, initialElections.length]);

  // Calculate summary stats
  const totalElections = elections.length;
  const wins = elections.filter((e) => e.result === "won").length;
  const losses = elections.filter((e) => e.result === "lost").length;
  const winRate = totalElections > 0 ? (wins / totalElections) * 100 : 0;

  // Handle no election data
  if (!loading && elections.length === 0) {
    return (
      <div className="card">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
            <svg className="h-5 w-5 text-neutral-500" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
              Election History
            </h2>
            <p className="text-sm text-neutral-500">Electoral track record</p>
          </div>
        </div>
        <div className="rounded-lg bg-neutral-50 p-8 text-center dark:bg-neutral-800">
          <svg
            className="mx-auto h-12 w-12 text-neutral-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p className="mt-4 text-neutral-600 dark:text-neutral-400">
            No election records available
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            Election data will be displayed when COMELEC records become available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-accent-100 dark:bg-accent-900 flex h-10 w-10 items-center justify-center rounded-full">
            <svg
              className="text-accent-600 dark:text-accent-400 h-5 w-5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
              Election History
            </h2>
            <p className="text-sm text-neutral-500">
              {totalElections} election{totalElections !== 1 ? "s" : ""} • {wins} win
              {wins !== 1 ? "s" : ""}, {losses} loss{losses !== 1 ? "es" : ""}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <ElectionSkeleton />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Total Elections"
              value={totalElections.toString()}
              icon={
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path
                    fillRule="evenodd"
                    d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                    clipRule="evenodd"
                  />
                </svg>
              }
            />
            <SummaryCard
              label="Wins"
              value={wins.toString()}
              variant="success"
              icon={
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              }
            />
            <SummaryCard
              label="Losses"
              value={losses.toString()}
              variant={losses > 0 ? "warning" : "default"}
              icon={
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              }
            />
            <SummaryCard
              label="Win Rate"
              value={`${winRate.toFixed(0)}%`}
              variant={winRate >= 50 ? "success" : "default"}
              icon={
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
              }
            />
          </div>

          {/* Term Limit Status - Requirements 46.1, 46.2, 46.3 */}
          {termLimitStatus && <TermLimitStatusCard termLimitStatus={termLimitStatus} />}

          {/* Election Results Timeline - Requirements 7.1, 7.4 */}
          <div className="mt-6">
            <h3 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
              Election Results
            </h3>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute top-0 left-4 h-full w-0.5 bg-neutral-200 sm:left-6 dark:bg-neutral-700" />

              {/* Timeline items - sorted by year descending (Requirement 7.4) */}
              <div className="space-y-4">
                {elections.map((election) => (
                  <ElectionTimelineItem
                    key={election.id}
                    election={election}
                    isExpanded={expandedElectionId === election.id}
                    onToggle={() =>
                      setExpandedElectionId(expandedElectionId === election.id ? null : election.id)
                    }
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Source Attribution - Requirement 7.5 */}
          {elections.length > 0 && elections[0]?.sources && elections[0].sources.length > 0 && (
            <div className="mt-6 rounded-lg bg-neutral-50 p-4 dark:bg-neutral-800">
              <p className="text-xs text-neutral-500">
                <strong>Source:</strong> COMELEC (Commission on Elections)
                {elections[0]?.sources[0]?.sourceUrl && (
                  <a
                    href={elections[0]?.sources[0]?.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-500 hover:text-primary-600 ml-2"
                  >
                    View Source →
                  </a>
                )}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

interface SummaryCardProps {
  label: string;
  value: string;
  variant?: "default" | "success" | "warning";
  icon?: React.ReactNode;
}

function SummaryCard({ label, value, variant = "default", icon }: SummaryCardProps) {
  const variantStyles = {
    default: "text-neutral-900 dark:text-white",
    success: "text-success-600 dark:text-success-400",
    warning: "text-warning-600 dark:text-warning-400",
  };

  const iconStyles = {
    default: "text-neutral-400",
    success: "text-success-500",
    warning: "text-warning-500",
  };

  return (
    <div className="rounded-lg bg-neutral-50 p-4 dark:bg-neutral-800">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">{label}</p>
        {icon && <span className={iconStyles[variant]}>{icon}</span>}
      </div>
      <p className={`mt-1 text-2xl font-bold ${variantStyles[variant]}`}>{value}</p>
    </div>
  );
}

interface TermLimitStatusCardProps {
  termLimitStatus: TermLimitStatus;
}

/**
 * Term Limit Status Card
 * Requirements: 46.1, 46.2, 46.3
 */
function TermLimitStatusCard({ termLimitStatus }: TermLimitStatusCardProps) {
  const {
    currentPosition,
    positionHistory,
    totalYearsInOffice,
    termHoppingDetected,
    positionsWhereReachedLimit,
  } = termLimitStatus;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800">
      <div className="mb-4 flex items-center gap-2">
        <svg className="text-primary-500 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
            clipRule="evenodd"
          />
        </svg>
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
          Term Limit Status
        </h3>
      </div>

      {/* Current Position Status - Requirement 46.2, 46.3 */}
      {currentPosition && (
        <div className="bg-primary-50 dark:bg-primary-900/20 mb-4 rounded-lg p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-neutral-900 dark:text-white">
                {currentPosition.position}
              </p>
              <p className="text-sm text-neutral-500">{currentPosition.jurisdiction}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge bg-primary-100 text-primary-700 dark:bg-primary-800 dark:text-primary-300">
                Term {currentPosition.termNumber} of {currentPosition.maxTerms}
              </span>
              {/* Requirement 46.3 - Final Term indicator */}
              {currentPosition.isFinalTerm && (
                <span className="badge bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-300">
                  Final Term
                </span>
              )}
              {currentPosition.eligibleForReelection && (
                <span className="badge bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300">
                  Eligible for Re-election
                </span>
              )}
            </div>
          </div>
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs text-neutral-500">
              <span>Term Progress</span>
              <span>
                {currentPosition.termsRemaining} term
                {currentPosition.termsRemaining !== 1 ? "s" : ""} remaining
              </span>
            </div>
            <div className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-700">
              <div
                className={`h-2 rounded-full ${
                  currentPosition.isFinalTerm ? "bg-warning-500" : "bg-primary-500"
                }`}
                style={{
                  width: `${(currentPosition.termNumber / currentPosition.maxTerms) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Position History - Requirement 46.1 */}
      {positionHistory.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Terms Served by Position
          </h4>
          <div className="space-y-2">
            {positionHistory.map((history, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900"
              >
                <div>
                  <p className="text-sm font-medium text-neutral-900 dark:text-white">
                    {history.position}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {history.jurisdiction} • {history.years}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    {history.consecutiveTermsServed}/{history.maxTerms} terms
                  </span>
                  {history.reachedLimit && (
                    <span className="badge bg-secondary-100 text-secondary-700 dark:bg-secondary-900 dark:text-secondary-300 text-xs">
                      Limit Reached
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="flex flex-wrap items-center gap-4 border-t border-neutral-200 pt-4 dark:border-neutral-700">
        <div>
          <p className="text-xs text-neutral-500">Total Years in Office</p>
          <p className="text-lg font-bold text-neutral-900 dark:text-white">
            {totalYearsInOffice} year{totalYearsInOffice !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Term-hopping indicator */}
        {termHoppingDetected && (
          <div className="bg-warning-50 dark:bg-warning-900/20 flex items-center gap-2 rounded-lg px-3 py-2">
            <svg className="text-warning-500 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-warning-700 dark:text-warning-300 text-sm">
              Term-hopping pattern detected
            </span>
          </div>
        )}

        {/* Positions where reached limit - Requirement 46.6 */}
        {positionsWhereReachedLimit.length > 0 && (
          <div>
            <p className="text-xs text-neutral-500">Reached Limit In</p>
            <p className="text-sm text-neutral-700 dark:text-neutral-300">
              {positionsWhereReachedLimit.join(", ")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface ElectionTimelineItemProps {
  election: ElectionResultData;
  isExpanded: boolean;
  onToggle: () => void;
}

/**
 * Election Timeline Item
 * Requirements: 7.2, 7.3
 */
function ElectionTimelineItem({ election, isExpanded, onToggle }: ElectionTimelineItemProps) {
  const isWin = election.result === "won";

  return (
    <div className="relative flex gap-4 sm:gap-6">
      {/* Timeline dot */}
      <div className="relative z-10 flex-shrink-0">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full sm:h-12 sm:w-12 ${
            isWin
              ? "bg-success-500 ring-success-100 dark:ring-success-900 ring-4"
              : "bg-secondary-500 ring-secondary-100 dark:ring-secondary-900 ring-4"
          }`}
        >
          {isWin ? (
            <svg
              className="h-4 w-4 text-white sm:h-5 sm:w-5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg
              className="h-4 w-4 text-white sm:h-5 sm:w-5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Content */}
      <div
        className={`relative flex-1 rounded-lg border p-4 ${
          isWin
            ? "border-success-200 bg-success-50 dark:border-success-800 dark:bg-success-900/20"
            : "border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800"
        }`}
      >
        {/* Result badge */}
        <span
          className={`badge absolute -top-2 right-4 text-xs ${
            isWin ? "bg-success-500 text-white" : "bg-secondary-500 text-white"
          }`}
        >
          {isWin ? "Won" : "Lost"}
        </span>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {/* Position Sought - Requirement 7.2 */}
            <h4 className="font-semibold text-neutral-900 dark:text-white">
              {election.positionSought}
            </h4>

            {/* Jurisdiction */}
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {election.jurisdiction}
            </p>

            {/* Election Type Badge */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="badge bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                {formatElectionType(election.electionType)}
              </span>
              {election.rank && (
                <span className="badge bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                  Rank #{election.rank}
                </span>
              )}
            </div>
          </div>

          {/* Year and Vote Count - Requirement 7.2 */}
          <div className="text-right">
            <p className="text-lg font-bold text-neutral-900 dark:text-white">
              {election.electionYear}
            </p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {formatNumber(election.voteCount)} votes
            </p>
            <p className="text-xs text-neutral-500">
              {election.votePercentage.toFixed(1)}% of total
            </p>
          </div>
        </div>

        {/* Margin/Deficit - Requirement 7.2 */}
        {election.marginOrDeficit !== null && election.marginOrDeficit !== undefined && (
          <div className="mt-3 flex items-center gap-2">
            <span
              className={`text-sm font-medium ${
                election.marginOrDeficit > 0
                  ? "text-success-600 dark:text-success-400"
                  : "text-secondary-600 dark:text-secondary-400"
              }`}
            >
              {election.marginOrDeficit > 0 ? "+" : ""}
              {formatNumber(election.marginOrDeficit)} vote{" "}
              {election.marginOrDeficit > 0 ? "margin" : "deficit"}
            </span>
          </div>
        )}

        {/* Expand/Collapse Button */}
        {election.opponents.length > 0 && (
          <button
            onClick={onToggle}
            className="text-primary-500 hover:text-primary-600 mt-3 flex items-center gap-1 text-sm"
          >
            {isExpanded ? "Hide" : "Show"} opponents ({election.opponents.length})
            <svg
              className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}

        {/* Opponents List - Requirement 7.3 */}
        {isExpanded && election.opponents.length > 0 && (
          <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-700">
            <h5 className="mb-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Top Opponents
            </h5>
            <div className="space-y-2">
              {election.opponents.map((opponent, index) => (
                <div
                  key={opponent.id}
                  className="flex items-center justify-between rounded-lg bg-white p-3 dark:bg-neutral-900"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200 text-xs font-medium text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">
                        {opponent.name}
                      </p>
                      {opponent.party && (
                        <p className="text-xs text-neutral-500">{opponent.party}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">
                      {formatNumber(opponent.voteCount)}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {opponent.votePercentage.toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sources Accordion */}
        {election.sources.length > 0 && (
          <div className="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-700">
            <SourcesAccordion sources={election.sources} />
          </div>
        )}
      </div>
    </div>
  );
}

function ElectionSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800"
          />
        ))}
      </div>
      <div className="h-32 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800"
          />
        ))}
      </div>
    </div>
  );
}

// ============================================
// Utility Functions
// ============================================

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-PH").format(value);
}

function formatElectionType(type: string): string {
  const labels: Record<string, string> = {
    national: "National Election",
    local: "Local Election",
    barangay: "Barangay Election",
    special: "Special Election",
  };
  return labels[type] || type;
}
