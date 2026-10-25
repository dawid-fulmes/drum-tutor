import type { AdminLessonSummary } from "@drum-tutor/contracts";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate, formatDifficulty } from "../lessons/format";
import { LessonRowActions } from "./lesson-row-actions";

const SKELETON_ROWS = 5;
const COLUMNS = 6;

function LessonTags({ tags }: { tags: AdminLessonSummary["tags"] }) {
  const [first, ...rest] = tags;
  if (!first) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-1">
      <Badge variant="secondary">{first.name}</Badge>
      {rest.length > 0 ? <Badge variant="outline">{`+${rest.length}`}</Badge> : null}
    </div>
  );
}

function LessonRow({ lesson }: { lesson: AdminLessonSummary }) {
  return (
    <TableRow>
      <TableCell className="font-medium">
        <span className="flex items-center gap-2">
          {lesson.name}
          {lesson.locked ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Lock className="size-3.5 text-muted-foreground" aria-label="Has practice logs" />
              </TooltipTrigger>
              <TooltipContent>Has practice logs</TooltipContent>
            </Tooltip>
          ) : null}
        </span>
      </TableCell>
      <TableCell>{formatDifficulty(lesson.difficulty)}</TableCell>
      <TableCell>
        <LessonTags tags={lesson.tags} />
      </TableCell>
      <TableCell>
        <Badge variant={lesson.status === "published" ? "default" : "outline"}>
          {lesson.status === "published" ? "Published" : "Draft"}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">{formatDate(lesson.createdAt)}</TableCell>
      <TableCell className="text-right">
        <LessonRowActions lesson={lesson} />
      </TableCell>
    </TableRow>
  );
}

type AdminLessonsTableProps = { lessons: AdminLessonSummary[] | undefined };

/** Renders skeleton rows while `lessons` is undefined. */
export function AdminLessonsTable({ lessons }: AdminLessonsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Difficulty</TableHead>
          <TableHead>Tags</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lessons
          ? lessons.map((lesson) => <LessonRow key={lesson.id} lesson={lesson} />)
          : Array.from({ length: SKELETON_ROWS }, (_, row) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
              <TableRow key={row}>
                {Array.from({ length: COLUMNS }, (_, cell) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
                  <TableCell key={cell}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}
