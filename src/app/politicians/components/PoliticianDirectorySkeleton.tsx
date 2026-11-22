/**
 * Politician Directory Skeleton Component
 *
 * Loading state for the politician directory.
 */

export function PoliticianDirectorySkeleton() {
  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Mobile Filter Button Skeleton */}
      <div className="h-10 w-24 animate-pulse rounded-lg bg-neutral-200 lg:hidden dark:bg-neutral-800" />

      {/* Desktop Filter Sidebar Skeleton */}
      <aside className="hidden w-72 flex-shrink-0 lg:block">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-6 h-6 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="space-y-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i}>
                <div className="mb-3 h-4 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                <div className="space-y-2">
                  {[1, 2, 3].map((j) => (
                    <div
                      key={j}
                      className="h-8 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content Skeleton */}
      <div className="flex-1">
        {/* Results Header Skeleton */}
        <div className="mb-6 flex items-center justify-between">
          <div className="h-5 w-48 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
        </div>

        {/* Politicians Grid Skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <PoliticianCardSkeleton key={i} />
          ))}
        </div>

        {/* Pagination Skeleton */}
        <div className="mt-8 flex justify-center gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-10 w-10 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PoliticianCardSkeleton() {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex gap-4">
        {/* Photo Skeleton */}
        <div className="h-16 w-16 flex-shrink-0 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />

        {/* Info Skeleton */}
        <div className="flex-1 space-y-2">
          <div className="h-5 w-3/4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
        </div>
      </div>

      {/* Footer Skeleton */}
      <div className="mt-4 flex gap-2">
        <div className="h-5 w-16 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-5 w-20 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
      </div>
    </div>
  );
}
