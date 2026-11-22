import type { RefreshSource } from "@/lib/senate-refresh";

export function evidenceDate(date: string) {
  if (/^\d{4}$/.test(date)) {
    return date;
  }
  const monthOnly = /^\d{4}-\d{2}$/.test(date);
  return new Date(monthOnly ? `${date}-01T00:00:00Z` : `${date}T00:00:00Z`).toLocaleDateString(
    "en-PH",
    { year: "numeric", month: "long", ...(monthOnly ? {} : { day: "numeric" }), timeZone: "UTC" }
  );
}

export function RefreshSources({ sources }: { sources: RefreshSource[] }) {
  return (
    <details className="min-w-0 rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-700">
      <summary className="min-h-11 cursor-pointer py-2 font-medium">
        Sources for this update
      </summary>
      <p>
        Evidence version approved November 22, 2026.{" "}
        <a href="/data/senate-20-refresh-2026-11-22/INDEX.md" className="underline">
          Coverage and limits
        </a>{" "}
        ·{" "}
        <a href="/data/senate-20-refresh-2026-11-22/APPROVAL.json" className="underline">
          Approval record
        </a>
      </p>
      <ul className="mt-3 space-y-4">
        {sources.map((source) => (
          <li key={source.id} className="min-w-0 break-words">
            <a
              href={source.accessUrl ?? source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 dark:text-primary-400 underline"
            >
              {source.publisher}
            </a>
            <p>{source.locator}</p>
            <p className="text-neutral-600 dark:text-neutral-400">
              Source date:{" "}
              {source.documentDate ? evidenceDate(source.documentDate) : "Not established"}.
              {source.retrievedOn && ` Retrieved ${evidenceDate(source.retrievedOn)}.`}
              {source.reviewedOn && ` Evidence reviewed ${evidenceDate(source.reviewedOn)}.`}
            </p>
            <p>{source.accessMethod}</p>
            {source.dateMeaning && <p>{source.dateMeaning}</p>}
            <p>{source.independence}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}
