/**
 * Bills Section Component
 *
 * Displays bills authored by a politician with filtering and sorting.
 * Requirements: 3.1, 3.2, 3.4, 3.5, 3.6, 3.7
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { BillStatus, BillAuthorRole } from "@prisma/client";
import type {
  BillSummary,
  BillFilters,
  BillSortField,
  SortOrder,
} from "@/services/legislative.service";
import { BillDetailsModal } from "./BillDetailsModal";
import type { ReleasedProfileContext } from "@/lib/release-data";
import { formatReviewedDate } from "../../components/ReviewedMembership";

interface BillsSectionProps {
  politicianId: string;
  initialBills?: BillSummary[];
  totalCount?: number;
  reviewedBatch?: ReleasedProfileContext;
}

export function BillsSection({
  politicianId,
  initialBills = [],
  totalCount = 0,
  reviewedBatch,
}: BillsSectionProps) {
  const [bills, setBills] = useState<BillSummary[]>(initialBills);
  const [total, setTotal] = useState(totalCount);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);

  // Filters - Requirement 3.5
  const [statusFilter, setStatusFilter] = useState<BillStatus | "">("");
  const [authorRoleFilter, setAuthorRoleFilter] = useState<BillAuthorRole | "">("");

  // Sorting - Requirement 3.6
  const [sortField, setSortField] = useState<BillSortField>("filingDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const pageSize = 10;
  const hasMounted = useRef(false);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const filters: BillFilters = {};
      if (statusFilter) {
        filters.status = statusFilter;
      }
      if (authorRoleFilter) {
        filters.authorRole = authorRoleFilter;
      }

      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortField,
        sortOrder,
        ...(statusFilter && { status: statusFilter }),
        ...(authorRoleFilter && { authorRole: authorRoleFilter }),
      });

      const response = await fetch(`/api/politicians/${politicianId}/bills?${params}`);
      if (response.ok) {
        const data = await response.json();
        setBills(data.items);
        setTotal(data.totalCount);
      }
    } catch (error) {
      console.error("Failed to fetch bills:", error);
    } finally {
      setLoading(false);
    }
  }, [politicianId, page, statusFilter, authorRoleFilter, sortField, sortOrder]);

  useEffect(() => {
    if (!reviewedBatch && initialBills.length === 0) {
      fetchBills();
    }
  }, []);

  // Refetch when page, filters, or sort changes
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    fetchBills();
  }, [page, statusFilter, authorRoleFilter, sortField, sortOrder]);

  const handleFilterChange = () => {
    setPage(1);
  };

  const handleSort = (field: BillSortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div id="selected-filings" className="card">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
            {reviewedBatch ? "Selected Senate Filings" : "Bills Authored"}
          </h2>
          <p className="text-sm text-neutral-500">
            {reviewedBatch
              ? `${total} reviewed filing${total !== 1 ? "s" : ""} in this profile’s ${reviewedBatch.congress}th Congress sample. Career totals and enactment are unverified.`
              : `${total} bill${total !== 1 ? "s" : ""} authored or co-authored`}
          </p>
        </div>

        {!reviewedBatch && (
          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as BillStatus | "");
                handleFilterChange();
              }}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            >
              <option value="">All Status</option>
              <option value={BillStatus.pending}>Pending</option>
              <option value={BillStatus.passed}>Passed</option>
              <option value={BillStatus.vetoed}>Vetoed</option>
              <option value={BillStatus.lapsed}>Lapsed</option>
            </select>

            {/* Requirement 3.7 - Distinguish principal vs co-author */}
            <select
              value={authorRoleFilter}
              onChange={(e) => {
                setAuthorRoleFilter(e.target.value as BillAuthorRole | "");
                handleFilterChange();
              }}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            >
              <option value="">All Roles</option>
              <option value={BillAuthorRole.principal_author}>Principal Author</option>
              <option value={BillAuthorRole.co_author}>Co-Author</option>
            </select>
          </div>
        )}
      </div>

      {/* Bills Table */}
      {bills.length === 0 && !loading ? (
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="mt-4 text-neutral-500">
            {reviewedBatch ? "No filings in this reviewed sample" : "No bills found"}
          </p>
        </div>
      ) : (
        <>
          <div className="relative">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 dark:bg-neutral-900/60">
                <div className="border-t-primary-500 h-6 w-6 animate-spin rounded-full border-2 border-neutral-300" />
              </div>
            )}
            <div className={`overflow-x-auto ${loading ? "pointer-events-none" : ""}`}>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <SortableHeader
                      label="Bill Number"
                      field="title"
                      currentField={sortField}
                      currentOrder={sortOrder}
                      onSort={handleSort}
                    />
                    <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">
                      Title
                    </th>
                    <SortableHeader
                      label="Filed"
                      field="filingDate"
                      currentField={sortField}
                      currentOrder={sortOrder}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Status"
                      field="status"
                      currentField={sortField}
                      currentOrder={sortOrder}
                      onSort={handleSort}
                    />
                    <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">
                      Role
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-neutral-500">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                  {bills.map((bill) => (
                    <BillRow
                      key={bill.id}
                      bill={bill}
                      onViewDetails={() => setSelectedBillId(bill.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-neutral-200 pt-4 dark:border-neutral-700">
              <p className="text-sm text-neutral-500">
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}{" "}
                bills
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-neutral-200 px-3 py-1 text-sm disabled:opacity-50 dark:border-neutral-700"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-neutral-200 px-3 py-1 text-sm disabled:opacity-50 dark:border-neutral-700"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Bill Details Modal - Requirement 3.3 */}
      {selectedBillId && (
        <BillDetailsModal billId={selectedBillId} onClose={() => setSelectedBillId(null)} />
      )}
    </div>
  );
}

interface SortableHeaderProps {
  label: string;
  field: BillSortField;
  currentField: BillSortField;
  currentOrder: SortOrder;
  onSort: (field: BillSortField) => void;
}

function SortableHeader({ label, field, currentField, currentOrder, onSort }: SortableHeaderProps) {
  const isActive = currentField === field;

  return (
    <th className="px-4 py-3 text-left">
      <button
        onClick={() => onSort(field)}
        className="flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
      >
        {label}
        <svg
          className={`h-4 w-4 ${isActive ? "text-primary-500" : "text-neutral-300"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          {isActive && currentOrder === "asc" ? (
            <path
              fillRule="evenodd"
              d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          ) : (
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          )}
        </svg>
      </button>
    </th>
  );
}

interface BillRowProps {
  bill: BillSummary;
  onViewDetails: () => void;
}

function BillRow({ bill, onViewDetails }: BillRowProps) {
  const statusConfig = getStatusConfig(bill.status);

  return (
    <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-800">
      <td className="px-4 py-3">
        <span className="font-mono text-sm text-neutral-900 dark:text-white">
          {bill.billNumber}
        </span>
        {/* Requirement 3.4 - Show Republic Act number if passed */}
        {bill.republicActNumber && (
          <span className="badge-success ml-2 text-xs">RA {bill.republicActNumber}</span>
        )}
      </td>
      <td className="max-w-xs px-4 py-3">
        <p className="truncate text-sm text-neutral-900 dark:text-white">{bill.title}</p>
        {bill.summary && <p className="mt-1 truncate text-xs text-neutral-500">{bill.summary}</p>}
      </td>
      <td className="px-4 py-3 text-sm text-neutral-500">
        {bill.reviewedBatch?.filingDate
          ? formatReviewedDate(bill.reviewedBatch.filingDate)
          : bill.filingDate
            ? formatDate(bill.filingDate)
            : "Not verified"}
      </td>
      <td className="px-4 py-3">
        <span className={`badge ${statusConfig.badgeClass}`} title={statusConfig.tooltip}>
          {statusConfig.label}
        </span>
      </td>
      <td className="px-4 py-3">
        {/* Requirement 3.7 - Distinguish principal vs co-author */}
        <span
          className={`badge ${
            bill.authorRole === BillAuthorRole.principal_author
              ? "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300"
              : "bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300"
          }`}
        >
          {bill.reviewedBatch || bill.authorRole === BillAuthorRole.introduced_by
            ? "Introducer"
            : bill.authorRole === BillAuthorRole.principal_author
              ? "Principal"
              : "Co-Author"}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        {/* Requirement 3.3 - Click to view full bill content */}
        <button onClick={onViewDetails} className="text-primary-500 hover:text-primary-600 text-sm">
          View Details
        </button>
      </td>
    </tr>
  );
}

function getStatusConfig(status: BillStatus | null) {
  if (status === null) {
    return {
      label: "Status unknown",
      badgeClass: "bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300",
      tooltip: "Current legislative status and enactment are unverified.",
    };
  }

  const configs: Record<BillStatus, { label: string; badgeClass: string; tooltip: string }> = {
    [BillStatus.pending]: {
      label: "Pending",
      badgeClass: "bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-300",
      tooltip: "This bill is still being deliberated in the current Congress.",
    },
    [BillStatus.passed]: {
      label: "Passed",
      badgeClass: "bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300",
      tooltip: "This bill was approved and signed into law (Republic Act).",
    },
    [BillStatus.vetoed]: {
      label: "Vetoed",
      badgeClass: "bg-error-100 text-error-700 dark:bg-error-900 dark:text-error-300",
      tooltip: "This bill was rejected by the President.",
    },
    [BillStatus.lapsed]: {
      label: "Lapsed",
      badgeClass: "bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300",
      tooltip: "This bill was not passed before the Congress ended and is no longer active.",
    },
    [BillStatus.withdrawn]: {
      label: "Withdrawn",
      badgeClass: "bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400",
      tooltip: "This bill was withdrawn by its author(s).",
    },
  };

  return configs[status];
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
