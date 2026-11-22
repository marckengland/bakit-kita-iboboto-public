/**
 * Election Filters Component
 *
 * Filters for upcoming elections by location and position.
 * Requirements: 26.4
 */

"use client";

import { useState } from "react";

interface ElectionFiltersProps {
  filters: {
    level: string;
    type: string;
    jurisdiction: string;
    year: string;
  };
  onFilterChange: (filters: {
    level: string;
    type: string;
    jurisdiction: string;
    year: string;
  }) => void;
}

export function ElectionFilters({ filters, onFilterChange }: ElectionFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleChange = (key: keyof typeof filters, value: string) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFilterChange({ level: "", type: "", jurisdiction: "", year: "" });
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  // Generate year options (current year to 3 years ahead)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 4 }, (_, i) => currentYear + i);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2">
        {/* Type Filter */}
        <select
          value={filters.type}
          onChange={(e) => handleChange("type", e.target.value)}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        >
          <option value="">All Types</option>
          <option value="national">National</option>
          <option value="local">Local</option>
          <option value="barangay">Barangay</option>
          <option value="special">Special</option>
        </select>

        {/* Level Filter */}
        <select
          value={filters.level}
          onChange={(e) => handleChange("level", e.target.value)}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        >
          <option value="">All Levels</option>
          <option value="national">National</option>
          <option value="regional">Regional</option>
          <option value="provincial">Provincial</option>
          <option value="city">City</option>
          <option value="municipal">Municipal</option>
          <option value="barangay">Barangay</option>
        </select>

        {/* Year Filter */}
        <select
          value={filters.year}
          onChange={(e) => handleChange("year", e.target.value)}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        >
          <option value="">All Years</option>
          {yearOptions.map((year) => (
            <option key={year} value={year.toString()}>
              {year}
            </option>
          ))}
        </select>

        {/* More Filters Toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
        >
          <FilterIcon className="h-4 w-4" />
          More
          <ChevronIcon
            className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button onClick={clearFilters} className="text-primary-500 text-sm hover:underline">
          Clear all
        </button>
      )}

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="mt-3 w-full rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Jurisdiction Search */}
            <div>
              <label
                htmlFor="jurisdiction"
                className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
              >
                Location / Jurisdiction
              </label>
              <input
                id="jurisdiction"
                type="text"
                value={filters.jurisdiction}
                onChange={(e) => handleChange("jurisdiction", e.target.value)}
                placeholder="e.g., Manila, NCR, Cebu"
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:placeholder:text-neutral-600"
              />
            </div>

            {/* Region Quick Select */}
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Quick Select Region
              </label>
              <div className="flex flex-wrap gap-1">
                {["NCR", "Region III", "Region IV-A", "Region VII"].map((region) => (
                  <button
                    key={region}
                    onClick={() => handleChange("jurisdiction", region)}
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      filters.jurisdiction === region
                        ? "bg-primary-500 text-white"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-600"
                    }`}
                  >
                    {region}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Icon Components
function FilterIcon({ className }: { className?: string }) {
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
        d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z"
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
