/**
 * Pagination utility for database queries
 *
 * Implements pagination correctness as defined in Property 2:
 * - Contains at most S items (page size)
 * - Returns items from position (N-1)*S to N*S-1 in the full result set
 * - Reports accurate total count
 * - Returns empty array when N exceeds available pages
 */

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Validates pagination parameters
 * @throws Error if parameters are invalid
 */
export function validatePaginationParams(params: PaginationParams): void {
  if (!Number.isInteger(params.page) || params.page < 1) {
    throw new Error("Page number must be a positive integer");
  }
  if (!Number.isInteger(params.pageSize) || params.pageSize < 1) {
    throw new Error("Page size must be a positive integer");
  }
}

/**
 * Calculates the skip (offset) value for database queries
 * For page N with page size S, skip = (N-1) * S
 */
export function calculateSkip(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

/**
 * Calculates total number of pages
 */
export function calculateTotalPages(totalCount: number, pageSize: number): number {
  if (totalCount === 0) {
    return 0;
  }
  return Math.ceil(totalCount / pageSize);
}

/**
 * Paginates an array of items (for in-memory pagination)
 * Useful for testing and small datasets
 */
export function paginateArray<T>(items: T[], params: PaginationParams): PaginatedResult<T> {
  validatePaginationParams(params);

  const { page, pageSize } = params;
  const totalCount = items.length;
  const totalPages = calculateTotalPages(totalCount, pageSize);

  // If page exceeds available pages, return empty array
  if (page > totalPages && totalCount > 0) {
    return {
      items: [],
      totalCount,
      page,
      pageSize,
      totalPages,
      hasNextPage: false,
      hasPreviousPage: page > 1,
    };
  }

  // Handle empty dataset
  if (totalCount === 0) {
    return {
      items: [],
      totalCount: 0,
      page,
      pageSize,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    };
  }

  const skip = calculateSkip(page, pageSize);
  const paginatedItems = items.slice(skip, skip + pageSize);

  return {
    items: paginatedItems,
    totalCount,
    page,
    pageSize,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

/**
 * Creates a paginated result from database query results
 * Used with Prisma queries that return items and count separately
 */
export function createPaginatedResult<T>(
  items: T[],
  totalCount: number,
  params: PaginationParams
): PaginatedResult<T> {
  validatePaginationParams(params);

  const { page, pageSize } = params;
  const totalPages = calculateTotalPages(totalCount, pageSize);

  return {
    items,
    totalCount,
    page,
    pageSize,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

/**
 * Generates Prisma-compatible pagination options
 */
export function getPrismaPageOptions(params: PaginationParams): {
  skip: number;
  take: number;
} {
  validatePaginationParams(params);

  return {
    skip: calculateSkip(params.page, params.pageSize),
    take: params.pageSize,
  };
}
