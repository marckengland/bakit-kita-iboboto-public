/**
 * Politician Selector Component
 *
 * Search and select politicians for comparison.
 * Requirements: 9.1, 9.3
 */

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { ReviewedMembership } from "@/app/politicians/components/ReviewedMembership";
import type { PoliticianSummary } from "@/services/comparison.service";

interface PoliticianSelectorProps {
  onSelect: (politician: PoliticianSummary) => void;
  excludeIds: string[];
  disabled?: boolean;
}

export function PoliticianSelector({
  onSelect,
  excludeIds,
  disabled = false,
}: PoliticianSelectorProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PoliticianSummary[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Search for politicians
  const searchPoliticians = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.length < 1) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      try {
        const excludeParam = excludeIds.length > 0 ? `&exclude=${excludeIds.join(",")}` : "";
        const response = await fetch(
          `/api/politicians/search?q=${encodeURIComponent(searchQuery)}&limit=10${excludeParam}`
        );
        if (response.ok) {
          const data = await response.json();
          setResults(data.results || []);
          setIsOpen((data.results || []).length > 0);
        }
      } catch (error) {
        console.error("Search error:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [excludeIds]
  );

  // Handle input change with debounce
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      setSelectedIndex(-1);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        searchPoliticians(value);
      }, 250);
    },
    [searchPoliticians]
  );

  // Handle selection
  const handleSelect = useCallback(
    (result: PoliticianSummary) => {
      const politician: PoliticianSummary = {
        id: result.id,
        fullName: result.fullName,
        photo: result.photo,
        currentPosition: result.currentPosition,
        currentParty: result.currentParty,
        ...(result.reviewedBatch && { reviewedBatch: result.reviewedBatch }),
      };
      onSelect(politician);
      setQuery("");
      setResults([]);
      setIsOpen(false);
      inputRef.current?.focus();
    },
    [onSelect]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || results.length === 0) {
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0 && results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
          }
          break;
        case "Escape":
          setIsOpen(false);
          setSelectedIndex(-1);
          break;
      }
    },
    [isOpen, results, selectedIndex, handleSelect]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup debounce
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      {/* Search Input */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <SearchIcon className="h-5 w-5 text-neutral-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 1 && results.length > 0 && setIsOpen(true)}
          placeholder={
            disabled ? "Maximum politicians selected" : "Search for a politician to add..."
          }
          disabled={disabled}
          autoComplete="off"
          className="focus:border-primary-500 focus:ring-primary-500/20 w-full rounded-lg border border-neutral-300 bg-white py-3 pr-4 pl-12 text-neutral-900 placeholder-neutral-500 transition-colors focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:placeholder-neutral-400 dark:disabled:bg-neutral-900"
          aria-label="Search politicians"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls="politician-search-results"
          role="combobox"
        />
        {isLoading && (
          <div className="absolute inset-y-0 right-4 flex items-center">
            <LoadingSpinner className="h-5 w-5 text-neutral-400" />
          </div>
        )}
      </div>
      {/* Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div
          id="politician-search-results"
          ref={dropdownRef}
          className="absolute z-50 mt-2 w-full rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
          role="listbox"
        >
          <ul className="max-h-80 overflow-y-auto py-2">
            {results.map((result, index) => (
              <li key={result.id} role="option" aria-selected={index === selectedIndex}>
                <button
                  type="button"
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                    index === selectedIndex
                      ? "bg-primary-50 dark:bg-primary-900/20"
                      : "hover:bg-neutral-50 dark:hover:bg-neutral-700/50"
                  }`}
                >
                  {/* Photo */}
                  {result.photo ? (
                    <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full">
                      <Image
                        src={result.photo}
                        alt={result.fullName}
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    </div>
                  ) : (
                    <div className="bg-primary-100 dark:bg-primary-900 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
                      <span className="text-primary-500 text-sm font-semibold">
                        {getInitials(result.fullName)}
                      </span>
                    </div>
                  )}

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-neutral-900 dark:text-white">
                      {result.fullName}
                    </p>
                    {result.reviewedBatch ? (
                      <ReviewedMembership
                        batch={result.reviewedBatch}
                        className="text-xs text-neutral-500"
                      />
                    ) : (
                      result.currentPosition && (
                        <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">
                          {result.currentPosition.title}
                          {result.currentPosition.jurisdiction &&
                            ` • ${result.currentPosition.jurisdiction}`}
                        </p>
                      )
                    )}
                  </div>

                  {/* Add indicator */}
                  <div className="text-primary-500 flex-shrink-0">
                    <PlusIcon className="h-5 w-5" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* No results message */}
      {isOpen && query.length >= 1 && results.length === 0 && !isLoading && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-2 w-full rounded-xl border border-neutral-200 bg-white p-4 text-center shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
        >
          <p className="text-neutral-600 dark:text-neutral-400">
            No politicians found matching &quot;{query}&quot;
          </p>
        </div>
      )}
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return `${parts[0]?.[0] || ""}${parts[parts.length - 1]?.[0] || ""}`.toUpperCase();
  }
  return (name[0] || "?").toUpperCase();
}

// Icons
function SearchIcon({ className }: { className?: string }) {
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
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
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
