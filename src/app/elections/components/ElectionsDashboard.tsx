/**
 * Elections Dashboard Component
 *
 * Main dashboard showing elections calendar, candidates, and deadlines.
 * Requirements: 26.1, 26.2, 26.3, 26.4, 26.5, 26.6
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { ElectionsCalendar } from "./ElectionsCalendar";
import { ElectionsList } from "./ElectionsList";
import { ElectionFilters } from "./ElectionFilters";
import { VotingListIntegration } from "./VotingListIntegration";

interface UpcomingElection {
  id: string;
  name: string;
  type: "national" | "local" | "barangay" | "special";
  date: string;
  level: string;
  jurisdiction?: string;
  daysUntil: number;
  isPast: boolean;
  deadlines: ElectionDeadline[];
  positions: ElectionPosition[];
}

interface ElectionDeadline {
  id: string;
  name: string;
  date: string;
  description: string;
  type: string;
  isPast: boolean;
}

interface ElectionPosition {
  id: string;
  title: string;
  level: string;
  jurisdiction?: string;
  slots: number;
  candidates: FiledCandidate[];
}

interface FiledCandidate {
  id: string;
  politicianId: string;
  fullName: string;
  photo: string | null;
  party: string | null;
  position: string;
  filingDate: string;
  runningMate?: {
    id: string;
    fullName: string;
    photo: string | null;
  };
}

interface ElectionsDashboardProps {
  searchParams: {
    level?: string;
    type?: string;
    jurisdiction?: string;
    year?: string;
    view?: "calendar" | "list";
  };
}

export function ElectionsDashboard({ searchParams }: ElectionsDashboardProps) {
  const [elections, setElections] = useState<UpcomingElection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"calendar" | "list">(searchParams.view || "calendar");
  const [showAllDeadlines, setShowAllDeadlines] = useState(false);
  const [filters, setFilters] = useState({
    level: searchParams.level || "",
    type: searchParams.type || "",
    jurisdiction: searchParams.jurisdiction || "",
    year: searchParams.year || "",
  });

  const fetchElections = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.level) {
        params.set("level", filters.level);
      }
      if (filters.type) {
        params.set("type", filters.type);
      }
      if (filters.jurisdiction) {
        params.set("jurisdiction", filters.jurisdiction);
      }
      if (filters.year) {
        params.set("year", filters.year);
      }

      const response = await fetch(`/api/elections?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch elections");
      }

      const data = await response.json();
      setElections(data.elections);
    } catch (err) {
      setError("Hindi ma-load ang mga eleksyon. Subukan muli.");
      console.error("Error fetching elections:", err);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchElections();
  }, [fetchElections]);

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
  };

  // Get all upcoming deadlines across all elections - Requirement 26.6
  const allDeadlines = elections
    .flatMap((e) =>
      e.deadlines.map((d) => ({
        ...d,
        electionName: e.name,
        electionId: e.id,
      }))
    )
    .filter((d) => !d.isPast)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Get total candidates count
  const totalCandidates = elections.reduce(
    (sum, e) => sum + e.positions.reduce((pSum, p) => pSum + p.candidates.length, 0),
    0
  );

  if (error) {
    return (
      <div className="card py-12 text-center">
        <ErrorIcon className="text-error-500 mx-auto h-12 w-12" />
        <p className="text-error-600 dark:text-error-400 mt-4">{error}</p>
        <button onClick={fetchElections} className="btn-primary mt-4">
          Subukan Muli
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<CalendarIcon className="h-6 w-6" />}
          label="Upcoming Elections"
          value={elections.filter((e) => !e.isPast).length}
          color="primary"
        />
        <StatCard
          icon={<UsersIcon className="h-6 w-6" />}
          label="Filed Candidates"
          value={totalCandidates}
          color="success"
        />
        <StatCard
          icon={<ClockIcon className="h-6 w-6" />}
          label="Upcoming Deadlines"
          value={allDeadlines.length}
          color="warning"
        />
        <StatCard
          icon={<ChecklistIcon className="h-6 w-6" />}
          label="Next Election"
          value={
            elections.find((e) => !e.isPast)
              ? `${elections.find((e) => !e.isPast)?.daysUntil} days`
              : "N/A"
          }
          color="info"
        />
      </div>

      {/* Filters and View Toggle */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <ElectionFilters filters={filters} onFilterChange={handleFilterChange} />

        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-500">View:</span>
          <div className="flex rounded-lg border border-neutral-200 dark:border-neutral-700">
            <button
              onClick={() => setView("calendar")}
              className={`flex items-center gap-1 px-3 py-1.5 text-sm ${
                view === "calendar"
                  ? "bg-primary-500 text-white"
                  : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              } rounded-l-lg transition-colors`}
            >
              <CalendarIcon className="h-4 w-4" />
              Calendar
            </button>
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1 px-3 py-1.5 text-sm ${
                view === "list"
                  ? "bg-primary-500 text-white"
                  : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              } rounded-r-lg transition-colors`}
            >
              <ListIcon className="h-4 w-4" />
              List
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Elections View (Calendar or List) */}
        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="card animate-pulse">
              <div className="h-96 rounded-lg bg-neutral-200 dark:bg-neutral-700" />
            </div>
          ) : view === "calendar" ? (
            <ElectionsCalendar elections={elections} />
          ) : (
            <ElectionsList elections={elections} />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Upcoming Deadlines - Requirement 26.6 */}
          <div className="card">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-white">
              <ClockIcon className="text-warning-500 h-5 w-5" />
              Upcoming Deadlines
            </h2>
            {allDeadlines.length === 0 ? (
              <p className="text-sm text-neutral-500">No upcoming deadlines</p>
            ) : (
              <div className="space-y-3">
                {(showAllDeadlines ? allDeadlines : allDeadlines.slice(0, 5)).map((deadline) => (
                  <DeadlineCard key={deadline.id} deadline={deadline} />
                ))}
                {allDeadlines.length > 5 && (
                  <button
                    onClick={() => setShowAllDeadlines(!showAllDeadlines)}
                    className="text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 w-full rounded-lg border border-neutral-200 py-2 text-center text-sm font-medium transition-colors dark:border-neutral-700"
                  >
                    {showAllDeadlines ? "Show less" : `+${allDeadlines.length - 5} more deadlines`}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Voting List Integration - Requirement 26.5 */}
          <VotingListIntegration elections={elections} />
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: "primary" | "success" | "warning" | "info";
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  const colorClasses = {
    primary: "bg-primary-50 text-primary-500 dark:bg-primary-900/20",
    success: "bg-success-50 text-success-500 dark:bg-success-900/20",
    warning: "bg-warning-50 text-warning-500 dark:bg-warning-900/20",
    info: "bg-info-50 text-info-500 dark:bg-info-900/20",
  };

  return (
    <div className="card flex items-center gap-4">
      <div className={`rounded-lg p-3 ${colorClasses[color]}`}>{icon}</div>
      <div>
        <p className="text-sm text-neutral-500">{label}</p>
        <p className="text-2xl font-bold text-neutral-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

// Deadline Card Component
interface DeadlineCardProps {
  deadline: {
    id: string;
    name: string;
    date: string;
    description: string;
    type: string;
    electionName: string;
  };
}

function DeadlineCard({ deadline }: DeadlineCardProps) {
  const daysUntil = Math.ceil(
    (new Date(deadline.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  const getDeadlineColor = () => {
    if (daysUntil <= 7) {
      return "text-error-500 bg-error-50 dark:bg-error-900/20";
    }
    if (daysUntil <= 30) {
      return "text-warning-500 bg-warning-50 dark:bg-warning-900/20";
    }
    return "text-info-500 bg-info-50 dark:bg-info-900/20";
  };

  return (
    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-neutral-900 dark:text-white">{deadline.name}</p>
          <p className="mt-0.5 text-xs text-neutral-500">{deadline.electionName}</p>
        </div>
        <span
          className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${getDeadlineColor()}`}
        >
          {daysUntil} days
        </span>
      </div>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        {new Date(deadline.date).toLocaleDateString("en-PH", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </p>
    </div>
  );
}

// Icon Components
function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
      />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
      />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function ChecklistIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
      />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
      />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
      />
    </svg>
  );
}
