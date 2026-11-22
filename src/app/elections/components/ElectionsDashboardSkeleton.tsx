/**
 * Elections Dashboard Skeleton Component
 *
 * Loading skeleton for the elections dashboard.
 */

export function ElectionsDashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats Overview Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card flex items-center gap-4">
            <div className="h-12 w-12 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-700" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-20 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
              <div className="h-6 w-12 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
            </div>
          </div>
        ))}
      </div>

      {/* Filters Skeleton */}
      <div className="flex flex-wrap gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-9 w-24 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-700"
          />
        ))}
      </div>

      {/* Main Content Skeleton */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar/List Skeleton */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <div className="h-6 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
              <div className="flex gap-2">
                <div className="h-8 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                <div className="h-8 w-8 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                <div className="h-8 w-8 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
              </div>
            </div>

            {/* Calendar Grid Skeleton */}
            <div className="mb-2 grid grid-cols-7 gap-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="py-2 text-center text-xs font-medium text-neutral-500">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Skeleton */}
        <div className="space-y-6">
          {/* Deadlines Skeleton */}
          <div className="card">
            <div className="mb-4 h-6 w-40 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800"
                />
              ))}
            </div>
          </div>

          {/* Voting List Skeleton */}
          <div className="card">
            <div className="mb-4 h-6 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="h-12 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
            <div className="mt-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
