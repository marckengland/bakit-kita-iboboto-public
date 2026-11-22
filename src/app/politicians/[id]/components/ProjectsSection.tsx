/**
 * Projects Section Component
 *
 * Displays projects organized by position with COA findings.
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 22.1, 22.2, 22.3, 22.4, 22.5
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { ProjectStatus, COAFindingSeverity, COAFindingStatus } from "@prisma/client";
import {
  ProjectWithPosition,
  COAFindingData,
  BudgetImplementationSummary,
} from "@/services/project.service";
import { SourceTooltip } from "./SourceTooltip";

interface ProjectsSectionProps {
  politicianId: string;
  initialProjects?: ProjectWithPosition[];
  initialSummary?: BudgetImplementationSummary | null;
}

export function ProjectsSection({
  politicianId,
  initialProjects = [],
  initialSummary = null,
}: ProjectsSectionProps) {
  const [projects, setProjects] = useState<ProjectWithPosition[]>(initialProjects);
  const [summary, setSummary] = useState<BudgetImplementationSummary | null>(initialSummary);
  const [loading, setLoading] = useState(initialProjects.length === 0);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "">("");
  const [positionFilter, setPositionFilter] = useState<string>("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [projectsRes, summaryRes] = await Promise.all([
        fetch(`/api/politicians/${politicianId}/projects`),
        fetch(`/api/politicians/${politicianId}/projects/summary`),
      ]);

      if (projectsRes.ok) {
        const data = await projectsRes.json();
        setProjects(data);
      }
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummary(data);
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    } finally {
      setLoading(false);
    }
  }, [politicianId]);

  useEffect(() => {
    if (initialProjects.length === 0) {
      fetchData();
    }
  }, [fetchData, initialProjects.length]);

  // Get unique positions for filter
  const uniquePositions = Array.from(
    new Set(projects.map((p) => `${p.positionTitle} - ${p.positionJurisdiction}`))
  );

  // Filter projects
  const filteredProjects = projects.filter((project) => {
    if (statusFilter && project.status !== statusFilter) {
      return false;
    }
    if (
      positionFilter &&
      `${project.positionTitle} - ${project.positionJurisdiction}` !== positionFilter
    ) {
      return false;
    }
    return true;
  });

  // Group projects by position - Requirement 4.3
  const projectsByPosition = filteredProjects.reduce(
    (acc, project) => {
      const key = `${project.positionTitle} - ${project.positionJurisdiction}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(project);
      return acc;
    },
    {} as Record<string, ProjectWithPosition[]>
  );

  // Handle no projects
  if (!loading && projects.length === 0) {
    return (
      <div className="card">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
            <svg className="h-5 w-5 text-neutral-500" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1h6v4H7V5zm6 6H7v2h6v-2z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
              Projects & Programs
            </h2>
            <p className="text-sm text-neutral-500">Budget allocations and implementations</p>
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
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <p className="mt-4 text-neutral-600 dark:text-neutral-400">
            No project records available
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            Project data will be displayed when DBM and COA records become available.
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
          <div className="bg-primary-100 dark:bg-primary-900 flex h-10 w-10 items-center justify-center rounded-full">
            <svg
              className="text-primary-600 dark:text-primary-400 h-5 w-5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1h6v4H7V5zm6 6H7v2h6v-2z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
              Projects & Programs
            </h2>
            <p className="text-sm text-neutral-500">
              {projects.length} project{projects.length !== 1 ? "s" : ""} across{" "}
              {uniquePositions.length} position{uniquePositions.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | "")}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          >
            <option value="">All Status</option>
            <option value="planned">Planned</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {uniquePositions.length > 1 && (
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            >
              <option value="">All Positions</option>
              {uniquePositions.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {loading ? (
        <ProjectsSkeleton />
      ) : (
        <>
          {/* Budget Implementation Summary - Requirement 22.6 */}
          {summary && <BudgetSummaryCards summary={summary} />}

          {/* Projects by Position - Requirement 4.1, 4.3 */}
          <div className="mt-6 space-y-6">
            {Object.entries(projectsByPosition).map(([position, positionProjects]) => (
              <PositionProjectGroup
                key={position}
                position={position}
                projects={positionProjects}
                expandedProjectId={expandedProjectId}
                onToggleExpand={(id) => setExpandedProjectId(expandedProjectId === id ? null : id)}
              />
            ))}
          </div>

          {/* Source Attribution - Requirement 4.5, 22.7 */}
          {projects.length > 0 && (
            <div className="mt-6 rounded-lg bg-neutral-50 p-4 dark:bg-neutral-800">
              <p className="text-xs text-neutral-500">
                <strong>Sources:</strong> Department of Budget and Management (DBM), Commission on
                Audit (COA)
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

interface BudgetSummaryCardsProps {
  summary: BudgetImplementationSummary;
}

function BudgetSummaryCards({ summary }: BudgetSummaryCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        label="Total Budget"
        value={formatCurrency(summary.totalBudgetAllocated)}
        icon={
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
              clipRule="evenodd"
            />
          </svg>
        }
      />
      <SummaryCard
        label="Completed"
        value={summary.projectsCompleted.toString()}
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
        label="Implementation Rate"
        value={`${summary.implementationRate.toFixed(0)}%`}
        variant={summary.implementationRate >= 50 ? "success" : "warning"}
        icon={
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
          </svg>
        }
      />
      <SummaryCard
        label="COA Findings"
        value={summary.coaFindingsCount.toString()}
        variant={summary.coaFindingsCount > 0 ? "warning" : "default"}
        icon={
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        }
      />
    </div>
  );
}

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

interface PositionProjectGroupProps {
  position: string;
  projects: ProjectWithPosition[];
  expandedProjectId: string | null;
  onToggleExpand: (id: string) => void;
}

function PositionProjectGroup({
  position,
  projects,
  expandedProjectId,
  onToggleExpand,
}: PositionProjectGroupProps) {
  const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0);
  const completedCount = projects.filter((p) => p.status === "completed").length;

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700">
      {/* Position Header */}
      <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-semibold text-neutral-900 dark:text-white">{position}</h3>
          <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-500">
            <span>
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </span>
            <span>•</span>
            <span>{completedCount} completed</span>
            {totalBudget > 0 && (
              <>
                <span>•</span>
                <span>{formatCurrency(totalBudget)} total</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Projects List */}
      <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            isExpanded={expandedProjectId === project.id}
            onToggle={() => onToggleExpand(project.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface ProjectCardProps {
  project: ProjectWithPosition;
  isExpanded: boolean;
  onToggle: () => void;
}

function ProjectCard({ project, isExpanded, onToggle }: ProjectCardProps) {
  const [showSourceTooltip, setShowSourceTooltip] = useState(false);
  const statusConfig = getStatusConfig(project.status);
  const hasCoaFindings = project.coaFindings.length > 0;
  const hasOutcomes = project.outcomes.length > 0;

  return (
    <div
      className="relative p-4"
      onMouseEnter={() => setShowSourceTooltip(true)}
      onMouseLeave={() => setShowSourceTooltip(false)}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          {/* Project Name - Requirement 4.2 */}
          <h4 className="font-medium text-neutral-900 dark:text-white">{project.name}</h4>

          {/* Description */}
          {project.description && (
            <p className="mt-1 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">
              {project.description}
            </p>
          )}

          {/* Badges */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`badge ${statusConfig.badgeClass}`}>{statusConfig.label}</span>

            {/* COA Findings indicator - Requirement 22.3 */}
            {hasCoaFindings && (
              <span className="badge bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-300">
                {project.coaFindings.length} COA Finding
                {project.coaFindings.length !== 1 ? "s" : ""}
              </span>
            )}

            {/* Implementing Agency */}
            {project.implementingAgency && (
              <span className="badge bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                {project.implementingAgency}
              </span>
            )}
          </div>
        </div>

        {/* Budget and Timeline - Requirements 4.2, 4.4 */}
        <div className="text-right sm:min-w-[140px]">
          {project.budget && (
            <p className="text-lg font-bold text-neutral-900 dark:text-white">
              {formatCurrency(project.budget)}
            </p>
          )}
          <p className="text-sm text-neutral-500">
            {formatDate(project.startDate)}
            {project.endDate && ` - ${formatDate(project.endDate)}`}
          </p>
        </div>
      </div>

      {/* Location - Requirement 22.4 */}
      {project.location && (
        <div className="mt-2 flex items-center gap-1 text-sm text-neutral-500">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
              clipRule="evenodd"
            />
          </svg>
          <span>
            {[
              project.location.barangay,
              project.location.city,
              project.location.province,
              project.location.region,
            ]
              .filter(Boolean)
              .join(", ")}
          </span>
        </div>
      )}

      {/* Expand/Collapse Button */}
      {(hasCoaFindings || hasOutcomes) && (
        <button
          onClick={onToggle}
          className="text-primary-500 hover:text-primary-600 mt-3 flex items-center gap-1 text-sm"
        >
          {isExpanded ? "Hide" : "Show"} details
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

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-4 space-y-4 border-t border-neutral-200 pt-4 dark:border-neutral-700">
          {/* Project Outcomes - Requirement 4.4 */}
          {hasOutcomes && (
            <div>
              <h5 className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Project Outcomes
              </h5>
              <div className="space-y-2">
                {project.outcomes.map((outcome) => (
                  <div
                    key={outcome.id}
                    className="bg-success-50 dark:bg-success-900/20 flex items-center justify-between rounded-lg p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">
                        {outcome.metric}
                      </p>
                      <p className="text-xs text-neutral-500">{formatDate(outcome.date)}</p>
                    </div>
                    <span className="text-success-600 dark:text-success-400 text-sm font-bold">
                      {outcome.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* COA Findings - Requirements 22.1, 22.2, 22.3 */}
          {hasCoaFindings && <COAFindingsSection findings={project.coaFindings} />}
        </div>
      )}

      {/* Source Tooltip */}
      {showSourceTooltip && project.sources.length > 0 && (
        <div className="absolute top-full left-0 z-10 mt-2">
          <SourceTooltip sources={project.sources} />
        </div>
      )}
    </div>
  );
}

interface COAFindingsSectionProps {
  findings: COAFindingData[];
}

/**
 * COA Findings Section
 * Requirements: 22.1, 22.2, 22.3, 22.4, 22.5
 */
function COAFindingsSection({ findings }: COAFindingsSectionProps) {
  return (
    <div>
      <h5 className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        <svg className="text-warning-500 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        COA Audit Findings
      </h5>
      <div className="space-y-2">
        {findings.map((finding) => (
          <COAFindingCard key={finding.id} finding={finding} />
        ))}
      </div>
      {/* Link to official COA reports - Requirement 22.5 */}
      <a
        href="https://www.coa.gov.ph/reports/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary-500 hover:text-primary-600 mt-3 inline-flex items-center gap-1 text-xs"
      >
        View Official COA Reports
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </a>
    </div>
  );
}

interface COAFindingCardProps {
  finding: COAFindingData;
}

function COAFindingCard({ finding }: COAFindingCardProps) {
  const severityConfig = getSeverityConfig(finding.severity);
  const statusConfig = getFindingStatusConfig(finding.status);

  return (
    <div className={`rounded-lg border p-3 ${severityConfig.borderClass}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          {/* Audit Observation - Requirement 22.2 */}
          <p className="text-sm text-neutral-900 dark:text-white">{finding.finding}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {/* Severity Badge */}
            <span className={`badge text-xs ${severityConfig.badgeClass}`}>
              {severityConfig.label}
            </span>
            {/* Compliance Status - Requirement 22.4 */}
            <span className={`badge text-xs ${statusConfig.badgeClass}`}>{statusConfig.label}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
            {finding.year}
          </p>
        </div>
      </div>
    </div>
  );
}

function ProjectsSkeleton() {
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
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800"
          />
        ))}
      </div>
    </div>
  );
}

// ============================================
// Utility Functions
// ============================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
  });
}

function getStatusConfig(status: ProjectStatus) {
  const configs: Record<ProjectStatus, { label: string; badgeClass: string }> = {
    planned: {
      label: "Planned",
      badgeClass: "bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300",
    },
    ongoing: {
      label: "Ongoing",
      badgeClass: "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300",
    },
    completed: {
      label: "Completed",
      badgeClass: "bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300",
    },
    cancelled: {
      label: "Cancelled",
      badgeClass: "bg-error-100 text-error-700 dark:bg-error-900 dark:text-error-300",
    },
  };
  return configs[status];
}

function getSeverityConfig(severity: COAFindingSeverity) {
  const configs: Record<
    COAFindingSeverity,
    { label: string; badgeClass: string; borderClass: string }
  > = {
    observation: {
      label: "Observation",
      badgeClass: "bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300",
      borderClass: "border-neutral-200 dark:border-neutral-700",
    },
    deficiency: {
      label: "Deficiency",
      badgeClass: "bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-300",
      borderClass: "border-warning-200 dark:border-warning-800",
    },
    irregularity: {
      label: "Irregularity",
      badgeClass: "bg-error-100 text-error-700 dark:bg-error-900 dark:text-error-300",
      borderClass: "border-error-200 dark:border-error-800",
    },
  };
  return configs[severity];
}

function getFindingStatusConfig(status: COAFindingStatus) {
  const configs: Record<COAFindingStatus, { label: string; badgeClass: string }> = {
    open: {
      label: "Open",
      badgeClass: "bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-300",
    },
    resolved: {
      label: "Resolved",
      badgeClass: "bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300",
    },
  };
  return configs[status];
}
