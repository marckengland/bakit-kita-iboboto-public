/**
 * Politician Card Component
 *
 * Displays a politician summary in the directory listing.
 * Requirements: 1.1, 18.8
 */

import Image from "next/image";
import type { PoliticianSummary } from "@/services/politician.service";
import { RedFlagIndicator } from "./RedFlagIndicator";
import { ReviewedMembership } from "./ReviewedMembership";

interface PoliticianCardProps {
  politician: PoliticianSummary;
}

export function PoliticianCard({ politician }: PoliticianCardProps) {
  const { reviewedBatch } = politician;
  const levelLabel =
    !reviewedBatch && politician.currentPosition?.level
      ? formatLevel(politician.currentPosition.level)
      : null;

  return (
    <a
      href={`/politicians/${politician.id}`}
      className="group hover:border-primary-200 hover:shadow-soft dark:hover:border-primary-800 relative flex flex-col rounded-xl border border-neutral-200 bg-white p-4 transition-all dark:border-neutral-800 dark:bg-neutral-900"
    >
      {/* Red Flag Indicator - Requirement 18.8 */}
      {politician.hasRedFlags && (
        <div className="absolute top-3 right-3">
          <RedFlagIndicator />
        </div>
      )}

      <div className="flex gap-4">
        {/* Photo */}
        <div className="flex-shrink-0">
          {politician.photo ? (
            <div className="relative h-16 w-16 overflow-hidden rounded-full">
              <Image
                src={politician.photo}
                alt={politician.fullName}
                fill
                className="object-cover"
                sizes="64px"
              />
            </div>
          ) : (
            <div className="bg-primary-100 dark:bg-primary-900 flex h-16 w-16 items-center justify-center rounded-full">
              <span className="text-primary-500 text-xl font-semibold">
                {getInitials(politician.fullName)}
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          {/* Name */}
          <h3 className="group-hover:text-primary-500 truncate text-base font-semibold text-neutral-900 dark:text-white">
            {politician.fullName}
          </h3>

          {/* Legal name sublabel */}
          {politician.legalName && politician.legalName !== politician.fullName && (
            <p className="truncate text-xs text-neutral-400 dark:text-neutral-500">
              {politician.legalName}
            </p>
          )}

          {/* Position */}
          {reviewedBatch ? (
            <ReviewedMembership
              batch={reviewedBatch}
              className="mt-1 text-sm text-neutral-600 dark:text-neutral-400"
            />
          ) : (
            politician.currentPosition && (
              <p className="mt-1 truncate text-sm text-neutral-600 dark:text-neutral-400">
                {politician.currentPosition.title}
              </p>
            )
          )}

          {/* Jurisdiction */}
          {!reviewedBatch && politician.currentPosition?.jurisdiction && (
            <p className="truncate text-sm text-neutral-500 dark:text-neutral-500">
              {politician.currentPosition.jurisdiction}
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {/* Level Badge */}
        {levelLabel && (
          <span className="badge bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            {levelLabel}
          </span>
        )}

        {/* Party Badge */}
        {!reviewedBatch && politician.currentParty && (
          <span className="badge bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            {politician.currentParty.abbreviation || politician.currentParty.name}
          </span>
        )}
      </div>
    </a>
  );
}

function getInitials(name: string): string {
  const parts = name.split(" ");
  if (parts.length >= 2) {
    const firstInitial = parts[0]?.[0] || "";
    const lastInitial = parts[parts.length - 1]?.[0] || "";
    return `${firstInitial}${lastInitial}`.toUpperCase();
  }
  const initial = name[0] || "?";
  return initial.toUpperCase();
}

function formatLevel(level: string): string {
  const labels: Record<string, string> = {
    national: "National",
    regional: "Regional",
    provincial: "Provincial",
    city: "City",
    municipal: "Municipal",
    barangay: "Barangay",
  };
  return labels[level] || level;
}
