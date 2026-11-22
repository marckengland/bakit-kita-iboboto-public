/**
 * Profile Header Component
 *
 * Displays the politician's photo, name, current position, and party.
 * Includes bookmark, voting list, export, share, and offline download buttons.
 * Requirements: 2.1, 10.1, 17.1, 18.5, 33.1, 42.1, 42.6
 */

"use client";

import { useOnlineReview } from "@/hooks/useOnlineReview";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import Image from "next/image";
import type { PoliticianProfile } from "@/services/politician.service";
import { RedFlagIndicator } from "../../components/RedFlagIndicator";
import { ReviewedMembership } from "../../components/ReviewedMembership";
import { BookmarkButton } from "@/app/components/BookmarkButton";
import { VotingListButton } from "@/app/components/VotingListButton";
import { SocialShareButtons } from "@/app/components/SocialShareButtons";
import { DownloadForOffline } from "@/app/components/DownloadForOffline";

interface ProfileHeaderProps {
  politician: PoliticianProfile;
  redFlagCount: number | null;
  researchAvailability?: "available" | "withheld" | "unavailable";
}

export function ProfileHeader({
  politician,
  redFlagCount,
  researchAvailability,
}: ProfileHeaderProps) {
  const tNav = useTranslations("nav");
  const onlineReview = useOnlineReview();
  const publicCount = onlineReview ? redFlagCount : null;
  const [isExporting, setIsExporting] = useState(false);
  const { reviewedBatch } = politician;
  const levelLabel =
    !reviewedBatch && politician.currentPosition?.level
      ? formatLevel(politician.currentPosition.level)
      : null;

  // Requirement 42.1: Export profile as PDF
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/politicians/${politician.id}/export`);
      if (!response.ok) {
        throw new Error("Export failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${politician.fullName.replace(/\s+/g, "-").toLowerCase()}-profile.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      setIsExporting(false);
    }
  };

  // Get current URL for sharing
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="card">
      {!reviewedBatch &&
        publicCount !== null &&
        researchAvailability &&
        researchAvailability !== "available" && (
          <p role="status">
            Indicators currently shown: {publicCount}.{" "}
            {researchAvailability === "withheld"
              ? "Research is being reviewed."
              : "Reviewed research is temporarily unavailable."}
          </p>
        )}
      {!onlineReview && (
        <p role="status">
          Case details require an online review check. Reload this page when connected.
        </p>
      )}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* Photo */}
        <div className="flex-shrink-0">
          {politician.photo ? (
            <div className="relative h-32 w-32 overflow-hidden rounded-xl sm:h-40 sm:w-40">
              <Image
                src={politician.photo}
                alt={politician.fullName}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 128px, 160px"
                priority
              />
            </div>
          ) : (
            <div className="bg-primary-100 dark:bg-primary-900 flex h-32 w-32 items-center justify-center rounded-xl sm:h-40 sm:w-40">
              <span className="text-primary-500 text-4xl font-semibold sm:text-5xl">
                {getInitials(politician.fullName)}
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              {/* Name */}
              <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl dark:text-white">
                {politician.fullName}
              </h1>

              {/* Legal name sublabel */}
              {politician.legalName && politician.legalName !== politician.fullName && (
                <p className="text-sm text-neutral-400 dark:text-neutral-500">
                  {politician.legalName}
                </p>
              )}

              {/* Current Position */}
              {reviewedBatch ? (
                <>
                  <ReviewedMembership
                    showEvidence
                    batch={reviewedBatch}
                    className="mt-2 text-neutral-600 dark:text-neutral-400"
                  />
                  <a
                    className="text-primary-600 dark:text-primary-400 text-sm underline"
                    href={reviewedBatch.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Senate opening roster
                  </a>
                </>
              ) : (
                politician.currentPosition && (
                  <p className="mt-2 text-lg text-neutral-600 dark:text-neutral-400">
                    {politician.currentPosition.title}
                  </p>
                )
              )}

              {/* Jurisdiction */}
              {!reviewedBatch && politician.currentPosition?.jurisdiction && (
                <p className="text-neutral-500 dark:text-neutral-500">
                  {politician.currentPosition.jurisdiction}
                </p>
              )}
            </div>

            {/* Red Flag Indicator - Requirement 18.5 */}
            {!reviewedBatch && publicCount !== null && publicCount > 0 && (
              <button
                className="flex-shrink-0 cursor-pointer transition-transform hover:scale-110"
                onClick={() =>
                  document.getElementById("red-flags")?.scrollIntoView({ behavior: "smooth" })
                }
                aria-label={`${publicCount} red flag${publicCount !== 1 ? "s" : ""} — click to view details`}
              >
                <RedFlagIndicator count={publicCount} showCount size="lg" />
              </button>
            )}
          </div>

          {/* Action Buttons - Requirements 10.1, 17.1, 33.1, 42.1, 42.6 */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href={`/compare?ids=${encodeURIComponent(politician.id)}`}
              className="btn-outline"
            >
              {tNav("compare")}
            </Link>
            <BookmarkButton
              politicianId={politician.id}
              politicianName={politician.fullName}
              size="md"
              showLabel
            />
            {!reviewedBatch && politician.currentPosition && (
              <VotingListButton
                politicianId={politician.id}
                politicianName={politician.fullName}
                position={politician.currentPosition.title}
                size="md"
                showLabel
              />
            )}

            {/* Download for Offline Button - Requirement 33.1 */}
            <DownloadForOffline
              politicianId={politician.id}
              politicianName={politician.fullName}
              variant="compact"
            />

            {/* Export Button - Requirement 42.1 */}
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="btn-outline flex items-center gap-2"
              aria-label={reviewedBatch ? "Export profile as HTML" : "Export profile as PDF"}
            >
              {isExporting ? (
                <LoadingSpinner className="h-4 w-4" />
              ) : (
                <DownloadIcon className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Export</span>
            </button>

            {/* Share Button - Requirement 42.6 */}
            <SocialShareButtons
              type="profile"
              url={currentUrl}
              data={{ politicianName: politician.fullName }}
              variant="dropdown"
            />
          </div>

          {!reviewedBatch && (
            <>
              {/* Badges */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {/* Level Badge */}
                {levelLabel && (
                  <span className="badge bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                    {levelLabel}
                  </span>
                )}

                {/* Party Badge */}
                {politician.currentParty && (
                  <span className="badge bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                    {politician.currentParty.party.name}
                    {politician.currentParty.party.abbreviation &&
                      ` (${politician.currentParty.party.abbreviation})`}
                  </span>
                )}

                {/* Active Status */}
                <span
                  className={`badge ${
                    politician.isActive
                      ? "bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300"
                      : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500"
                  }`}
                >
                  {politician.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              {/* Quick Stats */}
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <QuickStat label="Positions Held" value={politician.positions.length.toString()} />
                <QuickStat
                  label="Party Affiliations"
                  value={politician.partyAffiliations.length.toString()}
                />
                {publicCount !== null && publicCount > 0 && (
                  <button
                    className="text-left"
                    onClick={() =>
                      document.getElementById("red-flags")?.scrollIntoView({ behavior: "smooth" })
                    }
                    aria-label="View red flags details"
                  >
                    <QuickStat
                      label="Indicators shown"
                      value={publicCount.toString()}
                      variant="warning"
                    />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface QuickStatProps {
  label: string;
  value: string;
  variant?: "default" | "warning";
}

function QuickStat({ label, value, variant = "default" }: QuickStatProps) {
  return (
    <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800">
      <p
        className={`text-2xl font-bold ${
          variant === "warning" ? "text-secondary-500" : "text-neutral-900 dark:text-white"
        }`}
      >
        {value}
      </p>
      <p className="text-sm text-neutral-500">{label}</p>
    </div>
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

function DownloadIcon({ className }: { className?: string }) {
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
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
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
