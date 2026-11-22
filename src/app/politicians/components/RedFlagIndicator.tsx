/**
 * Red Flag Indicator Component
 *
 * Visual indicator for politicians with documented issues.
 * Requirement: 18.8 - Display red flag indicators in listings
 */

interface RedFlagIndicatorProps {
  count?: number;
  showCount?: boolean;
  size?: "sm" | "md" | "lg";
}

export function RedFlagIndicator({ count, showCount = false, size = "md" }: RedFlagIndicatorProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  const containerClasses = {
    sm: "h-5 w-5",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <div
      className={`bg-secondary-100 dark:bg-secondary-900 relative flex items-center justify-center rounded-full ${containerClasses[size]}`}
      title={count ? `${count} red flag${count > 1 ? "s" : ""}` : "Has red flags"}
    >
      <svg
        className={`text-secondary-500 ${sizeClasses[size]}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z"
          clipRule="evenodd"
        />
      </svg>
      {showCount && count && count > 0 && (
        <span className="bg-secondary-500 absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </div>
  );
}

/**
 * Red Flag Badge Component
 *
 * A badge-style indicator for inline use.
 */
export function RedFlagBadge({ label = "Red Flag" }: { label?: string }) {
  return (
    <span className="bg-secondary-100 text-secondary-700 dark:bg-secondary-900 dark:text-secondary-300 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z"
          clipRule="evenodd"
        />
      </svg>
      {label}
    </span>
  );
}
