import type { Page, PaginationQuery } from "@drum-tutor/contracts";

export function pageOffset(q: PaginationQuery): number {
  return (q.page - 1) * q.pageSize;
}

export function toPage<T>(items: T[], q: PaginationQuery, totalItems: number): Page<T> {
  return {
    items,
    page: q.page,
    pageSize: q.pageSize,
    totalItems,
    totalPages: Math.ceil(totalItems / q.pageSize),
  };
}
