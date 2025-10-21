import { z } from 'zod';

import {
  AppliedFilter,
  Filters,
  PaginatedResponse,
  PaginationMeta,
} from '../types/pagination.type.js';

// Enhanced pagination schema for validation with search and sorting
export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1, 'Page must be at least 1')),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 15))
    .pipe(z.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100')),
  search: z.string().optional(),
  sort_by: z.string().optional().default('id'),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
  filter: z.string().optional(),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

// Pagination utility functions
export function getPaginationParams(page: number, limit: number) {
  const offset = (page - 1) * limit;
  return {
    offset,
    limit,
    page,
  };
}

export function createPaginationResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
  search: string = '',
  sortBy: string = 'id',
  order: 'asc' | 'desc' = 'asc',
  appliedFilters: AppliedFilter[] = []
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  const paginationMeta: PaginationMeta = {
    current_page: page,
    per_page: limit,
    total,
    total_pages: totalPages,
    has_next_page: hasNextPage,
    has_prev_page: hasPrevPage,
    next_page: hasNextPage ? page + 1 : null,
    prev_page: hasPrevPage ? page - 1 : null,
  };

  const filters: Filters = {
    search,
    sort_by: sortBy,
    order,
    applied_filters: appliedFilters,
  };

  return {
    success: true,
    message: 'Data retrieved successfully',
    data,
    pagination: paginationMeta,
    filters,
  };
}
