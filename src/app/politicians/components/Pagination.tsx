/**
 * Pagination Component
 *
 * Provides navigation between pages of results.
 * Requirement: 1.1 - Paginated list of politicians
 */

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
  searchParams: Record<string, string | undefined>;
}

export function Pagination({ currentPage, totalPages, baseUrl, searchParams }: PaginationProps) {
  const pages = getPageNumbers(currentPage, totalPages);

  const buildUrl = (page: number) => {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value && key !== "page") {
        params.set(key, value);
      }
    });
    params.set("page", page.toString());
    return `${baseUrl}?${params.toString()}`;
  };

  return (
    <nav className="flex items-center justify-center gap-1" aria-label="Pagination">
      {/* Previous Button */}
      <PaginationLink
        href={currentPage > 1 ? buildUrl(currentPage - 1) : undefined}
        disabled={currentPage <= 1}
        aria-label="Previous page"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </PaginationLink>

      {/* Page Numbers */}
      <div className="hidden items-center gap-1 sm:flex">
        {pages.map((page, index) =>
          page === "..." ? (
            <span key={`ellipsis-${index}`} className="px-2 text-neutral-400">
              ...
            </span>
          ) : (
            <PaginationLink
              key={page}
              href={buildUrl(page as number)}
              isActive={page === currentPage}
            >
              {page}
            </PaginationLink>
          )
        )}
      </div>

      {/* Mobile Page Indicator */}
      <span className="px-4 text-sm text-neutral-600 sm:hidden dark:text-neutral-400">
        Page {currentPage} of {totalPages}
      </span>

      {/* Next Button */}
      <PaginationLink
        href={currentPage < totalPages ? buildUrl(currentPage + 1) : undefined}
        disabled={currentPage >= totalPages}
        aria-label="Next page"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </PaginationLink>
    </nav>
  );
}

interface PaginationLinkProps {
  href?: string;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  "aria-label"?: string;
}

function PaginationLink({
  href,
  isActive,
  disabled,
  children,
  "aria-label": ariaLabel,
}: PaginationLinkProps) {
  const baseClasses =
    "flex h-10 min-w-[2.5rem] items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors";

  if (disabled || !href) {
    return (
      <span
        className={`${baseClasses} cursor-not-allowed text-neutral-300 dark:text-neutral-700`}
        aria-disabled="true"
      >
        {children}
      </span>
    );
  }

  if (isActive) {
    return (
      <span className={`${baseClasses} bg-primary-500 text-white`} aria-current="page">
        {children}
      </span>
    );
  }

  return (
    <a
      href={href}
      className={`${baseClasses} text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800`}
      aria-label={ariaLabel}
    >
      {children}
    </a>
  );
}

/**
 * Generate page numbers to display with ellipsis for large page counts
 */
function getPageNumbers(currentPage: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [];

  // Always show first page
  pages.push(1);

  if (currentPage > 3) {
    pages.push("...");
  }

  // Show pages around current page
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let i = start; i <= end; i++) {
    if (!pages.includes(i)) {
      pages.push(i);
    }
  }

  if (currentPage < totalPages - 2) {
    pages.push("...");
  }

  // Always show last page
  if (!pages.includes(totalPages)) {
    pages.push(totalPages);
  }

  return pages;
}
