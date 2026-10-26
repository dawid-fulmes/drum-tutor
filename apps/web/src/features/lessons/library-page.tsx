import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { PaginationBar } from "@/components/pagination-bar";
import { QueryError } from "@/components/query-error";
import { SelectedTags } from "@/features/tags/selected-tags";
import { useTagsByIds } from "@/features/tags/tags.api";
import { LessonCard } from "./lesson-card";
import { LessonCardSkeleton } from "./lesson-card-skeleton";
import { libraryQueryOptions } from "./lessons.api";
import { LibraryEmpty } from "./library-empty";
import { LibraryFilters } from "./library-filters";
import { hasActiveFilters, LIBRARY_PAGE_SIZES, type LibrarySearch } from "./library-search";

const route = getRouteApi("/_authenticated/_app/lessons/");

export function LibraryPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const lessons = useQuery(libraryQueryOptions(search));
  const tags = useTagsByIds(search.tagIds);
  const totalPages = lessons.data?.totalPages ?? 0;
  // The last known page count keeps the page links visible (but disabled) while a page loads.
  const lastTotalPages = useRef(0);
  if (lessons.data) lastTotalPages.current = lessons.data.totalPages;

  // Filters and sort always go back to the first page.
  const change = (patch: Partial<LibrarySearch>) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch, page: 1 }) });
  const clear = () => change({ tagIds: [], difficulties: [] });

  useEffect(() => {
    if (lessons.isSuccess && totalPages > 0 && search.page > totalPages) {
      void navigate({ search: (prev) => ({ ...prev, page: totalPages }), replace: true });
    }
  }, [lessons.isSuccess, totalPages, search.page, navigate]);

  // Drop ids of tags that no longer exist, only once the lookup for this exact id set succeeded.
  useEffect(() => {
    if (!tags.isSuccess || tags.data.length >= search.tagIds.length) return;
    const known = new Set(tags.data.map((tag) => tag.id));
    void navigate({
      search: (prev) => ({ ...prev, tagIds: prev.tagIds.filter((id) => known.has(id)), page: 1 }),
      replace: true,
    });
  }, [tags.isSuccess, tags.data, search.tagIds.length, navigate]);

  // No data (loading) or no results: a disabled bar, so the layout does not jump.
  const pager = (disabled: boolean, pages: number) => (
    <PaginationBar
      page={search.page}
      totalPages={pages}
      pageSize={search.pageSize}
      pageSizes={LIBRARY_PAGE_SIZES}
      disabled={disabled}
      onPageChange={(page) => void navigate({ search: (prev) => ({ ...prev, page }) })}
      onPageSizeChange={(pageSize) =>
        void navigate({
          search: (prev) => ({
            ...prev,
            pageSize: LIBRARY_PAGE_SIZES.find((size) => size === pageSize) ?? prev.pageSize,
            page: 1,
          }),
        })
      }
    />
  );

  return (
    <div className="grid gap-6">
      <h1 className="text-xl font-semibold">Library</h1>
      <LibraryFilters search={search} onChange={change} onClear={clear} />
      <div className="grid gap-2">
        <SelectedTags
          ids={search.tagIds}
          onRemove={(id) => change({ tagIds: search.tagIds.filter((tagId) => tagId !== id) })}
        />
        {lessons.isSuccess && (
          <p className="text-sm text-muted-foreground">
            {lessons.data.totalItems === 1 ? "1 lesson" : `${lessons.data.totalItems} lessons`}
          </p>
        )}
      </div>
      {lessons.isError && !lessons.data ? (
        <QueryError error={lessons.error} onRetry={() => lessons.refetch()} />
      ) : !lessons.data ? (
        <>
          <LessonGrid>
            {Array.from({ length: search.pageSize }, (_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders without identity
              <LessonCardSkeleton key={index} />
            ))}
          </LessonGrid>
          {pager(true, lastTotalPages.current)}
        </>
      ) : lessons.data.totalItems === 0 ? (
        <>
          <LibraryEmpty filtered={hasActiveFilters(search)} onClearFilters={clear} />
          {pager(true, 0)}
        </>
      ) : (
        <>
          <LessonGrid>
            {lessons.data.items.map((lesson) => (
              <LessonCard key={lesson.id} lesson={lesson} librarySearch={search} />
            ))}
          </LessonGrid>
          {pager(false, totalPages)}
        </>
      )}
    </div>
  );
}

function LessonGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
