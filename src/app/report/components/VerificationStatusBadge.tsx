/**
 * Verification Status Badge Component
 *
 * Displays the verification status of community reports.
 * Requirements: 28.4, 28.8
 */

interface VerificationStatusBadgeProps {
  status: "pending" | "verified" | "rejected";
  confidence?: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export function VerificationStatusBadge({
  status,
  confidence,
  showLabel = true,
  size = "md",
}: VerificationStatusBadgeProps) {
  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
    lg: "px-3 py-1.5 text-base",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  switch (status) {
    case "verified":
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-green-100 font-medium text-green-800 dark:bg-green-900 dark:text-green-200 ${sizeClasses[size]}`}
        >
          <CheckCircleIcon className={iconSizes[size]} />
          {showLabel && (
            <>
              Verified
              {confidence && (
                <span className="text-green-600 dark:text-green-400">
                  ({Math.round(confidence * 100)}%)
                </span>
              )}
            </>
          )}
        </span>
      );

    case "rejected":
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-red-100 font-medium text-red-800 dark:bg-red-900 dark:text-red-200 ${sizeClasses[size]}`}
        >
          <XCircleIcon className={iconSizes[size]} />
          {showLabel && "Rejected"}
        </span>
      );

    case "pending":
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-yellow-100 font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 ${sizeClasses[size]}`}
        >
          <ClockIcon className={iconSizes[size]} />
          {showLabel && "Pending Review"}
        </span>
      );
  }
}

/**
 * Community Source Badge Component
 *
 * Indicates that information is community-sourced.
 * Requirement 28.8: Clearly distinguish community-sourced info
 */
export function CommunitySourceBadge({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
    lg: "px-3 py-1.5 text-base",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-purple-100 font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-200 ${sizeClasses[size]}`}
      title="This information was submitted by the community and verified by our team"
    >
      <UsersIcon className={iconSizes[size]} />
      Community-Sourced
    </span>
  );
}

// Icon Components
function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
      />
    </svg>
  );
}
