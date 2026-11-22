/**
 * Civic Education Skeleton Component
 *
 * Loading skeleton for the civic education section.
 */

export function CivicEducationSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Section Navigation Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-neutral-200 dark:bg-neutral-700" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-neutral-200 dark:bg-neutral-700" />
                <div className="h-3 w-1/2 rounded bg-neutral-200 dark:bg-neutral-700" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Content Skeleton */}
      <div className="card">
        <div className="space-y-4">
          <div className="h-6 w-1/3 rounded bg-neutral-200 dark:bg-neutral-700" />
          <div className="h-4 w-1/4 rounded bg-neutral-200 dark:bg-neutral-700" />
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="h-4 w-5/6 rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="h-4 w-4/5 rounded bg-neutral-200 dark:bg-neutral-700" />
          </div>
        </div>
      </div>

      {/* Cards Grid Skeleton */}
      <div className="card">
        <div className="mb-4 h-5 w-1/4 rounded bg-neutral-200 dark:bg-neutral-700" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700"
            >
              <div className="space-y-3">
                <div className="h-8 w-8 rounded-lg bg-neutral-200 dark:bg-neutral-700" />
                <div className="h-4 w-3/4 rounded bg-neutral-200 dark:bg-neutral-700" />
                <div className="h-3 w-1/2 rounded bg-neutral-200 dark:bg-neutral-700" />
                <div className="space-y-2">
                  <div className="h-3 w-full rounded bg-neutral-200 dark:bg-neutral-700" />
                  <div className="h-3 w-5/6 rounded bg-neutral-200 dark:bg-neutral-700" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Additional Content Skeleton */}
      <div className="card">
        <div className="space-y-4">
          <div className="h-5 w-1/3 rounded bg-neutral-200 dark:bg-neutral-700" />
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700"
              >
                <div className="space-y-2">
                  <div className="h-4 w-1/2 rounded bg-neutral-200 dark:bg-neutral-700" />
                  <div className="h-3 w-full rounded bg-neutral-200 dark:bg-neutral-700" />
                  <div className="h-3 w-4/5 rounded bg-neutral-200 dark:bg-neutral-700" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
