"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";

export interface HomeProfile {
  id: string;
  fullName: string;
}
export function HomeProfileSearch({
  label,
  profiles,
  value,
  excludeId,
  disabled,
  onSelect,
}: {
  label: string;
  profiles: HomeProfile[];
  value: HomeProfile | null;
  excludeId?: string;
  disabled: boolean;
  onSelect: (profile: HomeProfile | null) => void;
}) {
  const t = useTranslations("home.research");
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<HomeProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(-1);
  const local = profiles.filter((profile) =>
    profile.fullName.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  );
  const results = [
    ...new Map([...local, ...remote].map((profile) => [profile.id, profile])).values(),
  ]
    .filter((profile) => profile.id !== excludeId)
    .slice(0, 10);
  const expanded = open && query.trim().length > 0 && !value;

  useEffect(() => {
    setRemote([]);
    setFailed(false);
    if (!query.trim() || disabled || value) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/politicians/search?q=${encodeURIComponent(query.trim())}&limit=10`,
          { signal: controller.signal, cache: "no-store" }
        );
        if (!response.ok) {
          throw new Error("Profile lookup unavailable");
        }
        const data = await response.json();
        if (!Array.isArray(data.results)) {
          throw new Error("Invalid profile response");
        }
        if (!controller.signal.aborted) {
          setRemote(
            data.results.filter(
              (profile: HomeProfile) =>
                typeof profile.id === "string" && typeof profile.fullName === "string"
            )
          );
        }
      } catch {
        if (!controller.signal.aborted) {
          setFailed(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, disabled, value]);

  function choose(profile: HomeProfile) {
    onSelect(profile);
    setQuery(profile.fullName);
    setOpen(false);
    setActive(-1);
  }
  return (
    <div className="relative min-w-0">
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={`${id}-results`}
        aria-activedescendant={
          expanded && active >= 0 && results[active]
            ? `${id}-option-${results[active].id}`
            : undefined
        }
        autoComplete="off"
        value={query}
        disabled={disabled}
        placeholder={t("searchPerson")}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          setActive(-1);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          onSelect(null);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            setActive(-1);
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActive((previous) =>
              event.key === "ArrowDown"
                ? Math.min(previous + 1, results.length - 1)
                : Math.max(previous - 1, 0)
            );
          }
          if (event.key === "Enter" && expanded) {
            event.preventDefault();
            const result = results[active] ?? (results.length === 1 ? results[0] : undefined);
            if (result) {
              choose(result);
            }
          }
        }}
        className="min-h-12 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-neutral-600 dark:bg-neutral-950 dark:text-white"
      />
      {value && (
        <p
          className="mt-1 text-xs text-neutral-600 dark:text-neutral-400"
          data-selected-profile={value.id}
        >
          {t("selectedPerson", { name: value.fullName })}
        </p>
      )}
      <div
        hidden={!expanded}
        className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-neutral-300 bg-white shadow-lg dark:border-neutral-600 dark:bg-neutral-950"
      >
        <ul id={`${id}-results`} role="listbox" aria-label={label}>
          {results.map((profile, index) => (
            <li
              key={profile.id}
              id={`${id}-option-${profile.id}`}
              role="option"
              aria-selected={index === active}
              data-profile-id={profile.id}
            >
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(profile)}
                className={`min-h-11 w-full px-3 py-2 text-left text-sm ${index === active ? "bg-neutral-100 dark:bg-neutral-800" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
              >
                {profile.fullName}
              </button>
            </li>
          ))}
        </ul>
        {loading && (
          <p role="status" className="px-3 py-2 text-sm">
            {t("searchingPeople")}
          </p>
        )}
        {!loading && !results.length && (
          <p role={failed ? "alert" : "status"} className="px-3 py-2 text-sm">
            {t(failed ? "peopleUnavailable" : "noPeople")}
          </p>
        )}
      </div>
    </div>
  );
}
