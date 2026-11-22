/**
 * Data Freshness Dashboard Component
 *
 * Admin dashboard for monitoring data freshness, viewing scrape job status,
 * and triggering manual scrapes.
 *
 * Requirements: 20.8, 20.9
 */

"use client";

import { useState, useEffect, useCallback } from "react";

// ============================================
// Types
// ============================================

type DataSourceType =
  | "senate"
  | "house"
  | "comelec"
  | "dbm"
  | "coa"
  | "courts"
  | "ombudsman"
  | "politicians";
type JobStatus = "pending" | "running" | "completed" | "failed";
type AlertSeverity = "info" | "warning" | "error";

interface DataFreshnessStatus {
  source: DataSourceType;
  lastUpdated: string | null;
  recordCount: number;
  isStale: boolean;
  staleDays: number;
  nextScheduledUpdate: string | null;
  isEnabled: boolean;
}

interface ScrapeJob {
  id: string;
  source: DataSourceType;
  status: JobStatus;
  recordsProcessed: number;
  recordsAdded: number;
  recordsUpdated: number;
  errors: string[];
  startedAt: string;
  completedAt: string | null;
}

interface ScrapeAlert {
  id: string;
  source: DataSourceType;
  severity: AlertSeverity;
  message: string;
  createdAt: string;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
}

interface DataFreshnessReport {
  sources: DataFreshnessStatus[];
  overallHealth: "healthy" | "warning" | "critical";
  lastFullUpdate: string | null;
  totalRecords: number;
  staleSourceCount: number;
}

// ============================================
// Constants
// ============================================

const SOURCE_LABELS: Record<DataSourceType, string> = {
  senate: "Senate",
  house: "House of Representatives",
  comelec: "COMELEC",
  dbm: "DBM",
  coa: "COA",
  courts: "Courts",
  ombudsman: "Ombudsman",
  politicians: "Politicians Directory",
};

const SOURCE_DESCRIPTIONS: Record<DataSourceType, string> = {
  senate: "Bills, voting records, and attendance from the Philippine Senate",
  house: "Bills and legislative records from the House of Representatives",
  comelec: "Election results, candidates, and campaign finance data",
  dbm: "Budget allocations and project funding data",
  coa: "Audit findings and financial reports",
  courts: "Court cases and legal proceedings",
  ombudsman: "Corruption cases and investigations",
  politicians:
    "Senators, Representatives - status updates for resignations, impeachments, term changes",
};

const STATUS_COLORS: Record<JobStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  running: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  info: "bg-blue-50 border-blue-200 text-blue-800",
  warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
  error: "bg-red-50 border-red-200 text-red-800",
};

const HEALTH_COLORS = {
  healthy: "text-green-600 bg-green-50",
  warning: "text-yellow-600 bg-yellow-50",
  critical: "text-red-600 bg-red-50",
};

// ============================================
// Main Component
// ============================================

export function DataFreshnessDashboard() {
  const [freshnessReport, setFreshnessReport] = useState<DataFreshnessReport | null>(null);
  const [recentJobs, setRecentJobs] = useState<ScrapeJob[]>([]);
  const [alerts, setAlerts] = useState<ScrapeAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggeringSource, setTriggeringSource] = useState<DataSourceType | null>(null);
  const [selectedJob, setSelectedJob] = useState<ScrapeJob | null>(null);
  const [activeTab, setActiveTab] = useState<"freshness" | "jobs" | "alerts">("freshness");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [freshnessRes, jobsRes, alertsRes] = await Promise.all([
        fetch("/api/admin/data-freshness", {
          headers: { "x-admin-role": "super_admin" },
        }),
        fetch("/api/admin/data-freshness/jobs?limit=20", {
          headers: { "x-admin-role": "super_admin" },
        }),
        fetch("/api/admin/data-freshness/alerts?acknowledged=false", {
          headers: { "x-admin-role": "super_admin" },
        }),
      ]);

      if (!freshnessRes.ok || !jobsRes.ok || !alertsRes.ok) {
        throw new Error("Failed to fetch data freshness information");
      }

      const [freshnessData, jobsData, alertsData] = await Promise.all([
        freshnessRes.json(),
        jobsRes.json(),
        alertsRes.json(),
      ]);

      setFreshnessReport(freshnessData);
      setRecentJobs(jobsData.jobs);
      setAlerts(alertsData.alerts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTriggerScrape = async (source: DataSourceType) => {
    setTriggeringSource(source);

    try {
      const response = await fetch("/api/admin/data-freshness/trigger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-role": "super_admin",
        },
        body: JSON.stringify({ source }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to trigger scrape");
      }

      const job = await response.json();
      setRecentJobs((prev) => [job, ...prev]);

      // Refresh data after a short delay
      setTimeout(fetchData, 2000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to trigger scrape");
    } finally {
      setTriggeringSource(null);
    }
  };

  const handleTriggerAll = async () => {
    setTriggeringSource("senate" as DataSourceType); // Use as loading indicator

    try {
      const response = await fetch("/api/admin/data-freshness/trigger-all", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-role": "super_admin",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to trigger all scrapes");
      }

      const { jobs } = await response.json();
      setRecentJobs((prev) => [...jobs, ...prev]);

      setTimeout(fetchData, 2000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to trigger scrapes");
    } finally {
      setTriggeringSource(null);
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/admin/data-freshness/alerts/${alertId}/acknowledge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-role": "super_admin",
        },
      });

      if (response.ok) {
        setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      }
    } catch (err) {
      console.error("Failed to acknowledge alert:", err);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) {
      return "Never";
    }
    return new Date(dateString).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) {
      return "Never";
    }
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) {
      return "Just now";
    }
    if (diffMins < 60) {
      return `${diffMins} min ago`;
    }
    if (diffHours < 24) {
      return `${diffHours} hours ago`;
    }
    return `${diffDays} days ago`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner className="h-8 w-8 text-blue-500" />
        <span className="ml-3 text-gray-600">Loading data freshness information...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <AlertIcon className="mx-auto mb-4 h-12 w-12 text-red-500" />
        <p className="mb-4 text-red-700">{error}</p>
        <button
          onClick={fetchData}
          className="rounded-lg bg-red-500 px-4 py-2 text-white hover:bg-red-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Health Status */}
      {freshnessReport && (
        <div className={`rounded-lg p-6 ${HEALTH_COLORS[freshnessReport.overallHealth]}`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">System Health</h2>
              <p className="mt-1 text-3xl font-bold capitalize">{freshnessReport.overallHealth}</p>
            </div>
            <div className="text-right">
              <p className="text-sm">
                Total Records: {freshnessReport.totalRecords.toLocaleString()}
              </p>
              <p className="text-sm">Stale Sources: {freshnessReport.staleSourceCount}</p>
              <p className="text-sm">
                Last Full Update: {formatRelativeTime(freshnessReport.lastFullUpdate)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          title="Active Sources"
          value={freshnessReport?.sources.filter((s) => s.isEnabled).length || 0}
          total={freshnessReport?.sources.length || 0}
          color="blue"
        />
        <StatCard
          title="Stale Sources"
          value={freshnessReport?.staleSourceCount || 0}
          color={freshnessReport?.staleSourceCount ? "red" : "green"}
        />
        <StatCard
          title="Pending Alerts"
          value={alerts.length}
          color={alerts.length > 0 ? "yellow" : "green"}
        />
        <StatCard
          title="Recent Jobs"
          value={recentJobs.filter((j) => j.status === "running").length}
          subtitle="Running"
          color="blue"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: "freshness", label: "Data Freshness" },
            { id: "jobs", label: "Scrape Jobs" },
            { id: "alerts", label: `Alerts (${alerts.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "freshness" && freshnessReport && (
        <FreshnessTab
          sources={freshnessReport.sources}
          onTriggerScrape={handleTriggerScrape}
          onTriggerAll={handleTriggerAll}
          triggeringSource={triggeringSource}
          formatDate={formatDate}
          formatRelativeTime={formatRelativeTime}
        />
      )}

      {activeTab === "jobs" && (
        <JobsTab jobs={recentJobs} onSelectJob={setSelectedJob} formatDate={formatDate} />
      )}

      {activeTab === "alerts" && (
        <AlertsTab alerts={alerts} onAcknowledge={handleAcknowledgeAlert} formatDate={formatDate} />
      )}

      {/* Job Detail Modal */}
      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          formatDate={formatDate}
        />
      )}
    </div>
  );
}

// ============================================
// Tab Components
// ============================================

interface FreshnessTabProps {
  sources: DataFreshnessStatus[];
  onTriggerScrape: (source: DataSourceType) => void;
  onTriggerAll: () => void;
  triggeringSource: DataSourceType | null;
  formatDate: (date: string | null) => string;
  formatRelativeTime: (date: string | null) => string;
}

function FreshnessTab({
  sources,
  onTriggerScrape,
  onTriggerAll,
  triggeringSource,
  formatDate,
  formatRelativeTime,
}: FreshnessTabProps) {
  return (
    <div className="space-y-4">
      {/* Trigger All Button */}
      <div className="flex justify-end">
        <button
          onClick={onTriggerAll}
          disabled={triggeringSource !== null}
          className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {triggeringSource !== null ? (
            <>
              <LoadingSpinner className="h-4 w-4" />
              Triggering...
            </>
          ) : (
            <>
              <RefreshIcon className="h-4 w-4" />
              Trigger All Scrapes
            </>
          )}
        </button>
      </div>

      {/* Source Cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {sources.map((source) => (
          <div
            key={source.source}
            className={`rounded-lg border-l-4 bg-white p-6 shadow ${
              source.isStale ? "border-red-500" : "border-green-500"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{SOURCE_LABELS[source.source]}</h3>
                  {!source.isEnabled && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      Disabled
                    </span>
                  )}
                  {source.isStale && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                      Stale ({source.staleDays} days)
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-500">{SOURCE_DESCRIPTIONS[source.source]}</p>
              </div>
              <button
                onClick={() => onTriggerScrape(source.source)}
                disabled={triggeringSource !== null || !source.isEnabled}
                className="ml-4 rounded-lg p-2 text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                title="Trigger manual scrape"
              >
                {triggeringSource === source.source ? (
                  <LoadingSpinner className="h-5 w-5" />
                ) : (
                  <RefreshIcon className="h-5 w-5" />
                )}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Last Updated</p>
                <p className="font-medium text-gray-900">
                  {formatRelativeTime(source.lastUpdated)}
                </p>
                <p className="text-xs text-gray-400">{formatDate(source.lastUpdated)}</p>
              </div>
              <div>
                <p className="text-gray-500">Records</p>
                <p className="font-medium text-gray-900">{source.recordCount.toLocaleString()}</p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-500">Next Scheduled Update</p>
                <p className="font-medium text-gray-900">
                  {source.nextScheduledUpdate
                    ? formatDate(source.nextScheduledUpdate)
                    : "Not scheduled"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface JobsTabProps {
  jobs: ScrapeJob[];
  onSelectJob: (job: ScrapeJob) => void;
  formatDate: (date: string | null) => string;
}

function JobsTab({ jobs, onSelectJob, formatDate }: JobsTabProps) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow">
        <DatabaseIcon className="mx-auto mb-4 h-12 w-12 text-gray-400" />
        <p className="text-gray-500">No recent scrape jobs</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
              Source
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
              Records
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
              Started
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
              Duration
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {jobs.map((job) => {
            const duration = job.completedAt
              ? Math.round(
                  (new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000
                )
              : null;

            return (
              <tr key={job.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="font-medium text-gray-900">{SOURCE_LABELS[job.source]}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[job.status]}`}
                  >
                    {job.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                  <span className="text-green-600">+{job.recordsAdded}</span>
                  {" / "}
                  <span className="text-blue-600">~{job.recordsUpdated}</span>
                  {" / "}
                  <span>{job.recordsProcessed} total</span>
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                  {formatDate(job.startedAt)}
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                  {duration !== null ? `${duration}s` : "Running..."}
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap">
                  <button
                    onClick={() => onSelectJob(job)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface AlertsTabProps {
  alerts: ScrapeAlert[];
  onAcknowledge: (alertId: string) => void;
  formatDate: (date: string | null) => string;
}

function AlertsTab({ alerts, onAcknowledge, formatDate }: AlertsTabProps) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow">
        <CheckCircleIcon className="mx-auto mb-4 h-12 w-12 text-green-500" />
        <p className="text-gray-500">No pending alerts</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {alerts.map((alert) => (
        <div key={alert.id} className={`rounded-lg border p-4 ${SEVERITY_COLORS[alert.severity]}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <AlertIcon className="h-5 w-5" />
                <span className="font-medium">{SOURCE_LABELS[alert.source]}</span>
                <span className="text-xs uppercase">{alert.severity}</span>
              </div>
              <p className="mt-1">{alert.message}</p>
              <p className="mt-2 text-xs opacity-75">{formatDate(alert.createdAt)}</p>
            </div>
            <button
              onClick={() => onAcknowledge(alert.id)}
              className="ml-4 rounded border bg-white px-3 py-1 text-sm hover:bg-gray-50"
            >
              Acknowledge
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Sub-Components
// ============================================

interface StatCardProps {
  title: string;
  value: number;
  total?: number;
  subtitle?: string;
  color: "blue" | "green" | "yellow" | "red";
}

function StatCard({ title, value, total, subtitle, color }: StatCardProps) {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-700",
    red: "bg-red-50 border-red-200 text-red-700",
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <p className="text-sm font-medium opacity-80">{title}</p>
      <p className="mt-1 text-2xl font-bold">
        {value}
        {total !== undefined && <span className="text-lg font-normal opacity-60">/{total}</span>}
      </p>
      {subtitle && <p className="text-xs opacity-60">{subtitle}</p>}
    </div>
  );
}

interface JobDetailModalProps {
  job: ScrapeJob;
  onClose: () => void;
  formatDate: (date: string | null) => string;
}

function JobDetailModal({ job, onClose, formatDate }: JobDetailModalProps) {
  const duration = job.completedAt
    ? Math.round((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Job Details</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* Job Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Source</p>
              <p className="font-medium text-gray-900">{SOURCE_LABELS[job.source]}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[job.status]}`}
              >
                {job.status}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Started</p>
              <p className="font-medium text-gray-900">{formatDate(job.startedAt)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Completed</p>
              <p className="font-medium text-gray-900">
                {job.completedAt ? formatDate(job.completedAt) : "In progress..."}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Duration</p>
              <p className="font-medium text-gray-900">
                {duration !== null ? `${duration} seconds` : "Running..."}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Job ID</p>
              <p className="font-mono text-sm text-gray-600">{job.id}</p>
            </div>
          </div>

          {/* Records Stats */}
          <div>
            <h4 className="mb-3 text-sm font-medium text-gray-700">Records Processed</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-gray-50 p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{job.recordsProcessed}</p>
                <p className="text-sm text-gray-500">Total Processed</p>
              </div>
              <div className="rounded-lg bg-green-50 p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{job.recordsAdded}</p>
                <p className="text-sm text-gray-500">Added</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{job.recordsUpdated}</p>
                <p className="text-sm text-gray-500">Updated</p>
              </div>
            </div>
          </div>

          {/* Errors */}
          {job.errors.length > 0 && (
            <div>
              <h4 className="mb-3 text-sm font-medium text-gray-700">
                Errors ({job.errors.length})
              </h4>
              <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4">
                {job.errors.map((error, index) => (
                  <p key={index} className="text-sm text-red-700">
                    • {error}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Icons
// ============================================

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function DatabaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
      />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
