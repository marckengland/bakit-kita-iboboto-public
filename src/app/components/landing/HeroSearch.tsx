"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface Suggestion {
  id: string;
  text: string;
  type: "politician" | "position" | "location" | "party";
  subtext?: string;
}

export function HeroSearch() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const router = useRouter();
  const t = useTranslations("home");
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearch = useCallback(
    (searchQuery: string) => {
      if (searchQuery.trim()) {
        router.push(`/politicians?q=${encodeURIComponent(searchQuery.trim())}`);
      }
      setIsOpen(false);
    },
    [router]
  );

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 1) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/search/autocomplete?q=${encodeURIComponent(q)}&limit=6`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
        setIsOpen(true);
      }
    } catch {
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      setSelectedIndex(-1);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => fetchSuggestions(value), 200);
    },
    [fetchSuggestions]
  );

  const handleSelectSuggestion = useCallback(
    (suggestion: Suggestion) => {
      if (suggestion.type === "politician") {
        router.push(`/politicians/${suggestion.id}`);
      } else {
        setQuery(suggestion.text);
        handleSearch(suggestion.text);
      }
      setIsOpen(false);
    },
    [router, handleSearch]
  );

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

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  const TYPE_ICONS: Record<string, string> = {
    politician: "👤",
    position: "💼",
    location: "📍",
    party: "🏛️",
  };

  return (
    <form onSubmit={handleSubmit} className="relative mx-auto mt-8 max-w-xl">
      <div className="relative flex items-center">
        <div className="pointer-events-none absolute left-4 text-neutral-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <label htmlFor="hero-search" className="sr-only">
          {t("heroSearch.placeholder")}
        </label>
        <input
          ref={inputRef}
          id="hero-search"
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 1 && suggestions.length > 0 && setIsOpen(true)}
          placeholder={t("heroSearch.placeholder")}
          autoComplete="off"
          className="focus:border-primary-500 focus:ring-primary-200 dark:focus:border-primary-400 dark:focus:ring-primary-800 w-full rounded-full border-2 border-neutral-200 bg-white py-4 pr-32 pl-12 text-base shadow-lg transition-all focus:ring-2 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-controls="hero-autocomplete-results"
        />
        {isLoading && (
          <div className="absolute right-28 flex items-center">
            <div className="border-t-primary-500 h-4 w-4 animate-spin rounded-full border-2 border-neutral-300" />
          </div>
        )}
        <button
          type="submit"
          className="btn-primary absolute right-2 rounded-full px-6 py-2.5 text-sm font-semibold"
        >
          {t("heroSearch.button")}
        </button>
      </div>

      {/* Autocomplete dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div
          id="hero-autocomplete-results"
          ref={dropdownRef}
          className="absolute z-50 mt-2 w-full rounded-2xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-800"
          role="listbox"
        >
          <ul className="max-h-72 overflow-y-auto py-2">
            {suggestions.map((s, i) => (
              <li key={`${s.type}-${s.id}`} role="option" aria-selected={i === selectedIndex}>
                <button
                  type="button"
                  onClick={() => handleSelectSuggestion(s)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`flex w-full items-center gap-3 px-5 py-3 text-left transition-colors ${
                    i === selectedIndex
                      ? "bg-primary-50 dark:bg-primary-900/20"
                      : "hover:bg-neutral-50 dark:hover:bg-neutral-700/50"
                  }`}
                >
                  <span className="text-base" aria-hidden="true">
                    {TYPE_ICONS[s.type] || "👤"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-neutral-900 dark:text-white">
                      {s.text}
                    </p>
                    {s.subtext && (
                      <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">
                        {s.subtext}
                      </p>
                    )}
                  </div>
                  {s.type === "politician" && (
                    <span className="flex-shrink-0 text-xs text-neutral-400">→</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
