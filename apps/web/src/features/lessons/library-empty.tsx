import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

type LibraryEmptyProps = {
  filtered: boolean;
  onClearFilters: () => void;
};

export function LibraryEmpty({ filtered, onClearFilters }: LibraryEmptyProps) {
  if (!filtered) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No lessons yet</EmptyTitle>
          <EmptyDescription>
            New lessons will show up here once they are published.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>No lessons match these filters</EmptyTitle>
        <EmptyDescription>Try removing a tag or selecting more levels.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" onClick={onClearFilters}>
          Clear filters
        </Button>
      </EmptyContent>
    </Empty>
  );
}
