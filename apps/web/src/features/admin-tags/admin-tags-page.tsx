import { useState } from "react";
import { LoadMoreSentinel } from "@/components/load-more-sentinel";
import { QueryError } from "@/components/query-error";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useAdminTags } from "../tags/tags.api";
import { AddTagForm } from "./add-tag-form";
import { TagRow } from "./tag-row";

const SKELETON_ROWS = 5;

export function AdminTagsPage() {
  const [input, setInput] = useState("");
  const q = useDebouncedValue(input.trim(), 300);
  const tags = useAdminTags(q);
  const items = tags.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="grid gap-6">
      <h1 className="text-xl font-semibold">Tags</h1>
      <AddTagForm />
      <Input
        type="search"
        aria-label="Search tags"
        placeholder="Search tags"
        className="max-w-sm"
        maxLength={50}
        value={input}
        onChange={(event) => setInput(event.target.value)}
      />
      {tags.isError ? (
        <QueryError error={tags.error} onRetry={() => tags.refetch()} />
      ) : tags.isPending ? (
        <Table>
          <TableBody>
            {Array.from({ length: SKELETON_ROWS }, (_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
              <TableRow key={index}>
                <TableCell>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : items.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{q ? `No tags match "${q}"` : "No tags yet"}</EmptyTitle>
            {q ? null : <EmptyDescription>Add the first tag above.</EmptyDescription>}
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Used by</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((tag) => (
                <TagRow key={tag.id} tag={tag} />
              ))}
            </TableBody>
          </Table>
          <LoadMoreSentinel
            enabled={tags.hasNextPage && !tags.isFetchingNextPage && !tags.isFetchNextPageError}
            onLoadMore={() => tags.fetchNextPage()}
          />
        </>
      )}
    </div>
  );
}
