import z from 'zod';

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sort_by?: string;
  order?: 'asc' | 'desc';
  filter?: string;
}

export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_next_page: boolean;
  has_prev_page: boolean;
  next_page: number | null;
  prev_page: number | null;
}

export interface AppliedFilter {
  column: string;
  value: string;
  condition: string;
}

export interface Filters {
  search: string;
  sort_by: string;
  order: string;
  applied_filters: AppliedFilter[];
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  pagination: PaginationMeta;
  filters: Filters;
}

export const defaultPaginationSearchSchema = z.object({
  page: z.number().optional().default(1),
  limit: z.number().optional().default(15),
  search: z.string().optional(),
  sort_by: z.string().optional().default('id'),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
  filter: z.string().optional(),
});

export type DefaultPaginationSearch = z.infer<typeof defaultPaginationSearchSchema>;
