/**
 * Feedback Dashboard Component
 *
 * Admin dashboard for reviewing and managing user feedback.
 *
 * Requirements: 43.5
 */

"use client";

import { useState, useEffect, useCallback } from "react";

// ============================================
// Types
// ============================================

type FeedbackCategory =
  | "bug_report"
  | "feature_suggestion"
  | "data_correction"
  | "general_feedback";
type FeedbackStatus = "pending" | "reviewed" | "resolved" | "dismissed";

interface FeedbackAttachment {
  name: string;
  type: string;
  dataUrl: string;
}

interface FeedbackItem {
  id: string;
  category: FeedbackCategory;
  subject: string;
  description: string;
  attachments: FeedbackAttachment[];
  isAnonymous: boolean;
  email?: string;
  userId?: string;
  userAgent?: string;
  status: FeedbackStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  adminNotes?: string;
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

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug_report: "Bug Report",
  feature_suggestion: "Feature Suggestion",
  data_correction: "Data Correction",
  general_feedback: "General Feedback",
};

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  pending: "Pending",
  reviewed: "Reviewed",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

const CATEGORY_COLORS: Record<FeedbackCategory, string> = {
  bug_report: "bg-red-100 text-red-800",
  feature_suggestion: "bg-blue-100 text-blue-800",
  data_correction: "bg-yellow-100 text-yellow-800",
  general_feedback: "bg-gray-100 text-gray-800",
};

const STATUS_COLORS: Record<FeedbackStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  reviewed: "bg-blue-100 text-blue-800",
  resolved: "bg-green-100 text-green-800",
  dismissed: "bg-gray-100 text-gray-800",
};

// ============================================
// Main Component
// ============================================

export function FeedbackDashboard() {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [filterCategory, setFilterCategory] = useState<FeedbackCategory | "">("");
  const [filterStatus, setFilterStatus] = useState<FeedbackStatus | "">("");

  const fetchFeedbacks = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (filterCategory) {
        params.append("category", filterCategory);
      }
      if (filterStatus) {
        params.append("status", filterStatus);
      }

      const response = await fetch(`/api/feedback?${params}`, {
        headers: {
          "x-admin-role": "super_admin", // In production, this would come from auth
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch feedback");
      }

      const data = await response.json();
      setFeedbacks(data.feedbacks);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, filterCategory, filterStatus]);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  const handleStatusChange = async (feedbackId: string, newStatus: FeedbackStatus) => {
    try {
      const response = await fetch(`/api/feedback/${feedbackId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-role": "super_admin",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setFeedbacks((prev) =>
          prev.map((f) => (f.id === feedbackId ? { ...f, status: newStatus } : f))
        );
        if (selectedFeedback?.id === feedbackId) {
          setSelectedFeedback((prev) => (prev ? { ...prev, status: newStatus } : null));
        }
      }
    } catch (err) {
      console.error("Failed to update status:", err);
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
    pending: feedbacks.filter((f) => f.status === "pending").length,
    bugReports: feedbacks.filter((f) => f.category === "bug_report").length,
    featureSuggestions: feedbacks.filter((f) => f.category === "feature_suggestion").length,
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title="Total Feedback" value={stats.total} color="blue" />
        <StatCard title="Pending Review" value={stats.pending} color="yellow" />
        <StatCard title="Bug Reports" value={stats.bugReports} color="red" />
        <StatCard title="Feature Suggestions" value={stats.featureSuggestions} color="green" />
      </div>

      {/* Filters */}
      <div className="rounded-lg bg-white p-4 shadow">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as FeedbackCategory | "")}
              className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
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
              onChange={(e) => setFilterStatus(e.target.value as FeedbackStatus | "")}
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

      {/* Feedback List */}
      <div className="overflow-hidden rounded-lg bg-white shadow">
        {isLoading ? (
          <div className="p-8 text-center">
            <LoadingSpinner className="mx-auto h-8 w-8 text-blue-500" />
            <p className="mt-2 text-gray-500">Loading feedback...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchFeedbacks}
              className="mt-4 rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">No feedback found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {feedbacks.map((feedback) => (
              <div
                key={feedback.id}
                className="cursor-pointer p-4 transition-colors hover:bg-gray-50"
                onClick={() => setSelectedFeedback(feedback)}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          CATEGORY_COLORS[feedback.category]
                        }`}
                      >
                        {CATEGORY_LABELS[feedback.category]}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_COLORS[feedback.status]
                        }`}
                      >
                        {STATUS_LABELS[feedback.status]}
                      </span>
                      {feedback.isAnonymous && (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
                          Anonymous
                        </span>
                      )}
                    </div>
                    <h3 className="truncate font-medium text-gray-900">{feedback.subject}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                      {feedback.description}
                    </p>
                  </div>
                  <div className="ml-4 flex-shrink-0 text-right">
                    <p className="text-sm text-gray-500">{formatDate(feedback.createdAt)}</p>
                    {feedback.attachments.length > 0 && (
                      <p className="mt-1 text-xs text-gray-400">
                        {feedback.attachments.length} attachment(s)
                      </p>
                    )}
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
      {selectedFeedback && (
        <FeedbackDetailModal
          feedback={selectedFeedback}
          onClose={() => setSelectedFeedback(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}

// ============================================
// Sub-Components
// ============================================

interface StatCardProps {
  title: string;
  value: number;
  color: "blue" | "yellow" | "red" | "green";
}

function StatCard({ title, value, color }: StatCardProps) {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-700",
    red: "bg-red-50 border-red-200 text-red-700",
    green: "bg-green-50 border-green-200 text-green-700",
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <p className="text-sm font-medium opacity-80">{title}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

interface FeedbackDetailModalProps {
  feedback: FeedbackItem;
  onClose: () => void;
  onStatusChange: (id: string, status: FeedbackStatus) => void;
}

function FeedbackDetailModal({ feedback, onClose, onStatusChange }: FeedbackDetailModalProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Feedback Details</h2>
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
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                CATEGORY_COLORS[feedback.category]
              }`}
            >
              {CATEGORY_LABELS[feedback.category]}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                STATUS_COLORS[feedback.status]
              }`}
            >
              {STATUS_LABELS[feedback.status]}
            </span>
            {feedback.isAnonymous && (
              <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800">
                Anonymous
              </span>
            )}
          </div>

          {/* Subject */}
          <div>
            <h3 className="text-xl font-semibold text-gray-900">{feedback.subject}</h3>
            <p className="mt-1 text-sm text-gray-500">
              Submitted on {formatDate(feedback.createdAt)}
            </p>
          </div>

          {/* Description */}
          <div>
            <h4 className="mb-2 text-sm font-medium text-gray-700">Description</h4>
            <p className="whitespace-pre-wrap text-gray-600">{feedback.description}</p>
          </div>

          {/* Contact Info */}
          {!feedback.isAnonymous && feedback.email && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-gray-700">Contact</h4>
              <p className="text-gray-600">{feedback.email}</p>
            </div>
          )}

          {/* Attachments */}
          {feedback.attachments.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-gray-700">
                Attachments ({feedback.attachments.length})
              </h4>
              <div className="space-y-2">
                {feedback.attachments.map((attachment, index) => (
                  <div key={index} className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
                    {attachment.type.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={attachment.dataUrl}
                        alt={attachment.name}
                        className="h-16 w-16 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded bg-gray-200">
                        <DocumentIcon className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-900">{attachment.name}</p>
                      <p className="text-sm text-gray-500">{attachment.type}</p>
                    </div>
                    <a
                      href={attachment.dataUrl}
                      download={attachment.name}
                      className="rounded bg-blue-500 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-600"
                    >
                      Download
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User Agent */}
          {feedback.userAgent && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-gray-700">Browser Info</h4>
              <p className="font-mono text-sm text-gray-500">{feedback.userAgent}</p>
            </div>
          )}

          {/* Status Update */}
          <div>
            <h4 className="mb-2 text-sm font-medium text-gray-700">Update Status</h4>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STATUS_LABELS) as FeedbackStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => onStatusChange(feedback.id, status)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    feedback.status === status
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          </div>
        </div>
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

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
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
