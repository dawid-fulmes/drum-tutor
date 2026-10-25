import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { NotFound } from "@/components/not-found";
import { QueryError } from "@/components/query-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PracticePanel } from "@/features/practice/practice-panel";
import { ApiClientError } from "@/lib/api-client";
import { formatDuration } from "./duration";
import { formatDifficulty } from "./format";
import { lessonQueryOptions } from "./lessons.api";

// Set by the library cards; survives a reload of this page because it lives in history state.
function useLibrarySearch() {
  return useLocation({ select: (location) => location.state.librarySearch });
}

export function LessonNotFound() {
  const librarySearch = useLibrarySearch();
  return (
    <NotFound
      title="Lesson not found"
      backTo="/lessons"
      backSearch={librarySearch}
      backLabel="Back to library"
    />
  );
}

function BackToLibrary() {
  const librarySearch = useLibrarySearch();
  return (
    <Button asChild variant="ghost" size="sm" className="justify-self-start">
      <Link to="/lessons" search={librarySearch}>
        ‹ Back to library
      </Link>
    </Button>
  );
}

export function LessonDetails({ id }: { id: string }) {
  const lesson = useQuery(lessonQueryOptions(id));

  if (
    lesson.error instanceof ApiClientError &&
    (lesson.error.status === 400 || lesson.error.status === 404)
  ) {
    return <LessonNotFound />;
  }
  if (lesson.isError && !lesson.data) {
    return <QueryError error={lesson.error} onRetry={() => lesson.refetch()} />;
  }
  if (!lesson.data) {
    return (
      <div className="grid max-w-2xl gap-4">
        <BackToLibrary />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-9 w-20" />
      </div>
    );
  }

  const { data } = lesson;

  return (
    <div className="grid max-w-2xl gap-4">
      <BackToLibrary />
      <h1 className="text-2xl font-semibold">{data.name}</h1>
      <div className="flex flex-wrap gap-1.5">
        <Badge>{formatDifficulty(data.difficulty)}</Badge>
        {data.tags.map((tag) => (
          <Badge key={tag.id} variant="secondary">
            {tag.name}
          </Badge>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Recommended: {data.recommendedTempoBpm} BPM ·{" "}
        {formatDuration(data.recommendedDurationSeconds)}
      </p>
      <p className="whitespace-pre-line">{data.description}</p>
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed text-muted-foreground">
        Sheet coming soon
      </div>
      <PracticePanel lesson={data} />
    </div>
  );
}
