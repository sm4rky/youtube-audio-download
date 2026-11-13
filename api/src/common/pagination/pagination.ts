export interface PaginationCriteria {
  page: number;
  perPage: number;
}

export interface Pagination {
  page: number;
  perPage: number;
  nextPage: number | null;
  hasMore: boolean;
}
