/**
 * Filter Sidebar Component
 *
 * Provides filtering options for the politician directory.
 * Requirements: 1.2, 1.3, 1.4, 1.5, 1.6
 */

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { GovernmentLevel } from "@prisma/client";
import { PoliticianFilters } from "@/services/politician.service";

interface FilterSidebarProps {
  filters: PoliticianFilters;
}

// Government levels with display names
const GOVERNMENT_LEVELS: { value: GovernmentLevel; label: string }[] = [
  { value: "national", label: "National" },
  { value: "regional", label: "Regional" },
  { value: "provincial", label: "Provincial" },
  { value: "city", label: "City" },
  { value: "municipal", label: "Municipal" },
  { value: "barangay", label: "Barangay" },
];

// Common Philippine regions
const REGIONS = [
  "NCR",
  "CAR",
  "Region I",
  "Region II",
  "Region III",
  "Region IV-A",
  "Region IV-B",
  "Region V",
  "Region VI",
  "Region VII",
  "Region VIII",
  "Region IX",
  "Region X",
  "Region XI",
  "Region XII",
  "Region XIII",
  "BARMM",
];

// Common political parties
const PARTIES = [
  "PDP-Laban",
  "Lakas-CMD",
  "NPC",
  "NP",
  "LP",
  "Nacionalista Party",
  "Aksyon Demokratiko",
  "PFP",
  "Independent",
];

// Common positions
const POSITIONS = [
  "President",
  "Vice President",
  "Senator",
  "Congressman",
  "Governor",
  "Vice Governor",
  "Mayor",
  "Vice Mayor",
  "Councilor",
  "Barangay Captain",
];

export function FilterSidebar({ filters }: FilterSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateFilter = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());

      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }

      // Reset to page 1 when filters change
      params.delete("page");

      startTransition(() => {
        router.push(`/politicians?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  return (
    <div
      className={`rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900 ${
        isPending ? "opacity-70" : ""
      }`}
    >
      <h2 className="mb-6 text-lg font-semibold text-neutral-900 dark:text-white">Filters</h2>

      <div className="space-y-6">
        {/* Government Level Filter - Requirement 1.2 */}
        <FilterSection title="Government Level">
          <div className="space-y-2">
            {GOVERNMENT_LEVELS.map((level) => (
              <label key={level.value} className="flex cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name="level"
                  value={level.value}
                  checked={filters.level === level.value}
                  onChange={(e) => updateFilter("level", e.target.checked ? level.value : null)}
                  className="text-primary-500 focus:ring-primary-500 h-4 w-4 border-neutral-300"
                />
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  {level.label}
                </span>
              </label>
            ))}
            {filters.level && (
              <button
                onClick={() => updateFilter("level", null)}
                className="text-primary-500 hover:text-primary-600 mt-2 text-xs"
              >
                Clear selection
              </button>
            )}
          </div>
        </FilterSection>

        {/* Region Filter - Requirement 1.3 */}
        <FilterSection title="Region">
          <select
            value={filters.region || ""}
            onChange={(e) => updateFilter("region", e.target.value || null)}
            className="focus:border-primary-500 focus:ring-primary-500 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:ring-1 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          >
            <option value="">All Regions</option>
            {REGIONS.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </FilterSection>

        {/* Political Party Filter - Requirement 1.4 */}
        <FilterSection title="Political Party">
          <select
            value={filters.party || ""}
            onChange={(e) => updateFilter("party", e.target.value || null)}
            className="focus:border-primary-500 focus:ring-primary-500 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:ring-1 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          >
            <option value="">All Parties</option>
            {PARTIES.map((party) => (
              <option key={party} value={party}>
                {party}
              </option>
            ))}
          </select>
        </FilterSection>

        {/* Position Filter - Requirement 1.5 */}
        <FilterSection title="Position">
          <select
            value={filters.position || ""}
            onChange={(e) => updateFilter("position", e.target.value || null)}
            className="focus:border-primary-500 focus:ring-primary-500 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:ring-1 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          >
            <option value="">All Positions</option>
            {POSITIONS.map((position) => (
              <option key={position} value={position}>
                {position}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-neutral-500">
            National and Senator include dated Senate opening roster entries. Current office is
            unverified for those entries.
          </p>
        </FilterSection>

        {/* Red Flags Filter - Requirement 18.8 */}
        <FilterSection title="Red Flags">
          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={filters.hasRedFlags === true}
                onChange={(e) => updateFilter("hasRedFlags", e.target.checked ? "true" : null)}
                className="text-primary-500 focus:ring-primary-500 h-4 w-4 rounded border-neutral-300"
              />
              <span className="text-sm text-neutral-700 dark:text-neutral-300">
                Show only with red flags
              </span>
            </label>
          </div>
        </FilterSection>
      </div>
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-neutral-900 dark:text-white">{title}</h3>
      {children}
    </div>
  );
}
