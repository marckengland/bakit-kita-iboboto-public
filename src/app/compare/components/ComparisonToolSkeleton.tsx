/**
 * Comparison Tool Skeleton Component
 *
 * Loading skeleton for the comparison tool.
 */

export function ComparisonToolSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Selection Panel Skeleton */}
      <div className="card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="h-6 w-40 rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="mt-2 h-4 w-32 rounded bg-neutral-200 dark:bg-neutral-700" />
          </div>
        </div>

        {/* Search Input Skeleton */}
        <div className="mt-4">
          <div className="h-12 w-full rounded-lg bg-neutral-200 dark:bg-neutral-700" />
        </div>
      </div>

      {/* Comparison Table Skeleton */}
      <div className="card overflow-hidden p-0">
        {/* Header Row */}
        <div className="grid grid-cols-4 border-b border-neutral-200 dark:border-neutral-700">
          <div className="border-r border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800/50">
            <div className="h-4 w-20 rounded bg-neutral-200 dark:bg-neutral-600" />
          </div>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex flex-col items-center border-r border-neutral-200 bg-neutral-50 p-4 last:border-r-0 dark:border-neutral-700 dark:bg-neutral-800/50"
            >
              <div className="h-16 w-16 rounded-full bg-neutral-200 dark:bg-neutral-600" />
              <div className="mt-3 h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-600" />
              <div className="mt-2 h-3 w-16 rounded bg-neutral-200 dark:bg-neutral-600" />
            </div>
          ))}
        </div>

        {/* Data Rows */}
        {[1, 2, 3, 4, 5].map((row) => (
          <div
            key={row}
            className="grid grid-cols-4 border-b border-neutral-200 last:border-b-0 dark:border-neutral-700"
          >
            <div className="border-r border-neutral-200 bg-neutral-50/50 p-4 dark:border-neutral-700 dark:bg-neutral-800/30">
              <div className="h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-600" />
            </div>
            {[1, 2, 3].map((col) => (
              <div
                key={col}
                className="flex items-center justify-center border-r border-neutral-200 p-4 last:border-r-0 dark:border-neutral-700"
              >
                <div className="h-4 w-16 rounded bg-neutral-200 dark:bg-neutral-700" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
