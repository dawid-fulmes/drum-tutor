import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { PaginationBar } from "@/components/pagination-bar";
import { QueryError } from "@/components/query-error";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { adminLessonsQueryOptions } from "@/features/admin-lessons/admin-lessons.api";
import {
  ADMIN_LESSONS_PAGE_SIZES,
  adminLessonsSearchSchema,
} from "@/features/admin-lessons/admin-lessons-search";
import { AdminLessonsTable } from "@/features/admin-lessons/admin-lessons-table";

export const Route = createFileRoute("/_authenticated/admin/lessons/")({
  validateSearch: adminLessonsSearchSchema,
  component: AdminLessonsPage,
});

function NewLessonButton() {
  return (
    <Button asChild>
      <Link to="/admin/lessons/new">New lesson</Link>
    </Button>
  );
}

function AdminLessonsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const lessons = useQuery(adminLessonsQueryOptions(search));
  const totalPages = lessons.data?.totalPages ?? 0;

  useEffect(() => {
    if (lessons.isSuccess && totalPages > 0 && search.page > totalPages) {
      void navigate({ search: (prev) => ({ ...prev, page: totalPages }), replace: true });
    }
  }, [lessons.isSuccess, totalPages, search.page, navigate]);

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Lessons</h1>
        <NewLessonButton />
      </div>
      {lessons.isError ? (
        <QueryError error={lessons.error} onRetry={() => lessons.refetch()} />
      ) : lessons.isPending ? (
        <AdminLessonsTable lessons={undefined} />
      ) : lessons.data.totalItems === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No lessons yet</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <NewLessonButton />
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <AdminLessonsTable lessons={lessons.data.items} />
          <PaginationBar
            page={search.page}
            totalPages={totalPages}
            pageSize={search.pageSize}
            pageSizes={ADMIN_LESSONS_PAGE_SIZES}
            onPageChange={(page) => navigate({ search: (prev) => ({ ...prev, page }) })}
            onPageSizeChange={(pageSize) =>
              navigate({
                search: (prev) => ({ ...prev, pageSize: pageSize as 20 | 50 | 100, page: 1 }),
              })
            }
          />
        </>
      )}
    </div>
  );
}
