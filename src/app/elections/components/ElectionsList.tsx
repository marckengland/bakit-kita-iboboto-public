/**
 * Elections List Component
 *
 * Displays elections in a list view with filed candidates.
 * Requirements: 26.1, 26.2, 26.3
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

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

interface ElectionsListProps {
  elections: UpcomingElection[];
}

export function ElectionsList({ elections }: ElectionsListProps) {
  const [expandedElection, setExpandedElection] = useState<string | null>(elections[0]?.id || null);

  if (elections.length === 0) {
    return (
      <div className="card py-12 text-center">
        <CalendarIcon className="mx-auto h-12 w-12 text-neutral-300 dark:text-neutral-700" />
        <p className="mt-4 text-neutral-600 dark:text-neutral-400">
          Walang upcoming elections na nahanap
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {elections.map((election) => (
        <ElectionCard
          key={election.id}
          election={election}
          isExpanded={expandedElection === election.id}
          onToggle={() =>
            setExpandedElection(expandedElection === election.id ? null : election.id)
          }
        />
      ))}
    </div>
  );
}

interface ElectionCardProps {
  election: UpcomingElection;
  isExpanded: boolean;
  onToggle: () => void;
}

function ElectionCard({ election, isExpanded, onToggle }: ElectionCardProps) {
  const totalCandidates = election.positions.reduce((sum, p) => sum + p.candidates.length, 0);

  const getTypeColor = () => {
    switch (election.type) {
      case "national":
        return "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300";
      case "local":
        return "bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300";
      case "barangay":
        return "bg-info-100 text-info-700 dark:bg-info-900/30 dark:text-info-300";
      default:
        return "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
    }
  };

  return (
    <div id={election.id} className="card overflow-hidden transition-all">
      {/* Header */}
      <button onClick={onToggle} className="flex w-full items-center justify-between text-left">
        <div className="flex items-center gap-4">
          <div className="bg-primary-100 dark:bg-primary-900/30 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg">
            <CalendarIcon className="text-primary-500 h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-neutral-900 dark:text-white">{election.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getTypeColor()}`}>
                {election.type.charAt(0).toUpperCase() + election.type.slice(1)}
              </span>
              <span className="text-sm text-neutral-500">
                {new Date(election.date).toLocaleDateString("en-PH", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              {!election.isPast && (
                <span className="text-primary-500 text-sm font-medium">
                  {election.daysUntil} days away
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden text-right sm:block">
            <p className="text-sm text-neutral-500">Filed Candidates</p>
            <p className="text-lg font-semibold text-neutral-900 dark:text-white">
              {totalCandidates}
            </p>
          </div>
          <ChevronIcon
            className={`h-5 w-5 text-neutral-400 transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-6 border-t border-neutral-200 pt-6 dark:border-neutral-700">
          {/* Positions and Candidates - Requirement 26.2, 26.3 */}
          <h4 className="mb-4 font-medium text-neutral-900 dark:text-white">
            Positions & Filed Candidates
          </h4>

          <div className="space-y-4">
            {election.positions.map((position) => (
              <PositionCard key={position.id} position={position} />
            ))}
          </div>

          {/* Deadlines */}
          {election.deadlines.length > 0 && (
            <div className="mt-6 border-t border-neutral-200 pt-6 dark:border-neutral-700">
              <h4 className="mb-4 font-medium text-neutral-900 dark:text-white">
                Important Deadlines
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {election.deadlines.map((deadline) => (
                  <div
                    key={deadline.id}
                    className={`rounded-lg border p-3 ${
                      deadline.isPast
                        ? "border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/50"
                        : "border-warning-200 bg-warning-50 dark:border-warning-800 dark:bg-warning-900/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`font-medium ${
                          deadline.isPast ? "text-neutral-500" : "text-neutral-900 dark:text-white"
                        }`}
                      >
                        {deadline.name}
                      </p>
                      {deadline.isPast && (
                        <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400">
                          Past
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-neutral-500">
                      {new Date(deadline.date).toLocaleDateString("en-PH", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    <p className="mt-1 text-xs text-neutral-400">{deadline.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface PositionCardProps {
  position: ElectionPosition;
}

function PositionCard({ position }: PositionCardProps) {
  const [showAllCandidates, setShowAllCandidates] = useState(false);
  const displayedCandidates = showAllCandidates
    ? position.candidates
    : position.candidates.slice(0, 4);

  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h5 className="font-medium text-neutral-900 dark:text-white">{position.title}</h5>
          {position.jurisdiction && (
            <p className="text-sm text-neutral-500">{position.jurisdiction}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm text-neutral-500">
            {position.candidates.length} / {position.slots} slots
          </p>
        </div>
      </div>

      {position.candidates.length === 0 ? (
        <p className="text-sm text-neutral-400">No candidates have filed yet</p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {displayedCandidates.map((candidate) => (
              <CandidateCard key={candidate.id} candidate={candidate} />
            ))}
          </div>

          {position.candidates.length > 4 && (
            <button
              onClick={() => setShowAllCandidates(!showAllCandidates)}
              className="text-primary-500 mt-3 w-full text-center text-sm hover:underline"
            >
              {showAllCandidates
                ? "Show less"
                : `Show all ${position.candidates.length} candidates`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

interface CandidateCardProps {
  candidate: FiledCandidate;
}

function CandidateCard({ candidate }: CandidateCardProps) {
  return (
    <Link
      href={`/politicians/${candidate.politicianId}`}
      className="hover:border-primary-200 hover:bg-primary-50/50 dark:hover:border-primary-800 dark:hover:bg-primary-900/10 flex items-center gap-3 rounded-lg border border-neutral-200 p-2 transition-colors dark:border-neutral-700"
    >
      {/* Photo */}
      {candidate.photo ? (
        <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full">
          <Image
            src={candidate.photo}
            alt={candidate.fullName}
            fill
            className="object-cover"
            sizes="40px"
          />
        </div>
      ) : (
        <div className="bg-primary-100 dark:bg-primary-900/30 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
          <span className="text-primary-500 text-sm font-semibold">
            {getInitials(candidate.fullName)}
          </span>
        </div>
      )}

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-neutral-900 dark:text-white">
          {candidate.fullName}
        </p>
        <p className="truncate text-xs text-neutral-500">{candidate.party || "Independent"}</p>
      </div>

      {/* Running Mate - Requirement 26.3 */}
      {candidate.runningMate && (
        <div className="hidden items-center gap-1 text-xs text-neutral-400 sm:flex">
          <span>w/</span>
          <span className="truncate">{candidate.runningMate.fullName}</span>
        </div>
      )}
    </Link>
  );
}

// Helper functions
function getInitials(name: string): string {
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return `${parts[0]?.[0] || ""}${parts[parts.length - 1]?.[0] || ""}`.toUpperCase();
  }
  return (name[0] || "?").toUpperCase();
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

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}
