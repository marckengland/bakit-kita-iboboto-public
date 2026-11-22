/**
 * SALN Detail Modal Component
 *
 * Displays detailed SALN breakdown including real properties, personal properties,
 * investments, and anomaly details.
 * Requirement: 15.6 - Allow viewing detailed SALN breakdown
 */

"use client";

import { useState, useEffect } from "react";
import { SALNRecordData } from "@/services/saln.service";

interface SALNDetailModalProps {
  recordId: string;
  onClose: () => void;
}

export function SALNDetailModal({ recordId, onClose }: SALNDetailModalProps) {
  const [record, setRecord] = useState<SALNRecordData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "real" | "personal" | "investments">(
    "overview"
  );

  useEffect(() => {
    async function fetchRecord() {
      try {
        const response = await fetch(`/api/saln/${recordId}`);
        if (response.ok) {
          const data = await response.json();
          setRecord(data);
        }
      } catch (error) {
        console.error("Failed to fetch SALN record:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchRecord();
  }, [recordId]);

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
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-xl dark:bg-neutral-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-700">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
              SALN Details {record && `- ${record.year}`}
            </h2>
            <p className="text-sm text-neutral-500">
              Statement of Assets, Liabilities, and Net Worth
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="max-h-[calc(90vh-120px)] overflow-y-auto p-4">
          {loading ? (
            <DetailSkeleton />
          ) : record ? (
            <>
              {/* Summary */}
              <div className="mb-6 grid gap-4 sm:grid-cols-3">
                <SummaryItem
                  label="Total Assets"
                  value={formatCurrency(record.totalAssets)}
                  icon={
                    <svg
                      className="text-success-500 h-5 w-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  }
                />
                <SummaryItem
                  label="Total Liabilities"
                  value={formatCurrency(record.totalLiabilities)}
                  icon={
                    <svg className="text-error-500 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  }
                />
                <SummaryItem
                  label="Net Worth"
                  value={formatCurrency(record.netWorth)}
                  highlight
                  icon={
                    <svg
                      className="text-primary-500 h-5 w-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
                        clipRule="evenodd"
                      />
                    </svg>
                  }
                />
              </div>

              {/* Anomaly Alert - Requirements 15.2, 15.3, 15.4 */}
              {record.anomalyDetected && record.anomalyDetails && (
                <div className="border-warning-200 bg-warning-50 dark:border-warning-800 dark:bg-warning-900/20 mb-6 rounded-lg border p-4">
                  <div className="flex items-start gap-3">
                    <svg
                      className="text-warning-500 h-5 w-5 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div>
                      <h4 className="text-warning-800 dark:text-warning-200 font-medium">
                        Wealth Anomaly Detected
                      </h4>
                      <p className="text-warning-700 dark:text-warning-300 mt-1 text-sm">
                        {record.anomalyDetails.explanation}
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <div className="bg-warning-100 dark:bg-warning-900/40 rounded p-2">
                          <p className="text-warning-600 dark:text-warning-400 text-xs">
                            Year-over-Year Change
                          </p>
                          <p className="text-warning-800 dark:text-warning-200 font-semibold">
                            +{record.anomalyDetails.yearOverYearChange.toFixed(1)}%
                          </p>
                        </div>
                        <div className="bg-warning-100 dark:bg-warning-900/40 rounded p-2">
                          <p className="text-warning-600 dark:text-warning-400 text-xs">
                            Expected Max Change
                          </p>
                          <p className="text-warning-800 dark:text-warning-200 font-semibold">
                            {record.anomalyDetails.expectedMaxChange.toFixed(1)}%
                          </p>
                        </div>
                        <div className="bg-warning-100 dark:bg-warning-900/40 rounded p-2">
                          <p className="text-warning-600 dark:text-warning-400 text-xs">
                            Anomaly Ratio
                          </p>
                          <p className="text-warning-800 dark:text-warning-200 font-semibold">
                            {record.anomalyDetails.anomalyRatio.toFixed(2)}x
                          </p>
                        </div>
                      </div>
                      {/* Requirement 15.4 - Present data objectively */}
                      <p className="text-warning-600 dark:text-warning-400 mt-3 text-xs">
                        Note: This data is presented objectively for user awareness. Users are
                        encouraged to draw their own conclusions.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Declared Salary */}
              {record.declaredSalary && (
                <div className="mb-6 rounded-lg bg-neutral-50 p-4 dark:bg-neutral-800">
                  <p className="text-sm text-neutral-500">Declared Annual Salary</p>
                  <p className="text-lg font-semibold text-neutral-900 dark:text-white">
                    {formatCurrency(record.declaredSalary)}
                  </p>
                </div>
              )}

              {/* Tabs */}
              <div className="mb-4 flex gap-2 border-b border-neutral-200 dark:border-neutral-700">
                <TabButton
                  active={activeTab === "overview"}
                  onClick={() => setActiveTab("overview")}
                  label="Overview"
                />
                <TabButton
                  active={activeTab === "real"}
                  onClick={() => setActiveTab("real")}
                  label={`Real Properties (${record.realProperties.length})`}
                />
                <TabButton
                  active={activeTab === "personal"}
                  onClick={() => setActiveTab("personal")}
                  label={`Personal Properties (${record.personalProperties.length})`}
                />
                <TabButton
                  active={activeTab === "investments"}
                  onClick={() => setActiveTab("investments")}
                  label={`Investments (${record.investments.length})`}
                />
              </div>

              {/* Tab Content */}
              {activeTab === "overview" && <OverviewTab record={record} />}
              {activeTab === "real" && (
                <PropertiesTab properties={record.realProperties} type="real" />
              )}
              {activeTab === "personal" && (
                <PropertiesTab properties={record.personalProperties} type="personal" />
              )}
              {activeTab === "investments" && <InvestmentsTab investments={record.investments} />}

              {/* Source Attribution */}
              {record.sources.length > 0 && (
                <div className="mt-6 border-t border-neutral-200 pt-4 dark:border-neutral-700">
                  <h4 className="mb-2 text-sm font-medium text-neutral-500">Sources</h4>
                  <div className="space-y-2">
                    {record.sources.map((source, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded bg-neutral-50 p-2 dark:bg-neutral-800"
                      >
                        <div>
                          <p className="text-sm font-medium text-neutral-900 dark:text-white">
                            {source.sourceName}
                          </p>
                          <p className="text-xs text-neutral-500">
                            {getSourceTypeLabel(source.sourceType)}
                            {source.documentDate && ` • ${formatDate(source.documentDate)}`}
                          </p>
                        </div>
                        {source.sourceUrl && (
                          <a
                            href={source.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-500 hover:text-primary-600 text-xs"
                          >
                            View →
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-8 text-center">
              <p className="text-neutral-500">Failed to load SALN record</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

interface SummaryItemProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  highlight?: boolean;
}

function SummaryItem({ label, value, icon, highlight }: SummaryItemProps) {
  return (
    <div
      className={`rounded-lg p-4 ${highlight ? "bg-primary-50 dark:bg-primary-900/20" : "bg-neutral-50 dark:bg-neutral-800"}`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm text-neutral-500">{label}</span>
      </div>
      <p
        className={`mt-2 text-xl font-bold ${highlight ? "text-primary-600 dark:text-primary-400" : "text-neutral-900 dark:text-white"}`}
      >
        {value}
      </p>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
}

function TabButton({ active, onClick, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-primary-500 text-primary-600 dark:text-primary-400 border-b-2"
          : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
      }`}
    >
      {label}
    </button>
  );
}

function OverviewTab({ record }: { record: SALNRecordData }) {
  const realPropertiesTotal = record.realProperties.reduce((sum, p) => sum + p.assessedValue, 0);
  const personalPropertiesTotal = record.personalProperties.reduce(
    (sum, p) => sum + p.assessedValue,
    0
  );
  const investmentsTotal = record.investments.reduce((sum, i) => sum + i.value, 0);

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-neutral-900 dark:text-white">Asset Breakdown</h4>
      <div className="space-y-3">
        <BreakdownItem
          label="Real Properties"
          value={realPropertiesTotal}
          total={record.totalAssets}
          color="bg-primary-500"
        />
        <BreakdownItem
          label="Personal Properties"
          value={personalPropertiesTotal}
          total={record.totalAssets}
          color="bg-success-500"
        />
        <BreakdownItem
          label="Investments"
          value={investmentsTotal}
          total={record.totalAssets}
          color="bg-accent-500"
        />
      </div>
    </div>
  );
}

interface BreakdownItemProps {
  label: string;
  value: number;
  total: number;
  color: string;
}

function BreakdownItem({ label, value, total, color }: BreakdownItemProps) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-neutral-600 dark:text-neutral-400">{label}</span>
        <span className="font-medium text-neutral-900 dark:text-white">
          {formatCurrency(value)} ({percentage.toFixed(1)}%)
        </span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-neutral-200 dark:bg-neutral-700">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

interface PropertiesTabProps {
  properties: SALNRecordData["realProperties"];
  type: "real" | "personal";
}

function PropertiesTab({ properties, type }: PropertiesTabProps) {
  if (properties.length === 0) {
    return (
      <div className="rounded-lg bg-neutral-50 p-8 text-center dark:bg-neutral-800">
        <p className="text-neutral-500">
          No {type === "real" ? "real" : "personal"} properties declared
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {properties.map((property) => (
        <div
          key={property.id}
          className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700"
        >
          <div className="flex justify-between">
            <div>
              <p className="font-medium text-neutral-900 dark:text-white">{property.description}</p>
              {property.location && <p className="text-sm text-neutral-500">{property.location}</p>}
            </div>
            <p className="font-semibold text-neutral-900 dark:text-white">
              {formatCurrency(property.assessedValue)}
            </p>
          </div>
          {(property.acquisitionDate || property.acquisitionMode) && (
            <div className="mt-2 flex gap-4 text-xs text-neutral-500">
              {property.acquisitionDate && (
                <span>Acquired: {formatDate(property.acquisitionDate)}</span>
              )}
              {property.acquisitionMode && <span>Mode: {property.acquisitionMode}</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function InvestmentsTab({ investments }: { investments: SALNRecordData["investments"] }) {
  if (investments.length === 0) {
    return (
      <div className="rounded-lg bg-neutral-50 p-8 text-center dark:bg-neutral-800">
        <p className="text-neutral-500">No investments declared</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {investments.map((investment) => (
        <div
          key={investment.id}
          className="flex justify-between rounded-lg border border-neutral-200 p-4 dark:border-neutral-700"
        >
          <p className="font-medium text-neutral-900 dark:text-white">{investment.description}</p>
          <p className="font-semibold text-neutral-900 dark:text-white">
            {formatCurrency(investment.value)}
          </p>
        </div>
      ))}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800"
          />
        ))}
      </div>
      <div className="h-32 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
      <div className="h-48 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
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
    day: "numeric",
  });
}

function getSourceTypeLabel(sourceType: string): string {
  const labels: Record<string, string> = {
    official_government: "Official Government Record",
    court_document: "Court Document",
    comelec_filing: "COMELEC Filing",
    legislative_record: "Legislative Record",
    coa_report: "COA Report",
    third_party_verified: "Third-Party Verified",
    ai_extracted: "AI Extracted",
  };
  return labels[sourceType] || sourceType;
}
