/**
 * Politician Search Select Component
 *
 * Searchable dropdown for selecting a politician.
 */

"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

interface Politician {
  id: string;
  fullName: string;
  currentPosition?: string;
  photo?: string;
}

interface PoliticianSearchSelectProps {
  value?: string;
  onChange: (politicianId: string, politicianName: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function PoliticianSearchSelect({
  value,
  onChange,
  placeholder = "Maghanap ng pulitiko...",
  disabled = false,
}: PoliticianSearchSelectProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<Politician[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPolitician, setSelectedPolitician] = useState<Politician | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch politician by ID if value is provided
  useEffect(() => {
    if (value && !selectedPolitician) {
      fetch(`/api/politicians/${value}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.politician) {
            setSelectedPolitician({
              id: data.politician.id,
              fullName: data.politician.fullName,
              currentPosition: data.politician.currentPosition?.title,
              photo: data.politician.photo,
            });
          }
        })
        .catch(console.error);
    }
  }, [value, selectedPolitician]);

  // Search politicians
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=10`);
        const data = await res.json();
        setResults(
          data.results?.map((r: { politician: Politician }) => ({
            id: r.politician.id,
            fullName: r.politician.fullName,
            currentPosition: r.politician.currentPosition,
            photo: r.politician.photo,
          })) || []
        );
      } catch (error) {
        console.error("Search error:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (politician: Politician) => {
    setSelectedPolitician(politician);
    onChange(politician.id, politician.fullName);
    setQuery("");
    setIsOpen(false);
  };

  const handleClear = () => {
    setSelectedPolitician(null);
    onChange("", "");
    setQuery("");
  };

  return (
    <div ref={containerRef} className="relative">
      {selectedPolitician ? (
        <div className="flex items-center justify-between rounded-lg border border-neutral-300 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-800">
          <div className="flex items-center gap-3">
            {selectedPolitician.photo ? (
              <Image
                src={selectedPolitician.photo}
                alt={selectedPolitician.fullName}
                width={40}
                height={40}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700">
                <span className="text-lg font-medium text-neutral-600 dark:text-neutral-400">
                  {selectedPolitician.fullName.charAt(0)}
                </span>
              </div>
            )}
            <div>
              <p className="font-medium text-neutral-900 dark:text-white">
                {selectedPolitician.fullName}
              </p>
              {selectedPolitician.currentPosition && (
                <p className="text-sm text-neutral-500">{selectedPolitician.currentPosition}</p>
              )}
            </div>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-700"
            >
              <XIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      ) : (
        <div>
          <div className="relative">
            <SearchIcon className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder={placeholder}
              disabled={disabled}
              className="focus:border-primary-500 focus:ring-primary-500/20 w-full rounded-lg border border-neutral-300 bg-white py-3 pr-4 pl-10 text-neutral-900 placeholder-neutral-400 focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            />
            {isLoading && (
              <div className="absolute top-1/2 right-3 -translate-y-1/2">
                <LoadingSpinner className="h-5 w-5 text-neutral-400" />
              </div>
            )}
          </div>

          {/* Dropdown */}
          {isOpen && query.length >= 2 && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
              {results.length > 0 ? (
                <ul className="max-h-60 overflow-auto py-2">
                  {results.map((politician) => (
                    <li key={politician.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(politician)}
                        className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700"
                      >
                        {politician.photo ? (
                          <Image
                            src={politician.photo}
                            alt={politician.fullName}
                            width={32}
                            height={32}
                            className="rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700">
                            <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                              {politician.fullName.charAt(0)}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-neutral-900 dark:text-white">
                            {politician.fullName}
                          </p>
                          {politician.currentPosition && (
                            <p className="text-xs text-neutral-500">{politician.currentPosition}</p>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-4 py-3 text-sm text-neutral-500">
                  {isLoading ? "Naghahanap..." : "Walang nahanap na resulta"}
                </div>
              )}
            </div>
          )}
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
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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
