/**
 * Community Reporting Skeleton Component
 *
 * Loading skeleton for the community reporting page.
 */

export function CommunityReportingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Tab Navigation Skeleton */}
      <div className="flex gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 w-32 rounded-lg bg-neutral-200 dark:bg-neutral-800" />
        ))}
      </div>

      {/* Form Skeleton */}
      <div className="card space-y-6">
        {/* Politician Selector */}
        <div className="space-y-2">
          <div className="h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-12 w-full rounded-lg bg-neutral-200 dark:bg-neutral-800" />
        </div>

        {/* Report Type */}
        <div className="space-y-2">
          <div className="h-4 w-20 rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="flex gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 w-28 rounded-lg bg-neutral-200 dark:bg-neutral-800" />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="space-y-2">
          <div className="h-4 w-16 rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-32 w-full rounded-lg bg-neutral-200 dark:bg-neutral-800" />
        </div>

        {/* Evidence */}
        <div className="space-y-2">
          <div className="h-4 w-20 rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-24 w-full rounded-lg border-2 border-dashed border-neutral-200 dark:border-neutral-800" />
        </div>

        {/* Submit Button */}
        <div className="h-12 w-full rounded-lg bg-neutral-200 dark:bg-neutral-800" />
      </div>
    </div>
  );
}
