export interface PaginationParams {
  /** Nomor halaman (1-based). Default 1. */
  page?: number;
  /** Jumlah item per halaman (1..100). Default 20. */
  limit?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}
