/**
 * Personal Information Section Component
 *
 * Displays personal information with source attribution for each field.
 * Requirements: 2.1, 12.6, 12.7, 12.8
 */

"use client";

import { useState } from "react";
import { PoliticianProfile, DataSourceAttribution } from "@/services/politician.service";
import { SourceTooltip } from "./SourceTooltip";

interface PersonalInfoSectionProps {
  politician: PoliticianProfile;
}

export function PersonalInfoSection({ politician }: PersonalInfoSectionProps) {
  return (
    <div className="card">
      <h2 className="mb-6 text-xl font-semibold text-neutral-900 dark:text-white">
        Personal Information
      </h2>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Full Name */}
        <InfoField
          label="Full Name"
          value={politician.fullName}
          sources={politician.sources["fullName"]}
        />

        {/* Birthday */}
        <InfoField
          label="Birthday"
          value={politician.birthday ? formatDate(politician.birthday) : null}
          sources={politician.sources["birthday"]}
        />

        {/* Birthplace */}
        <InfoField
          label="Birthplace"
          value={politician.birthplace}
          sources={politician.sources["birthplace"]}
        />

        {/* Current Party */}
        {politician.currentParty && (
          <InfoField
            label="Political Party"
            value={`${politician.currentParty.party.name}${
              politician.currentParty.party.abbreviation
                ? ` (${politician.currentParty.party.abbreviation})`
                : ""
            }`}
            subValue={`Since ${formatDate(politician.currentParty.startDate)}`}
            sources={politician.currentParty.sources}
          />
        )}
      </div>

      {/* Party Affiliation History - Requirement 2.4 */}
      {politician.partyAffiliations.length > 1 && (
        <div className="mt-8">
          <h3 className="mb-4 text-lg font-medium text-neutral-900 dark:text-white">
            Party Affiliation History
          </h3>
          <div className="space-y-3">
            {politician.partyAffiliations.map((affiliation) => (
              <PartyAffiliationItem
                key={affiliation.id}
                partyName={affiliation.party.name}
                abbreviation={affiliation.party.abbreviation}
                startDate={affiliation.startDate}
                endDate={affiliation.endDate}
                isCurrent={affiliation.isCurrent}
                sources={affiliation.sources}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface InfoFieldProps {
  label: string;
  value: string | null | undefined;
  subValue?: string;
  sources?: DataSourceAttribution[];
}

function InfoField({ label, value, subValue, sources }: InfoFieldProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!value) {
    return (
      <div>
        <p className="text-sm font-medium text-neutral-500">{label}</p>
        <p className="mt-1 text-neutral-400 italic">Not available</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <p className="text-sm font-medium text-neutral-500">{label}</p>
      <div
        className="group mt-1 inline-flex cursor-help items-center gap-2"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
      >
        <p className="text-neutral-900 dark:text-white">{value}</p>
        {sources && sources.length > 0 && <SourceIndicator sources={sources} />}
        {showTooltip && sources && sources.length > 0 && <SourceTooltip sources={sources} />}
      </div>
      {subValue && <p className="mt-0.5 text-sm text-neutral-500">{subValue}</p>}
    </div>
  );
}

interface SourceIndicatorProps {
  sources: DataSourceAttribution[];
}

function SourceIndicator({ sources }: SourceIndicatorProps) {
  const primarySource = sources[0];
  if (!primarySource) {
    return null;
  }

  const sourceTypeColors: Record<string, string> = {
    official_government:
      "bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-400",
    court_document:
      "bg-secondary-100 text-secondary-600 dark:bg-secondary-900 dark:text-secondary-400",
    comelec_filing: "bg-accent-100 text-accent-700 dark:bg-accent-900 dark:text-accent-400",
    legislative_record: "bg-success-100 text-success-600 dark:bg-success-900 dark:text-success-400",
    coa_report: "bg-warning-100 text-warning-600 dark:bg-warning-900 dark:text-warning-400",
    third_party_verified:
      "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
    ai_extracted: "bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400",
  };

  const colorClass =
    sourceTypeColors[primarySource.sourceType] || sourceTypeColors.third_party_verified;

  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${colorClass}`}
      title="Click for source details"
    >
      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}

interface PartyAffiliationItemProps {
  partyName: string;
  abbreviation?: string | null;
  startDate: Date;
  endDate?: Date | null;
  isCurrent: boolean;
  sources: DataSourceAttribution[];
}

function PartyAffiliationItem({
  partyName,
  abbreviation,
  startDate,
  endDate,
  isCurrent,
  sources,
}: PartyAffiliationItemProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="relative flex items-center justify-between rounded-lg border border-neutral-200 p-3 dark:border-neutral-700"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex items-center gap-3">
        <div
          className={`h-2 w-2 rounded-full ${
            isCurrent ? "bg-success-500" : "bg-neutral-300 dark:bg-neutral-600"
          }`}
        />
        <div>
          <p className="font-medium text-neutral-900 dark:text-white">
            {partyName}
            {abbreviation && <span className="ml-1 text-neutral-500">({abbreviation})</span>}
          </p>
          <p className="text-sm text-neutral-500">
            {formatDate(startDate)} - {endDate ? formatDate(endDate) : "Present"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isCurrent && <span className="badge-success text-xs">Current</span>}
        {sources.length > 0 && <SourceIndicator sources={sources} />}
      </div>
      {showTooltip && sources.length > 0 && (
        <div className="absolute top-full right-0 z-10 mt-1">
          <SourceTooltip sources={sources} />
        </div>
      )}
    </div>
  );
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
