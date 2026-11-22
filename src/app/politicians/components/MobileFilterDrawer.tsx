/**
 * Mobile Filter Drawer Component
 *
 * Provides a mobile-friendly filter interface.
 * Requirement: 1.7 - Responsive layout optimized for smaller screens
 */

"use client";

import { useState } from "react";
import { PoliticianFilters } from "@/services/politician.service";
import { FilterSidebar } from "./FilterSidebar";

interface MobileFilterDrawerProps {
  filters: PoliticianFilters;
  activeFilterCount: number;
}

export function MobileFilterDrawer({ filters, activeFilterCount }: MobileFilterDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Filter Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 lg:hidden dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
          />
        </svg>
        Filters
        {activeFilterCount > 0 && (
          <span className="bg-primary-500 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Drawer Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-full max-w-sm transform bg-neutral-50 transition-transform duration-300 ease-in-out lg:hidden dark:bg-neutral-950 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-4 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Filters</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            aria-label="Close filters"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Drawer Content */}
        <div className="h-full overflow-y-auto p-4 pb-24">
          <FilterSidebar filters={filters} />
        </div>

        {/* Drawer Footer */}
        <div className="absolute right-0 bottom-0 left-0 border-t border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <button onClick={() => setIsOpen(false)} className="btn-primary w-full">
            Apply Filters
          </button>
        </div>
      </div>
    </>
  );
}
