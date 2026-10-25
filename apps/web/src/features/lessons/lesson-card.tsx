import type { LessonSummary } from "@drum-tutor/contracts";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration } from "./duration";
import { formatDifficulty } from "./format";
import type { LibrarySearch } from "./library-search";

type LessonCardProps = {
  lesson: LessonSummary;
  librarySearch: LibrarySearch;
};

export function LessonCard({ lesson, librarySearch }: LessonCardProps) {
  return (
    <Link
      to="/lessons/$lessonId"
      params={{ lessonId: lesson.id }}
      state={{ librarySearch }}
      className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full transition-colors hover:bg-muted/50">
        <CardHeader>
          <CardTitle>{lesson.name}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap gap-1.5">
            <Badge>{formatDifficulty(lesson.difficulty)}</Badge>
            {lesson.tags.map((tag) => (
              <Badge key={tag.id} variant="secondary">
                {tag.name}
              </Badge>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {lesson.recommendedTempoBpm} BPM · {formatDuration(lesson.recommendedDurationSeconds)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
