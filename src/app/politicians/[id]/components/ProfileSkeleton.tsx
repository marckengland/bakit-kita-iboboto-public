/**
 * Profile Skeleton Component
 *
 * Loading skeleton for the politician profile page.
 */

export function ProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      {/* Header Skeleton */}
      <div className="card">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          {/* Photo Skeleton */}
          <div className="h-32 w-32 flex-shrink-0 rounded-xl bg-neutral-200 sm:h-40 sm:w-40 dark:bg-neutral-700" />

          {/* Info Skeleton */}
          <div className="flex-1 space-y-4">
            {/* Name */}
            <div className="h-8 w-64 rounded bg-neutral-200 dark:bg-neutral-700" />
            {/* Position */}
            <div className="h-6 w-48 rounded bg-neutral-200 dark:bg-neutral-700" />
            {/* Jurisdiction */}
            <div className="h-5 w-40 rounded bg-neutral-200 dark:bg-neutral-700" />

            {/* Badges */}
            <div className="flex gap-2">
              <div className="h-6 w-20 rounded-full bg-neutral-200 dark:bg-neutral-700" />
              <div className="h-6 w-24 rounded-full bg-neutral-200 dark:bg-neutral-700" />
              <div className="h-6 w-16 rounded-full bg-neutral-200 dark:bg-neutral-700" />
            </div>

            {/* Quick Stats */}
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-neutral-100 dark:bg-neutral-800" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Personal Info Skeleton */}
      <div className="card">
        <div className="mb-6 h-7 w-48 rounded bg-neutral-200 dark:bg-neutral-700" />
        <div className="grid gap-6 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-700" />
              <div className="h-5 w-40 rounded bg-neutral-200 dark:bg-neutral-700" />
            </div>
          ))}
        </div>
      </div>

      {/* Position History Skeleton */}
      <div className="card">
        <div className="mb-6 h-7 w-40 rounded bg-neutral-200 dark:bg-neutral-700" />
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 sm:gap-6">
              <div className="h-12 w-12 flex-shrink-0 rounded-full bg-neutral-200 dark:bg-neutral-700" />
              <div className="flex-1 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
                <div className="space-y-2">
                  <div className="h-5 w-48 rounded bg-neutral-200 dark:bg-neutral-700" />
                  <div className="h-4 w-36 rounded bg-neutral-200 dark:bg-neutral-700" />
                  <div className="flex gap-2">
                    <div className="h-5 w-16 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                    <div className="h-5 w-16 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
