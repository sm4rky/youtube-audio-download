export interface Pagination {
  page: number;
  perPage: number;
  nextPage: number | null;
  hasMore: boolean;
}
