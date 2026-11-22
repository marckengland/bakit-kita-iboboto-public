/**
 * Campaign Finance Section Component
 *
 * Displays campaign finance records from COMELEC SOCE filings including
 * contributions, expenditures, and spending limit compliance.
 * Requirements: 21.1, 21.2, 21.3, 21.4, 21.5
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { ExpenditureCategory, DonorType, ContributionType } from "@prisma/client";
import {
  CampaignFinanceData,
  CampaignContributionData,
  CampaignExpenditureData,
} from "@/services/campaign-finance.service";
import { SourcesAccordion } from "./SourcesAccordion";

interface CampaignFinanceSectionProps {
  politicianId: string;
  initialRecords?: CampaignFinanceData[];
}

export function CampaignFinanceSection({
  politicianId,
  initialRecords = [],
}: CampaignFinanceSectionProps) {
  const [records, setRecords] = useState<CampaignFinanceData[]>(initialRecords);
  const [loading, setLoading] = useState(initialRecords.length === 0);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "contributions" | "expenditures">(
    "overview"
  );

  const fetchCampaignFinance = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/politicians/${politicianId}/campaign-finance`);
      if (response.ok) {
        const data = await response.json();
        setRecords(data);
        if (data.length > 0) {
          setSelectedYear(data[0].electionYear);
        }
      }
    } catch (error) {
      console.error("Failed to fetch campaign finance data:", error);
    } finally {
      setLoading(false);
    }
  }, [politicianId]);

  useEffect(() => {
    if (initialRecords.length === 0) {
      fetchCampaignFinance();
    } else if (initialRecords.length > 0 && !selectedYear) {
      setSelectedYear(initialRecords[0]?.electionYear ?? null);
    }
  }, [fetchCampaignFinance, initialRecords, selectedYear]);

  const selectedRecord = records.find((r) => r.electionYear === selectedYear);

  // Handle no records
  if (!loading && records.length === 0) {
    return (
      <div className="card">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
            <svg className="h-5 w-5 text-neutral-500" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
              Campaign Finance
            </h2>
            <p className="text-sm text-neutral-500">
              COMELEC Statement of Contributions and Expenditures
            </p>
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="mt-4 text-neutral-600 dark:text-neutral-400">
            No campaign finance records available
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            SOCE data will be displayed when official COMELEC records become available.
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
                d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
              Campaign Finance
            </h2>
            <p className="text-sm text-neutral-500">
              {records.length} election{records.length !== 1 ? "s" : ""} on record
            </p>
          </div>
        </div>

        {/* Year Selector */}
        {records.length > 0 && (
          <select
            value={selectedYear || ""}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          >
            {records.map((record) => (
              <option key={record.electionYear} value={record.electionYear}>
                {record.electionYear} Election
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <CampaignFinanceSkeleton />
      ) : selectedRecord ? (
        <>
          {/* Summary Cards */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Total Contributions"
              value={formatCurrency(selectedRecord.totalContributions)}
              icon={
                <svg className="text-success-500 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              }
            />
            <SummaryCard
              label="Total Expenditures"
              value={formatCurrency(selectedRecord.totalExpenditures)}
              icon={
                <svg className="text-error-500 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z"
                    clipRule="evenodd"
                  />
                </svg>
              }
            />
            <SummaryCard
              label="Spending Limit"
              value={formatCurrency(selectedRecord.spendingLimit)}
              icon={
                <svg className="text-primary-500 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z"
                    clipRule="evenodd"
                  />
                </svg>
              }
            />
            {/* Requirement 21.5 - Show spending limit compliance */}
            <SummaryCard
              label="Compliance Status"
              value={selectedRecord.withinLimit ? "Within Limit" : "Exceeded"}
              variant={selectedRecord.withinLimit ? "success" : "error"}
              icon={
                selectedRecord.withinLimit ? (
                  <svg className="text-success-500 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg className="text-error-500 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                )
              }
            />
          </div>

          {/* Spending Progress Bar */}
          <div className="mb-6">
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-neutral-500">Spending vs Limit</span>
              <span className="font-medium text-neutral-900 dark:text-white">
                {((selectedRecord.totalExpenditures / selectedRecord.spendingLimit) * 100).toFixed(
                  1
                )}
                %
              </span>
            </div>
            <div className="h-3 rounded-full bg-neutral-200 dark:bg-neutral-700">
              <div
                className={`h-3 rounded-full transition-all ${
                  selectedRecord.withinLimit ? "bg-success-500" : "bg-error-500"
                }`}
                style={{
                  width: `${Math.min((selectedRecord.totalExpenditures / selectedRecord.spendingLimit) * 100, 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-4 flex gap-2 border-b border-neutral-200 dark:border-neutral-700">
            <TabButton
              active={activeTab === "overview"}
              onClick={() => setActiveTab("overview")}
              label="Overview"
            />
            <TabButton
              active={activeTab === "contributions"}
              onClick={() => setActiveTab("contributions")}
              label={`Contributions (${selectedRecord.contributions.length})`}
            />
            <TabButton
              active={activeTab === "expenditures"}
              onClick={() => setActiveTab("expenditures")}
              label={`Expenditures (${selectedRecord.expenditures.length})`}
            />
          </div>

          {/* Tab Content */}
          {activeTab === "overview" && <OverviewTab record={selectedRecord} />}
          {activeTab === "contributions" && (
            <ContributionsTab contributions={selectedRecord.contributions} />
          )}
          {activeTab === "expenditures" && (
            <ExpendituresTab expenditures={selectedRecord.expenditures} />
          )}

          {/* Source Attribution - Requirement 21.7 */}
          {selectedRecord.sources.length > 0 && (
            <div className="mt-6">
              <SourcesAccordion sources={selectedRecord.sources} label="COMELEC SOCE Sources" />
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

interface SummaryCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  variant?: "default" | "success" | "error";
}

function SummaryCard({ label, value, icon, variant = "default" }: SummaryCardProps) {
  const variantStyles = {
    default: "text-neutral-900 dark:text-white",
    success: "text-success-600 dark:text-success-400",
    error: "text-error-600 dark:text-error-400",
  };

  return (
    <div className="rounded-lg bg-neutral-50 p-4 dark:bg-neutral-800">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm text-neutral-500">{label}</span>
      </div>
      <p className={`mt-2 text-xl font-bold ${variantStyles[variant]}`}>{value}</p>
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

function OverviewTab({ record }: { record: CampaignFinanceData }) {
  // Calculate expenditure breakdown by category
  const categoryTotals = new Map<ExpenditureCategory, number>();
  for (const exp of record.expenditures) {
    const current = categoryTotals.get(exp.category) || 0;
    categoryTotals.set(exp.category, current + exp.amount);
  }

  const sortedCategories = Array.from(categoryTotals.entries()).sort((a, b) => b[1] - a[1]);

  // Get notable donors - Requirement 21.4
  const notableDonors = record.contributions.filter((c) => c.isNotableDonor);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Expenditure Breakdown - Requirement 21.3 */}
      <div>
        <h4 className="mb-4 font-medium text-neutral-900 dark:text-white">Expenditure Breakdown</h4>
        {sortedCategories.length > 0 ? (
          <div className="space-y-3">
            {sortedCategories.map(([category, total]) => (
              <BreakdownItem
                key={category}
                label={getCategoryLabel(category)}
                value={total}
                total={record.totalExpenditures}
                color={getCategoryColor(category)}
              />
            ))}
          </div>
        ) : (
          <p className="text-neutral-500">No expenditure data available</p>
        )}
      </div>

      {/* Notable Donors - Requirement 21.4 */}
      <div>
        <h4 className="mb-4 font-medium text-neutral-900 dark:text-white">Notable Donors</h4>
        {notableDonors.length > 0 ? (
          <div className="space-y-3">
            {notableDonors.slice(0, 5).map((donor) => (
              <div
                key={donor.id}
                className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 dark:border-neutral-700"
              >
                <div>
                  <p className="font-medium text-neutral-900 dark:text-white">{donor.donorName}</p>
                  <p className="text-xs text-neutral-500">
                    {getDonorTypeLabel(donor.donorType)} • {getContributionTypeLabel(donor.type)}
                  </p>
                </div>
                <p className="font-semibold text-neutral-900 dark:text-white">
                  {formatCurrency(donor.amount)}
                </p>
              </div>
            ))}
            {notableDonors.length > 5 && (
              <p className="text-sm text-neutral-500">
                +{notableDonors.length - 5} more notable donors
              </p>
            )}
          </div>
        ) : (
          <p className="text-neutral-500">No notable donors on record</p>
        )}
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

/**
 * Contributions Tab
 * Requirements 21.2, 21.4
 */
function ContributionsTab({ contributions }: { contributions: CampaignContributionData[] }) {
  const [sortBy, setSortBy] = useState<"amount" | "date">("amount");

  const sortedContributions = [...contributions].sort((a, b) => {
    if (sortBy === "amount") {
      return b.amount - a.amount;
    }
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  if (contributions.length === 0) {
    return (
      <div className="rounded-lg bg-neutral-50 p-8 text-center dark:bg-neutral-800">
        <p className="text-neutral-500">No contribution records available</p>
      </div>
    );
  }

  return (
    <div>
      {/* Sort Controls */}
      <div className="mb-4 flex justify-end">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "amount" | "date")}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        >
          <option value="amount">Sort by Amount</option>
          <option value="date">Sort by Date</option>
        </select>
      </div>

      {/* Contributions Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-700">
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Donor</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Type</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Date</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-neutral-500">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {sortedContributions.map((contribution) => (
              <tr key={contribution.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-900 dark:text-white">
                      {contribution.donorName}
                    </span>
                    {contribution.isNotableDonor && (
                      <span className="badge bg-accent-100 text-accent-700 dark:bg-accent-900 dark:text-accent-300 text-xs">
                        Notable
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500">
                    {getDonorTypeLabel(contribution.donorType)}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`badge ${
                      contribution.type === ContributionType.cash
                        ? "bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300"
                        : "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300"
                    }`}
                  >
                    {getContributionTypeLabel(contribution.type)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-neutral-500">
                  {formatDate(contribution.date)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-neutral-900 dark:text-white">
                  {formatCurrency(contribution.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Expenditures Tab
 * Requirement 21.3
 */
function ExpendituresTab({ expenditures }: { expenditures: CampaignExpenditureData[] }) {
  const [sortBy, setSortBy] = useState<"amount" | "date" | "category">("amount");

  const sortedExpenditures = [...expenditures].sort((a, b) => {
    if (sortBy === "amount") {
      return b.amount - a.amount;
    }
    if (sortBy === "category") {
      return a.category.localeCompare(b.category);
    }
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  if (expenditures.length === 0) {
    return (
      <div className="rounded-lg bg-neutral-50 p-8 text-center dark:bg-neutral-800">
        <p className="text-neutral-500">No expenditure records available</p>
      </div>
    );
  }

  return (
    <div>
      {/* Sort Controls */}
      <div className="mb-4 flex justify-end">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "amount" | "date" | "category")}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        >
          <option value="amount">Sort by Amount</option>
          <option value="date">Sort by Date</option>
          <option value="category">Sort by Category</option>
        </select>
      </div>

      {/* Expenditures Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-700">
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">
                Description
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Category</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Date</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-neutral-500">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {sortedExpenditures.map((expenditure) => (
              <tr key={expenditure.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800">
                <td className="px-4 py-3">
                  <span className="font-medium text-neutral-900 dark:text-white">
                    {expenditure.description}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${getCategoryBadgeClass(expenditure.category)}`}>
                    {getCategoryLabel(expenditure.category)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-neutral-500">
                  {formatDate(expenditure.date)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-neutral-900 dark:text-white">
                  {formatCurrency(expenditure.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CampaignFinanceSkeleton() {
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
      <div className="h-8 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
      <div className="h-64 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
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

function getCategoryLabel(category: ExpenditureCategory): string {
  const labels: Record<ExpenditureCategory, string> = {
    [ExpenditureCategory.advertising]: "Advertising",
    [ExpenditureCategory.rallies]: "Rallies & Events",
    [ExpenditureCategory.materials]: "Campaign Materials",
    [ExpenditureCategory.personnel]: "Personnel",
    [ExpenditureCategory.travel]: "Travel",
    [ExpenditureCategory.other]: "Other",
  };
  return labels[category] || category;
}

function getCategoryColor(category: ExpenditureCategory): string {
  const colors: Record<ExpenditureCategory, string> = {
    [ExpenditureCategory.advertising]: "bg-primary-500",
    [ExpenditureCategory.rallies]: "bg-success-500",
    [ExpenditureCategory.materials]: "bg-accent-500",
    [ExpenditureCategory.personnel]: "bg-warning-500",
    [ExpenditureCategory.travel]: "bg-secondary-500",
    [ExpenditureCategory.other]: "bg-neutral-500",
  };
  return colors[category] || "bg-neutral-500";
}

function getCategoryBadgeClass(category: ExpenditureCategory): string {
  const classes: Record<ExpenditureCategory, string> = {
    [ExpenditureCategory.advertising]:
      "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300",
    [ExpenditureCategory.rallies]:
      "bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300",
    [ExpenditureCategory.materials]:
      "bg-accent-100 text-accent-700 dark:bg-accent-900 dark:text-accent-300",
    [ExpenditureCategory.personnel]:
      "bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-300",
    [ExpenditureCategory.travel]:
      "bg-secondary-100 text-secondary-700 dark:bg-secondary-900 dark:text-secondary-300",
    [ExpenditureCategory.other]:
      "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  };
  return classes[category] || "bg-neutral-100 text-neutral-700";
}

function getDonorTypeLabel(type: DonorType): string {
  const labels: Record<DonorType, string> = {
    [DonorType.individual]: "Individual",
    [DonorType.corporation]: "Corporation",
    [DonorType.organization]: "Organization",
  };
  return labels[type] || type;
}

function getContributionTypeLabel(type: ContributionType): string {
  const labels: Record<ContributionType, string> = {
    [ContributionType.cash]: "Cash",
    [ContributionType.in_kind]: "In-Kind",
  };
  return labels[type] || type;
}
