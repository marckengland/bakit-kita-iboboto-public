/**
 * Voting List Integration Component
 *
 * Shows which positions the user has not yet selected candidates for.
 * Requirements: 26.5
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface UpcomingElection {
  id: string;
  name: string;
  type: string;
  date: string;
  level: string;
  isPast?: boolean;
  positions: ElectionPosition[];
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
}

interface VotingListItem {
  id: string;
  politicianId: string;
  position: string;
}

interface VotingListIntegrationProps {
  elections: UpcomingElection[];
}

export function VotingListIntegration({ elections }: VotingListIntegrationProps) {
  const [votingList, setVotingList] = useState<VotingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchVotingList = async () => {
      try {
        // Check authentication
        const authResponse = await fetch("/api/auth/profile");
        const isAuth = authResponse.ok;
        setIsAuthenticated(isAuth);

        if (!isAuth) {
          setIsLoading(false);
          return;
        }

        // Fetch voting list for the next election year
        const nextElection = elections.find((e) => !e.isPast);
        const electionYear = nextElection
          ? new Date(nextElection.date).getFullYear()
          : new Date().getFullYear();

        const listResponse = await fetch(`/api/voting-list?electionYear=${electionYear}`);
        if (listResponse.ok) {
          const data = await listResponse.json();
          // Flatten the voting list items
          const items: VotingListItem[] = [];
          if (data.byLevel) {
            Object.values(data.byLevel).forEach((levelItems) => {
              items.push(...(levelItems as VotingListItem[]));
            });
          }
          setVotingList(items);
        }
      } catch (error) {
        console.error("Error fetching voting list:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVotingList();
  }, [elections]);

  // Get all unique positions from upcoming elections
  const allPositions = elections
    .filter((e) => !e.isPast)
    .flatMap((e) =>
      e.positions.map((p) => ({
        ...p,
        electionName: e.name,
        electionDate: e.date,
      }))
    );

  // Find positions without selections - Requirement 26.5
  const positionsWithoutSelection = allPositions.filter((position) => {
    const hasSelection = votingList.some(
      (item) =>
        item.position.toLowerCase().includes(position.title.toLowerCase()) ||
        position.title.toLowerCase().includes(item.position.toLowerCase())
    );
    return !hasSelection && position.candidates.length > 0;
  });

  // Count selections by position type
  const selectionsByPosition = allPositions.reduce(
    (acc, position) => {
      const hasSelection = votingList.some(
        (item) =>
          item.position.toLowerCase().includes(position.title.toLowerCase()) ||
          position.title.toLowerCase().includes(item.position.toLowerCase())
      );
      acc[position.title] = {
        selected: hasSelection ? 1 : 0,
        total: position.slots,
        hasCandidates: position.candidates.length > 0,
      };
      return acc;
    },
    {} as Record<string, { selected: number; total: number; hasCandidates: boolean }>
  );

  if (isLoading) {
    return (
      <div className="card animate-pulse">
        <div className="h-6 w-32 rounded bg-neutral-200 dark:bg-neutral-700" />
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded bg-neutral-200 dark:bg-neutral-700" />
          ))}
        </div>
      </div>
    );
  }

  // Not authenticated
  if (isAuthenticated === false) {
    return (
      <div className="card">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-white">
          <ChecklistIcon className="text-primary-500 h-5 w-5" />
          Your Voting List
        </h2>
        <div className="rounded-lg bg-neutral-50 p-4 text-center dark:bg-neutral-800">
          <LockIcon className="mx-auto h-8 w-8 text-neutral-400" />
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Mag-login para makita ang iyong voting list at mga kulang na posisyon
          </p>
          <Link href="/auth/login" className="btn-primary mt-3 inline-block text-sm">
            Mag-login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-white">
        <ChecklistIcon className="text-primary-500 h-5 w-5" />
        Your Voting List
      </h2>

      {/* Summary */}
      <div className="bg-primary-50 dark:bg-primary-900/20 mb-4 rounded-lg p-3">
        <p className="text-primary-700 dark:text-primary-300 text-sm">
          <strong>{votingList.length}</strong> candidates selected
          {positionsWithoutSelection.length > 0 && (
            <>
              {" • "}
              <span className="text-warning-600 dark:text-warning-400">
                {positionsWithoutSelection.length} positions need selection
              </span>
            </>
          )}
        </p>
      </div>

      {/* Positions Status */}
      <div className="space-y-2">
        {Object.entries(selectionsByPosition).map(([position, status]) => (
          <div
            key={position}
            className={`flex items-center justify-between rounded-lg border p-3 ${
              status.selected > 0
                ? "border-success-200 bg-success-50 dark:border-success-800 dark:bg-success-900/20"
                : status.hasCandidates
                  ? "border-warning-200 bg-warning-50 dark:border-warning-800 dark:bg-warning-900/20"
                  : "border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {status.selected > 0 ? (
                <CheckIcon className="text-success-500 h-4 w-4" />
              ) : status.hasCandidates ? (
                <WarningIcon className="text-warning-500 h-4 w-4" />
              ) : (
                <ClockIcon className="h-4 w-4 text-neutral-400" />
              )}
              <span
                className={`text-sm font-medium ${
                  status.selected > 0
                    ? "text-success-700 dark:text-success-300"
                    : status.hasCandidates
                      ? "text-warning-700 dark:text-warning-300"
                      : "text-neutral-500"
                }`}
              >
                {position}
              </span>
            </div>
            <span className="text-xs text-neutral-500">
              {status.selected}/{status.total}
            </span>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="mt-4 flex flex-col gap-2">
        <Link href="/voting-list" className="btn-outline w-full justify-center text-center text-sm">
          View Full Voting List
        </Link>
        {positionsWithoutSelection.length > 0 && (
          <Link
            href="/politicians"
            className="btn-primary w-full justify-center text-center text-sm"
          >
            Browse Candidates
          </Link>
        )}
      </div>
    </div>
  );
}

// Icon Components
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

function LockIcon({ className }: { className?: string }) {
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
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
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
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
