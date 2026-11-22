/**
 * Data Review Dashboard Component
 *
 * Admin dashboard for reviewing AI verification decisions and manually verifying data.
 *
 * Requirements: 35.8, 35.9, 39.4
 */

"use client";

import { useState, useEffect, useCallback } from "react";

// ============================================
// Types
// ============================================

type DataSubmissionType = "politician" | "bill" | "controversy" | "saln" | "project";
type ReviewPriority = "low" | "medium" | "high";
type ReviewStatus = "pending" | "approved" | "rejected";

interface VerificationSource {
  name: string;
  url?: string;
  matchScore: number;
  matchedFields: string[];
}

interface ReviewItem {
  id: string;
  submissionId: string;
  type: DataSubmissionType;
  data: Record<string, unknown>;
  confidence: number;
  reasoning: string;
  sources: VerificationSource[];
  isDuplicate: boolean;
  duplicateOf?: string;
  priority: ReviewPriority;
  assignedTo?: string;
  status: ReviewStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  submittedBy?: string;
  submittedByType: string;
  createdAt: string;
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

const TYPE_LABELS: Record<DataSubmissionType, string> = {
  politician: "Politician",
  bill: "Bill",
  controversy: "Controversy",
  saln: "SALN",
  project: "Project",
};

const PRIORITY_LABELS: Record<ReviewPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const TYPE_COLORS: Record<DataSubmissionType, string> = {
  politician: "bg-blue-100 text-blue-800",
  bill: "bg-green-100 text-green-800",
  controversy: "bg-red-100 text-red-800",
  saln: "bg-purple-100 text-purple-800",
  project: "bg-orange-100 text-orange-800",
};

const PRIORITY_COLORS: Record<ReviewPriority, string> = {
  low: "bg-gray-100 text-gray-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-red-100 text-red-800",
};

const STATUS_COLORS: Record<ReviewStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

// ============================================
// Main Component
// ============================================

export function DataReviewDashboard() {
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
  const [filterType, setFilterType] = useState<DataSubmissionType | "">("");
  const [filterPriority, setFilterPriority] = useState<ReviewPriority | "">("");
  const [filterStatus, setFilterStatus] = useState<ReviewStatus | "">("");

  const fetchReviewItems = useCallback(async () => {
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
      if (filterPriority) {
        params.append("priority", filterPriority);
      }
      if (filterStatus) {
        params.append("status", filterStatus);
      }

      const response = await fetch(`/api/admin/data-review?${params}`, {
        headers: {
          "x-admin-role": "data_reviewer",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch review items");
      }

      const data = await response.json();
      setReviewItems(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, filterType, filterPriority, filterStatus]);

  useEffect(() => {
    fetchReviewItems();
  }, [fetchReviewItems]);

  const handleApprove = async (itemId: string, notes?: string) => {
    try {
      const response = await fetch(`/api/admin/data-review/${itemId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-role": "data_reviewer",
        },
        body: JSON.stringify({ notes }),
      });

      if (response.ok) {
        setReviewItems((prev) =>
          prev.map((item) =>
            item.id === itemId ? { ...item, status: "approved" as ReviewStatus } : item
          )
        );
        if (selectedItem?.id === itemId) {
          setSelectedItem((prev) => (prev ? { ...prev, status: "approved" } : null));
        }
      }
    } catch (err) {
      console.error("Failed to approve:", err);
    }
  };

  const handleReject = async (itemId: string, notes: string) => {
    try {
      const response = await fetch(`/api/admin/data-review/${itemId}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-role": "data_reviewer",
        },
        body: JSON.stringify({ notes }),
      });

      if (response.ok) {
        setReviewItems((prev) =>
          prev.map((item) =>
            item.id === itemId ? { ...item, status: "rejected" as ReviewStatus } : item
          )
        );
        if (selectedItem?.id === itemId) {
          setSelectedItem((prev) => (prev ? { ...prev, status: "rejected" } : null));
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

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) {
      return "text-green-600";
    }
    if (confidence >= 0.7) {
      return "text-yellow-600";
    }
    return "text-red-600";
  };

  // Stats calculation
  const stats = {
    total: pagination.total,
    pending: reviewItems.filter((item) => item.status === "pending").length,
    highPriority: reviewItems.filter((item) => item.priority === "high").length,
    duplicates: reviewItems.filter((item) => item.isDuplicate).length,
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title="Total Items" value={stats.total} color="blue" />
        <StatCard title="Pending Review" value={stats.pending} color="yellow" />
        <StatCard title="High Priority" value={stats.highPriority} color="red" />
        <StatCard title="Duplicates" value={stats.duplicates} color="purple" />
      </div>

      {/* Filters */}
      <div className="rounded-lg bg-white p-4 shadow">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as DataSubmissionType | "")}
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Priority</label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as ReviewPriority | "")}
              className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Priorities</option>
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
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
              onChange={(e) => setFilterStatus(e.target.value as ReviewStatus | "")}
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
        </div>
      </div>

      {/* Review Queue */}
      <div className="overflow-hidden rounded-lg bg-white shadow">
        {isLoading ? (
          <div className="p-8 text-center">
            <LoadingSpinner className="mx-auto h-8 w-8 text-blue-500" />
            <p className="mt-2 text-gray-500">Loading review items...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchReviewItems}
              className="mt-4 rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
        ) : reviewItems.length === 0 ? (
          <div className="p-8 text-center">
            <CheckIcon className="mx-auto mb-4 h-12 w-12 text-green-500" />
            <p className="text-gray-500">No items pending review</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {reviewItems.map((item) => (
              <div
                key={item.id}
                className="cursor-pointer p-4 transition-colors hover:bg-gray-50"
                onClick={() => setSelectedItem(item)}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[item.type]}`}
                      >
                        {TYPE_LABELS[item.type]}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[item.priority]}`}
                      >
                        {PRIORITY_LABELS[item.priority]}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status]}`}
                      >
                        {STATUS_LABELS[item.status]}
                      </span>
                      {item.isDuplicate && (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                          Duplicate
                        </span>
                      )}
                    </div>
                    <h3 className="truncate font-medium text-gray-900">{getItemTitle(item)}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-500">{item.reasoning}</p>
                  </div>
                  <div className="ml-4 flex-shrink-0 text-right">
                    <p className={`text-lg font-semibold ${getConfidenceColor(item.confidence)}`}>
                      {(item.confidence * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-gray-500">confidence</p>
                    <p className="mt-2 text-sm text-gray-500">{formatDate(item.createdAt)}</p>
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
      {selectedItem && (
        <ReviewDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  );
}

// ============================================
// Helper Functions
// ============================================

function getItemTitle(item: ReviewItem): string {
  const data = item.data;
  switch (item.type) {
    case "politician":
      return (data.fullName as string) || (data.name as string) || "Unknown Politician";
    case "bill":
      return (data.title as string) || (data.billNumber as string) || "Unknown Bill";
    case "controversy":
      return (data.title as string) || "Unknown Controversy";
    case "saln":
      return `SALN ${data.year || "Unknown Year"}`;
    case "project":
      return (data.name as string) || "Unknown Project";
    default:
      return "Unknown Item";
  }
}

// ============================================
// Sub-Components
// ============================================

interface StatCardProps {
  title: string;
  value: number;
  color: "blue" | "yellow" | "red" | "purple";
}

function StatCard({ title, value, color }: StatCardProps) {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-700",
    red: "bg-red-50 border-red-200 text-red-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700",
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <p className="text-sm font-medium opacity-80">{title}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

interface ReviewDetailModalProps {
  item: ReviewItem;
  onClose: () => void;
  onApprove: (id: string, notes?: string) => void;
  onReject: (id: string, notes: string) => void;
}

function ReviewDetailModal({ item, onClose, onApprove, onReject }: ReviewDetailModalProps) {
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) {
      return "text-green-600 bg-green-50";
    }
    if (confidence >= 0.7) {
      return "text-yellow-600 bg-yellow-50";
    }
    return "text-red-600 bg-red-50";
  };

  const handleApprove = async () => {
    setIsSubmitting(true);
    await onApprove(item.id, notes);
    setIsSubmitting(false);
  };

  const handleReject = async () => {
    if (!notes.trim()) {
      alert("Please provide a reason for rejection");
      return;
    }
    setIsSubmitting(true);
    await onReject(item.id, notes);
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Review Details</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* Meta Info */}
          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${TYPE_COLORS[item.type]}`}
            >
              {TYPE_LABELS[item.type]}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${PRIORITY_COLORS[item.priority]}`}
            >
              {PRIORITY_LABELS[item.priority]} Priority
            </span>
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_COLORS[item.status]}`}
            >
              {STATUS_LABELS[item.status]}
            </span>
            {item.isDuplicate && (
              <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-800">
                Potential Duplicate
              </span>
            )}
          </div>

          {/* Confidence Score */}
          <div className={`rounded-lg p-4 ${getConfidenceColor(item.confidence)}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">AI Confidence Score</p>
                <p className="text-3xl font-bold">{(item.confidence * 100).toFixed(1)}%</p>
              </div>
              <div className="text-right">
                <p className="text-sm">Submitted: {formatDate(item.createdAt)}</p>
                <p className="text-sm">By: {item.submittedByType}</p>
              </div>
            </div>
          </div>

          {/* AI Reasoning */}
          <div>
            <h4 className="mb-2 text-sm font-medium text-gray-700">AI Verification Reasoning</h4>
            <p className="rounded-lg bg-gray-50 p-4 text-gray-600">{item.reasoning}</p>
          </div>

          {/* Duplicate Warning */}
          {item.isDuplicate && item.duplicateOf && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
              <h4 className="mb-1 text-sm font-medium text-orange-800">Duplicate Detected</h4>
              <p className="text-sm text-orange-700">
                This submission may be a duplicate of existing entry: {item.duplicateOf}
              </p>
            </div>
          )}

          {/* Verification Sources */}
          {item.sources && item.sources.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-gray-700">Verification Sources</h4>
              <div className="space-y-2">
                {item.sources.map((source, index) => (
                  <div key={index} className="rounded-lg bg-gray-50 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{source.name}</p>
                        {source.url && (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline"
                          >
                            {source.url}
                          </a>
                        )}
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-semibold ${source.matchScore >= 0.7 ? "text-green-600" : "text-yellow-600"}`}
                        >
                          {(source.matchScore * 100).toFixed(0)}% match
                        </p>
                      </div>
                    </div>
                    {source.matchedFields.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {source.matchedFields.map((field, i) => (
                          <span
                            key={i}
                            className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-700"
                          >
                            {field}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submission Data */}
          <div>
            <h4 className="mb-2 text-sm font-medium text-gray-700">Submission Data</h4>
            <div className="overflow-x-auto rounded-lg bg-gray-50 p-4">
              <pre className="text-sm whitespace-pre-wrap text-gray-700">
                {JSON.stringify(item.data, null, 2)}
              </pre>
            </div>
          </div>

          {/* Review Notes */}
          {item.status === "pending" && (
            <div>
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

          {/* Previous Review Notes */}
          {item.reviewNotes && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-gray-700">Previous Review Notes</h4>
              <p className="rounded-lg bg-gray-50 p-4 text-gray-600">{item.reviewNotes}</p>
              {item.reviewedAt && (
                <p className="mt-2 text-sm text-gray-500">
                  Reviewed on {formatDate(item.reviewedAt)} by {item.reviewedBy || "Unknown"}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {item.status === "pending" && (
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
              onClick={handleApprove}
              disabled={isSubmitting}
              className="rounded-lg bg-green-500 px-4 py-2 text-white transition-colors hover:bg-green-600 disabled:opacity-50"
            >
              {isSubmitting ? "Processing..." : "Approve & Publish"}
            </button>
          </div>
        )}
      </div>
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
