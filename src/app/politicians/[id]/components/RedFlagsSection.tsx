/**
 * Red Flags Section Component
 *
 * Displays red flag indicators with click-through to detailed information.
 * Requirement: 18.5 - Display red flag indicators with click-through
 */

"use client";

import { useOnlineReview } from "@/hooks/useOnlineReview";
import { useState } from "react";
import { RedFlagData } from "@/services/red-flag.service";
import { SourcesAccordion } from "./SourcesAccordion";

interface RedFlagsSectionProps {
  redFlags: RedFlagData[];
  researchAvailability?: "available" | "withheld" | "unavailable";
}

export function RedFlagsSection({ redFlags, researchAvailability }: RedFlagsSectionProps) {
  const onlineReview = useOnlineReview();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!onlineReview) {
    return (
      <p className="card" role="status">
        Case details require an online review check. Reload this page when connected.
      </p>
    );
  }
  // Group red flags by type
  const groupedFlags = groupByType(redFlags);

  return (
    <div id="red-flags" className="card border-secondary-200 dark:border-secondary-800">
      <div className="mb-6 flex items-center gap-3">
        <div className="bg-secondary-100 dark:bg-secondary-900 flex h-10 w-10 items-center justify-center rounded-full">
          <svg className="text-secondary-500 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">Red Flags</h2>
          <p className="text-sm text-neutral-500">
            {redFlags.length} indicators currently shown.
            {researchAvailability === "withheld" && " Research is being reviewed."}
            {researchAvailability === "unavailable" &&
              " Reviewed research is temporarily unavailable."}
          </p>
        </div>
      </div>

      {/* Red Flag Categories */}
      <div className="space-y-4">
        {Object.entries(groupedFlags).map(([type, flags]) => (
          <RedFlagCategory
            key={type}
            type={type}
            flags={flags}
            expandedId={expandedId}
            onToggle={setExpandedId}
          />
        ))}
      </div>

      {/* Disclaimer */}
      <div className="mt-6 rounded-lg bg-neutral-50 p-4 dark:bg-neutral-800">
        <p className="text-xs text-neutral-500">
          <strong>Note:</strong> Red flags are based on documented information from the cited
          sources. Dynasty indicators alone are informational and not a negative judgment. Click on
          each item to view source details.
        </p>
      </div>
    </div>
  );
}

interface RedFlagCategoryProps {
  type: string;
  flags: RedFlagData[];
  expandedId: string | null;
  onToggle: (id: string | null) => void;
}

function RedFlagCategory({ type, flags, expandedId, onToggle }: RedFlagCategoryProps) {
  const typeConfig = getTypeConfig(type);

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700">
      {/* Category Header */}
      <div className={`flex items-center gap-3 p-4 ${typeConfig.bgClass}`}>
        <div className={`rounded-full p-2 ${typeConfig.iconBgClass}`}>{typeConfig.icon}</div>
        <div>
          <h3 className="font-medium text-neutral-900 dark:text-white">{typeConfig.label}</h3>
          <p className="text-sm text-neutral-500">
            {flags.length} item{flags.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Flag Items */}
      <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
        {flags.map((flag) => (
          <RedFlagItem
            key={flag.id}
            flag={flag}
            isExpanded={expandedId === flag.id}
            onToggle={() => onToggle(expandedId === flag.id ? null : flag.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface RedFlagItemProps {
  flag: RedFlagData;
  isExpanded: boolean;
  onToggle: () => void;
}

function RedFlagItem({ flag, isExpanded, onToggle }: RedFlagItemProps) {
  const severityConfig = getSeverityConfig(flag.severity);

  return (
    <div className="bg-white dark:bg-neutral-800">
      {/* Clickable Header - Requirement 18.5 */}
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700"
      >
        <div className="flex items-center gap-3">
          <span className={`badge ${severityConfig.badgeClass}`}>{severityConfig.label}</span>
          <span className="font-medium text-neutral-900 dark:text-white">{flag.title}</span>
        </div>
        <svg
          className={`h-5 w-5 text-neutral-400 transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900">
          {/* Description */}
          <p className="text-sm text-neutral-700 dark:text-neutral-300">{flag.description}</p>

          {/* Date */}
          {flag.eventDate && (
            <p className="mt-2 text-xs text-neutral-500">Date: {formatDate(flag.eventDate)}</p>
          )}

          {/* Sources */}
          {flag.sources.length > 0 && (
            <div className="mt-4">
              <SourcesAccordion sources={flag.sources} label="Sources" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function groupByType(flags: RedFlagData[]): Record<string, RedFlagData[]> {
  return flags.reduce(
    (acc, flag) => {
      const type = flag.type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(flag);
      return acc;
    },
    {} as Record<string, RedFlagData[]>
  );
}

function getTypeConfig(type: string) {
  const configs: Record<
    string,
    {
      label: string;
      bgClass: string;
      iconBgClass: string;
      icon: React.ReactNode;
    }
  > = {
    legal_case: {
      label: "Legal Cases",
      bgClass: "bg-secondary-50 dark:bg-secondary-900/20",
      iconBgClass: "bg-secondary-100 dark:bg-secondary-900",
      icon: (
        <svg className="text-secondary-500 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 2L3 7v11h14V7l-7-5zM9 12a1 1 0 112 0v3a1 1 0 11-2 0v-3zm1-4a1 1 0 100 2 1 1 0 000-2z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    corruption: {
      label: "Corruption Cases",
      bgClass: "bg-error-50 dark:bg-error-900/20",
      iconBgClass: "bg-error-100 dark:bg-error-900",
      icon: (
        <svg className="text-error-500 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    dynasty: {
      label: "Political Dynasty",
      bgClass: "bg-primary-50 dark:bg-primary-900/20",
      iconBgClass: "bg-primary-100 dark:bg-primary-900",
      icon: (
        <svg className="text-primary-500 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
        </svg>
      ),
    },
    saln_anomaly: {
      label: "SALN Anomalies",
      bgClass: "bg-warning-50 dark:bg-warning-900/20",
      iconBgClass: "bg-warning-100 dark:bg-warning-900",
      icon: (
        <svg className="text-warning-500 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" />
        </svg>
      ),
    },
    attendance: {
      label: "Attendance Issues",
      bgClass: "bg-neutral-50 dark:bg-neutral-800",
      iconBgClass: "bg-neutral-100 dark:bg-neutral-700",
      icon: (
        <svg className="h-4 w-4 text-neutral-500" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
  };

  return (
    configs[type] || {
      label: type,
      bgClass: "bg-neutral-50 dark:bg-neutral-800",
      iconBgClass: "bg-neutral-100 dark:bg-neutral-700",
      icon: (
        <svg className="h-4 w-4 text-neutral-500" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      ),
    }
  );
}

function getSeverityConfig(severity: string) {
  const configs: Record<string, { label: string; badgeClass: string }> = {
    info: {
      label: "Info",
      badgeClass: "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300",
    },
    warning: {
      label: "Warning",
      badgeClass: "bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-300",
    },
    critical: {
      label: "Critical",
      badgeClass: "bg-error-100 text-error-700 dark:bg-error-900 dark:text-error-300",
    },
  };

  return (
    configs[severity] || {
      label: severity,
      badgeClass: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
    }
  );
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
