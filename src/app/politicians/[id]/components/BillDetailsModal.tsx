/**
 * Bill Details Modal Component
 *
 * Displays full bill content including authors and sources.
 * Requirement: 3.3 - Navigate to detailed view showing full bill content
 */

"use client";

import { useState, useEffect } from "react";
import { BillStatus, BillAuthorRole } from "@prisma/client";
import type { BillDetails } from "@/services/legislative.service";
import { SourceTooltip } from "./SourceTooltip";
import { ReviewedFilingEvidence } from "./ReviewedFilingEvidence";
import { formatReviewedDate } from "../../components/ReviewedMembership";

interface BillDetailsModalProps {
  billId: string;
  onClose: () => void;
}

export function BillDetailsModal({ billId, onClose }: BillDetailsModalProps) {
  const [bill, setBill] = useState<BillDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBill() {
      try {
        const response = await fetch(`/api/bills/${billId}`);
        if (response.ok) {
          const data = await response.json();
          setBill(data);
        } else {
          setError("Failed to load bill details");
        }
      } catch {
        setError("Failed to load bill details");
      } finally {
        setLoading(false);
      }
    }

    fetchBill();
  }, [billId]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bill-details-title"
        className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-xl dark:bg-neutral-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-700">
          <h2
            id="bill-details-title"
            className="text-lg font-semibold text-neutral-900 dark:text-white"
          >
            Bill Details
          </h2>
          <button
            onClick={onClose}
            aria-label="Close bill details"
            className="rounded-lg p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <svg
              className="h-5 w-5 text-neutral-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[calc(90vh-120px)] overflow-y-auto p-6">
          {loading ? (
            <BillDetailsSkeleton />
          ) : error ? (
            <div className="bg-error-50 dark:bg-error-900/20 rounded-lg p-4 text-center">
              <p className="text-error-600 dark:text-error-400">{error}</p>
            </div>
          ) : bill ? (
            <BillDetailsContent bill={bill} />
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-neutral-200 p-4 dark:border-neutral-700">
          <button onClick={onClose} className="btn-primary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function BillDetailsContent({ bill }: { bill: BillDetails }) {
  const [showSources, setShowSources] = useState(false);
  const statusConfig = getStatusConfig(bill.status);
  const batch = bill.reviewedBatch;

  return (
    <div className="space-y-6">
      {/* Bill Header */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-lg font-semibold text-neutral-900 dark:text-white">
            {bill.billNumber}
          </span>
          <span className={`badge ${statusConfig.badgeClass}`} title={statusConfig.tooltip}>
            {statusConfig.label}
          </span>
          {/* Requirement 3.4 - Show Republic Act number */}
          {bill.republicActNumber && (
            <span className="badge-success">Republic Act {bill.republicActNumber}</span>
          )}
        </div>
        <h3 className="mt-2 text-xl font-bold text-neutral-900 dark:text-white">{bill.title}</h3>
        {batch && (
          <p className="mt-2 text-sm text-neutral-500">{batch.titleType}. Enactment unverified.</p>
        )}
      </div>

      {/* Metadata */}
      <div className="grid gap-4 rounded-lg bg-neutral-50 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:bg-neutral-800">
        <MetadataItem label="Chamber" value={formatChamber(bill.chamber)} />
        <MetadataItem label="Congress" value={`${bill.congress}th Congress`} />
        <MetadataItem
          label="Session"
          value={
            bill.session === null
              ? "Not verified"
              : `${bill.session}${getOrdinalSuffix(bill.session)} Session`
          }
        />
        <MetadataItem
          label="Filed"
          value={
            batch?.filingDate
              ? formatReviewedDate(batch.filingDate)
              : bill.filingDate
                ? formatDate(bill.filingDate)
                : "Not verified"
          }
        />
      </div>

      {batch ? (
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-neutral-500 uppercase">
              Introducer on the filed document
            </h4>
            <a
              className="text-primary-600 dark:text-primary-400 underline"
              href={`/politicians/${batch.introducedBy.profileId}`}
            >
              {batch.introducedBy.name}
            </a>
          </div>
          {batch.additionalIndexAuthors.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-neutral-500 uppercase">
                Additional names in the Senate index
              </h4>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {batch.additionalIndexAuthors.map((author) => (
                  <li key={author.name}>{author.name}. Role and addition date unverified.</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div>
          <h4 className="mb-3 text-sm font-semibold text-neutral-500 uppercase">Authors</h4>
          <div className="flex flex-wrap gap-2">
            {bill.authors.map((author) => (
              <a
                key={author.politicianId}
                href={`/politicians/${author.politicianId}`}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${
                  author.role === BillAuthorRole.principal_author
                    ? "bg-primary-100 text-primary-700 hover:bg-primary-200 dark:bg-primary-900 dark:text-primary-300"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-300"
                }`}
              >
                {author.politicianName}
                <span className="text-xs opacity-75">
                  (
                  {author.role === BillAuthorRole.introduced_by
                    ? "Introducer"
                    : author.role === BillAuthorRole.principal_author
                      ? "Principal"
                      : "Co-Author"}
                  )
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Summary - Requirement 3.2 */}
      {bill.summary && (
        <div>
          <h4 className="mb-3 text-sm font-semibold text-neutral-500 uppercase">Summary</h4>
          <p className="text-neutral-700 dark:text-neutral-300">{bill.summary}</p>
        </div>
      )}

      {/* Full Text - Requirement 3.3 */}
      {bill.fullText && (
        <div>
          <h4 className="mb-3 text-sm font-semibold text-neutral-500 uppercase">Full Text</h4>
          <div className="max-h-96 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800">
            <pre className="font-sans text-sm whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
              {bill.fullText}
            </pre>
          </div>
        </div>
      )}

      {batch && <ReviewedFilingEvidence batch={batch} />}

      {/* Sources */}
      {!batch && bill.sources.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowSources(!showSources)}
            className="text-primary-500 hover:text-primary-600 flex items-center gap-2 text-sm"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            View Source Attribution ({bill.sources.length} source
            {bill.sources.length !== 1 ? "s" : ""})
          </button>
          {showSources && (
            <div className="mt-2">
              <SourceTooltip sources={bill.sources} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface MetadataItemProps {
  label: string;
  value: string;
}

function MetadataItem({ label, value }: MetadataItemProps) {
  return (
    <div>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="font-medium text-neutral-900 dark:text-white">{value}</p>
    </div>
  );
}

function BillDetailsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
      <div className="h-6 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
      <div className="grid gap-4 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
        ))}
      </div>
      <div className="h-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
    </div>
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

function formatChamber(chamber: string): string {
  return chamber === "senate" ? "Senate" : "House of Representatives";
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0] || "th";
}
