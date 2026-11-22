/**
 * Report Moderation Dashboard Component
 *
 * Admin dashboard for reviewing and moderating community reports.
 * Implements moderation queue, verification tools, and publish/reject workflow.
 *
 * Requirements: 28.2, 28.3, 28.4, 28.5, 28.7, 39.3
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

// ============================================
// Types
// ============================================

type ReportType = "new_info" | "correction" | "controversy";
type ReportStatus = "pending" | "verified" | "rejected";
type EvidenceType = "document" | "link" | "image";

interface Evidence {
  id: string;
  type: EvidenceType;
  url: string;
  description?: string;
}

interface VerificationResult {
  status: string;
  confidence: number;
  reasoning: string;
}

interface ReportItem {
  id: string;
  submitterId?: string;
  politicianId: string;
  politicianName: string;
  politicianPhoto?: string;
  reportType: ReportType;
  content: string;
  status: ReportStatus;
  evidence: Evidence[];
  verificationResult?: VerificationResult;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ============================================
// Constants
// ============================================

const TYPE_LABELS: Record<ReportType, string> = {
  new_info: "New Information",
  correction: "Data Correction",
  controversy: "Controversy",
};

const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: "Pending Review",
  verified: "Published",
  rejected: "Rejected",
};

const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  document: "Document",
  link: "Link",
  image: "Image",
};

const TYPE_COLORS: Record<ReportType, string> = {
  new_info: "bg-blue-100 text-blue-800",
  correction: "bg-yellow-100 text-yellow-800",
  controversy: "bg-red-100 text-red-800",
};

const STATUS_COLORS: Record<ReportStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  verified: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

// ============================================
// Main Component
// ============================================

export function ReportModerationDashboard() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [filterType, setFilterType] = useState<ReportType | "">("");
  const [filterStatus, setFilterStatus] = useState<ReportStatus | "">("");

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (filterType) {
        params.append("type", filterType);
      }
      if (filterStatus) {
        params.append("status", filterStatus);
      }

      const response = await fetch(`/api/admin/reports?${params}`, {
        headers: {
          "x-admin-role": "content_moderator",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch reports");
      }

      const data = await response.json();
      setReports(data.reports);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, filterType, filterStatus]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handlePublish = async (reportId: string, notes?: string) => {
    try {
      const response = await fetch(`/api/admin/reports/${reportId}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-role": "content_moderator",
        },
        body: JSON.stringify({ notes }),
      });

      if (response.ok) {
        setReports((prev) =>
          prev.map((report) =>
            report.id === reportId ? { ...report, status: "verified" as ReportStatus } : report
          )
        );
        if (selectedReport?.id === reportId) {
          setSelectedReport((prev) => (prev ? { ...prev, status: "verified" } : null));
        }
      }
    } catch (err) {
      console.error("Failed to publish:", err);
    }
  };

  const handleReject = async (reportId: string, reason: string) => {
    try {
      const response = await fetch(`/api/admin/reports/${reportId}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-role": "content_moderator",
        },
        body: JSON.stringify({ reason }),
      });

      if (response.ok) {
        setReports((prev) =>
          prev.map((report) =>
            report.id === reportId ? { ...report, status: "rejected" as ReportStatus } : report
          )
        );
        if (selectedReport?.id === reportId) {
          setSelectedReport((prev) => (prev ? { ...prev, status: "rejected" } : null));
        }
      }
    } catch (err) {
      console.error("Failed to reject:", err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Stats calculation
  const stats = {
    total: pagination.total,
    pending: reports.filter((r) => r.status === "pending").length,
    verified: reports.filter((r) => r.status === "verified").length,
    rejected: reports.filter((r) => r.status === "rejected").length,
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title="Total Reports" value={stats.total} color="blue" />
        <StatCard title="Pending Review" value={stats.pending} color="yellow" />
        <StatCard title="Published" value={stats.verified} color="green" />
        <StatCard title="Rejected" value={stats.rejected} color="red" />
      </div>

      {/* Filters */}
      <div className="rounded-lg bg-white p-4 shadow">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Report Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as ReportType | "")}
              className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as ReportStatus | "")}
              className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilterType("");
                setFilterStatus("");
              }}
              className="rounded-lg bg-gray-100 px-4 py-2 text-gray-600 transition-colors hover:bg-gray-200"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Moderation Queue */}
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">Moderation Queue</h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <LoadingSpinner className="mx-auto h-8 w-8 text-blue-500" />
            <p className="mt-2 text-gray-500">Loading reports...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchReports}
              className="mt-4 rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center">
            <CheckIcon className="mx-auto mb-4 h-12 w-12 text-green-500" />
            <p className="text-gray-500">No reports to review</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {reports.map((report) => (
              <div
                key={report.id}
                className="cursor-pointer p-4 transition-colors hover:bg-gray-50"
                onClick={() => setSelectedReport(report)}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[report.reportType]}`}
                      >
                        {TYPE_LABELS[report.reportType]}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[report.status]}`}
                      >
                        {STATUS_LABELS[report.status]}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">
                        {report.evidence.length} evidence
                      </span>
                    </div>
                    <h3 className="font-medium text-gray-900">
                      Report about: {report.politicianName}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-500">{report.content}</p>
                  </div>
                  <div className="ml-4 flex-shrink-0 text-right">
                    {report.verificationResult && (
                      <p
                        className={`text-lg font-semibold ${getConfidenceColor(report.verificationResult.confidence)}`}
                      >
                        {(report.verificationResult.confidence * 100).toFixed(0)}%
                      </p>
                    )}
                    <p className="mt-2 text-sm text-gray-500">{formatDate(report.createdAt)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <p className="text-sm text-gray-500">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}{" "}
              results
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="rounded-lg border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page === pagination.totalPages}
                className="rounded-lg border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onPublish={handlePublish}
          onReject={handleReject}
        />
      )}
    </div>
  );
}

// ============================================
// Helper Functions
// ============================================

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) {
    return "text-green-600";
  }
  if (confidence >= 0.7) {
    return "text-yellow-600";
  }
  return "text-red-600";
}

// ============================================
// Sub-Components
// ============================================

interface StatCardProps {
  title: string;
  value: number;
  color: "blue" | "yellow" | "green" | "red";
}

function StatCard({ title, value, color }: StatCardProps) {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-700",
    green: "bg-green-50 border-green-200 text-green-700",
    red: "bg-red-50 border-red-200 text-red-700",
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <p className="text-sm font-medium opacity-80">{title}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

interface ReportDetailModalProps {
  report: ReportItem;
  onClose: () => void;
  onPublish: (id: string, notes?: string) => void;
  onReject: (id: string, reason: string) => void;
}

function ReportDetailModal({ report, onClose, onPublish, onReject }: ReportDetailModalProps) {
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"content" | "evidence" | "verification">("content");

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handlePublish = async () => {
    setIsSubmitting(true);
    await onPublish(report.id, notes);
    setIsSubmitting(false);
  };

  const handleReject = async () => {
    if (!notes.trim()) {
      alert("Please provide a reason for rejection");
      return;
    }
    setIsSubmitting(true);
    await onReject(report.id, notes);
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Report Details</h2>
            <p className="text-sm text-gray-500">About: {report.politicianName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab("content")}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === "content"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Content
          </button>
          <button
            onClick={() => setActiveTab("evidence")}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === "evidence"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Evidence ({report.evidence.length})
          </button>
          <button
            onClick={() => setActiveTab("verification")}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === "verification"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Verification
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "content" && (
            <div className="space-y-6">
              {/* Meta Info */}
              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${TYPE_COLORS[report.reportType]}`}
                >
                  {TYPE_LABELS[report.reportType]}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_COLORS[report.status]}`}
                >
                  {STATUS_LABELS[report.status]}
                </span>
              </div>

              {/* Politician Info */}
              <div className="flex items-center gap-4 rounded-lg bg-gray-50 p-4">
                {report.politicianPhoto ? (
                  <Image
                    src={report.politicianPhoto}
                    alt={report.politicianName}
                    width={64}
                    height={64}
                    sizes="64px"
                    unoptimized
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-300">
                    <UserIcon className="h-8 w-8 text-gray-500" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-gray-900">{report.politicianName}</h3>
                  <p className="text-sm text-gray-500">Politician ID: {report.politicianId}</p>
                </div>
              </div>

              {/* Report Content */}
              <div>
                <h4 className="mb-2 text-sm font-medium text-gray-700">Report Content</h4>
                <div className="rounded-lg bg-gray-50 p-4 whitespace-pre-wrap">
                  {report.content}
                </div>
              </div>

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Submitted:</span>
                  <span className="ml-2 text-gray-900">{formatDate(report.createdAt)}</span>
                </div>
                {report.reviewedAt && (
                  <div>
                    <span className="text-gray-500">Reviewed:</span>
                    <span className="ml-2 text-gray-900">{formatDate(report.reviewedAt)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "evidence" && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-700">Supporting Evidence</h4>
              {report.evidence.length === 0 ? (
                <p className="py-8 text-center text-gray-500">No evidence provided</p>
              ) : (
                <div className="space-y-3">
                  {report.evidence.map((evidence, index) => (
                    <EvidenceCard key={evidence.id} evidence={evidence} index={index + 1} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "verification" && (
            <div className="space-y-6">
              {report.verificationResult ? (
                <>
                  {/* Confidence Score */}
                  <div
                    className={`rounded-lg p-4 ${
                      report.verificationResult.confidence >= 0.9
                        ? "bg-green-50"
                        : report.verificationResult.confidence >= 0.7
                          ? "bg-yellow-50"
                          : "bg-red-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">AI Verification Confidence</p>
                        <p
                          className={`text-3xl font-bold ${getConfidenceColor(report.verificationResult.confidence)}`}
                        >
                          {(report.verificationResult.confidence * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">
                          Status: {report.verificationResult.status}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* AI Reasoning */}
                  <div>
                    <h4 className="mb-2 text-sm font-medium text-gray-700">
                      AI Verification Reasoning
                    </h4>
                    <p className="rounded-lg bg-gray-50 p-4 text-gray-600">
                      {report.verificationResult.reasoning}
                    </p>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center">
                  <WarningIcon className="mx-auto mb-4 h-12 w-12 text-yellow-500" />
                  <p className="text-gray-500">No AI verification result available</p>
                  <p className="mt-2 text-sm text-gray-400">Manual verification required</p>
                </div>
              )}

              {/* Verification Checklist */}
              <div>
                <h4 className="mb-2 text-sm font-medium text-gray-700">Verification Checklist</h4>
                <div className="space-y-2">
                  <VerificationCheckItem
                    label="Evidence provided"
                    checked={report.evidence.length > 0}
                  />
                  <VerificationCheckItem
                    label="Evidence links accessible"
                    checked={report.evidence.some((e) => e.url)}
                  />
                  <VerificationCheckItem
                    label="AI verification completed"
                    checked={!!report.verificationResult}
                  />
                  <VerificationCheckItem
                    label="High confidence score (≥70%)"
                    checked={
                      report.verificationResult
                        ? report.verificationResult.confidence >= 0.7
                        : false
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {/* Review Notes */}
          {report.status === "pending" && (
            <div className="mt-6 border-t border-gray-200 pt-6">
              <h4 className="mb-2 text-sm font-medium text-gray-700">Review Notes</h4>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about your review decision..."
                className="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {report.status === "pending" && (
          <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              onClick={onClose}
              className="rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={isSubmitting}
              className="rounded-lg bg-red-500 px-4 py-2 text-white transition-colors hover:bg-red-600 disabled:opacity-50"
            >
              {isSubmitting ? "Processing..." : "Reject"}
            </button>
            <button
              onClick={handlePublish}
              disabled={isSubmitting}
              className="rounded-lg bg-green-500 px-4 py-2 text-white transition-colors hover:bg-green-600 disabled:opacity-50"
            >
              {isSubmitting ? "Processing..." : "Publish"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface EvidenceCardProps {
  evidence: Evidence;
  index: number;
}

function EvidenceCard({ evidence, index }: EvidenceCardProps) {
  return (
    <div className="rounded-lg bg-gray-50 p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-600">
            {index}
          </span>
          <div>
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
              {EVIDENCE_TYPE_LABELS[evidence.type]}
            </span>
            {evidence.description && (
              <p className="mt-1 text-sm text-gray-600">{evidence.description}</p>
            )}
          </div>
        </div>
        <a
          href={evidence.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLinkIcon className="h-4 w-4" />
          View
        </a>
      </div>
      <div className="mt-2 pl-11">
        <p className="truncate text-xs text-gray-500">{evidence.url}</p>
      </div>
    </div>
  );
}

interface VerificationCheckItemProps {
  label: string;
  checked: boolean;
}

function VerificationCheckItem({ label, checked }: VerificationCheckItemProps) {
  return (
    <div className="flex items-center gap-2">
      {checked ? (
        <CheckCircleIcon className="h-5 w-5 text-green-500" />
      ) : (
        <XCircleIcon className="h-5 w-5 text-gray-300" />
      )}
      <span className={checked ? "text-gray-900" : "text-gray-500"}>{label}</span>
    </div>
  );
}

// ============================================
// Icons
// ============================================

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

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

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
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

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
