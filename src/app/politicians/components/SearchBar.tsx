/**
 * Search Bar Component with Autocomplete
 *
 * Provides search functionality with autocomplete dropdown.
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AutocompleteSuggestion } from "@/lib/search";

interface SearchBarProps {
  initialQuery?: string;
  placeholder?: string;
  className?: string;
}

export function SearchBar({
  initialQuery = "",
  placeholder = "Search politicians by name, position, or location...",
  className = "",
}: SearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch autocomplete suggestions - Requirement 11.5
  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 1) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/search/autocomplete?q=${encodeURIComponent(searchQuery)}&limit=8`
      );
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
        setIsOpen(true);
      }
    } catch (error) {
      console.error("Error fetching autocomplete suggestions:", error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search input handler
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      setSelectedIndex(-1);

      // Clear previous debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Debounce autocomplete requests
      debounceRef.current = setTimeout(() => {
        fetchSuggestions(value);
      }, 200);
    },
    [fetchSuggestions]
  );

  // Handle search submission - Requirements 11.1, 11.3
  const handleSearch = useCallback(
    (searchQuery: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      } else {
        params.delete("q");
      }

      // Reset to page 1 when searching
      params.delete("page");

      setIsOpen(false);
      router.push(`/politicians?${params.toString()}`);
    },
    [router, searchParams]
  );

  // Handle suggestion selection
  const handleSelectSuggestion = useCallback(
    (suggestion: AutocompleteSuggestion) => {
      if (suggestion.type === "politician") {
        // Navigate directly to politician profile
        router.push(`/politicians/${suggestion.id}`);
      } else {
        // Search for the suggestion text
        setQuery(suggestion.text);
        handleSearch(suggestion.text);
      }
      setIsOpen(false);
    },
    [router, handleSearch]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || suggestions.length === 0) {
        if (e.key === "Enter") {
          handleSearch(query);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0 && suggestions[selectedIndex]) {
            handleSelectSuggestion(suggestions[selectedIndex]);
          } else {
            handleSearch(query);
          }
          break;
        case "Escape":
          setIsOpen(false);
          setSelectedIndex(-1);
          break;
      }
    },
    [isOpen, suggestions, selectedIndex, query, handleSearch, handleSelectSuggestion]
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

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
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
          onFocus={() => query.length >= 1 && suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="focus:border-primary-500 focus:ring-primary-500/20 w-full rounded-xl border border-neutral-300 bg-white py-3 pr-12 pl-12 text-neutral-900 placeholder-neutral-500 transition-colors focus:ring-2 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:placeholder-neutral-400"
          aria-label="Search politicians"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-controls="search-autocomplete-results"
          role="combobox"
        />
        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute inset-y-0 right-12 flex items-center">
            <LoadingSpinner className="h-5 w-5 text-neutral-400" />
          </div>
        )}
        {/* Clear button */}
        {query && !isLoading && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSuggestions([]);
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute inset-y-0 right-12 flex items-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            aria-label="Clear search"
          >
            <ClearIcon className="h-5 w-5" />
          </button>
        )}
        {/* Search button */}
        <button
          type="button"
          onClick={() => handleSearch(query)}
          className="text-primary-500 hover:text-primary-600 absolute inset-y-0 right-0 flex items-center pr-4"
          aria-label="Submit search"
        >
          <ArrowRightIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Autocomplete Dropdown - Requirement 11.5 */}
      {isOpen && suggestions.length > 0 && (
        <div
          id="search-autocomplete-results"
          ref={dropdownRef}
          className="absolute z-50 mt-2 w-full rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
          role="listbox"
        >
          <ul className="max-h-80 overflow-y-auto py-2">
            {suggestions.map((suggestion, index) => (
              <li
                key={`${suggestion.type}-${suggestion.id}`}
                role="option"
                aria-selected={index === selectedIndex}
              >
                <button
                  type="button"
                  onClick={() => handleSelectSuggestion(suggestion)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                    index === selectedIndex
                      ? "bg-primary-50 dark:bg-primary-900/20"
                      : "hover:bg-neutral-50 dark:hover:bg-neutral-700/50"
                  }`}
                >
                  <SuggestionIcon type={suggestion.type} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-neutral-900 dark:text-white">
                      {suggestion.text}
                    </p>
                    {suggestion.subtext && (
                      <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">
                        {suggestion.subtext}
                      </p>
                    )}
                  </div>
                  {suggestion.type === "politician" && (
                    <span className="flex-shrink-0 text-xs text-neutral-400">View profile →</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Icon Components
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

function ClearIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
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

function SuggestionIcon({ type }: { type: AutocompleteSuggestion["type"] }) {
  const iconClass = "h-8 w-8 flex-shrink-0 rounded-full p-1.5";

  switch (type) {
    case "politician":
      return (
        <div
          className={`${iconClass} bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-400`}
        >
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
            />
          </svg>
        </div>
      );
    case "position":
      return (
        <div
          className={`${iconClass} bg-secondary-100 text-secondary-600 dark:bg-secondary-900 dark:text-secondary-400`}
        >
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>
      );
    case "location":
      return (
        <div
          className={`${iconClass} bg-accent-100 text-accent-700 dark:bg-accent-900 dark:text-accent-400`}
        >
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
            />
          </svg>
        </div>
      );
    case "party":
      return (
        <div
          className={`${iconClass} bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400`}
        >
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
            />
          </svg>
        </div>
      );
    default:
      return (
        <div
          className={`${iconClass} bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400`}
        >
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
        </div>
      );
  }
}
