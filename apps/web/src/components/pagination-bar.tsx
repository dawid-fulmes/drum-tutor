import { useId } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pageItems } from "@/lib/page-items";

type PaginationBarProps = {
  page: number;
  totalPages: number;
  pageSize: number;
  pageSizes: readonly number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

export function PaginationBar({
  page,
  totalPages,
  pageSize,
  pageSizes,
  onPageChange,
  onPageSizeChange,
}: PaginationBarProps) {
  const labelId = useId();
  const go = (target: number) => (event: React.MouseEvent) => {
    event.preventDefault();
    onPageChange(target);
  };
  const atStart = page <= 1;
  const atEnd = page >= totalPages;
  const disabledClass = "pointer-events-none opacity-50";

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      {totalPages > 1 ? (
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                aria-disabled={atStart}
                tabIndex={atStart ? -1 : undefined}
                className={atStart ? disabledClass : undefined}
                onClick={go(page - 1)}
              />
            </PaginationItem>
            {pageItems(page, totalPages).map((item, index) => (
              <PaginationItem key={item === "ellipsis" ? `ellipsis-${index}` : item}>
                {item === "ellipsis" ? (
                  <PaginationEllipsis />
                ) : (
                  <PaginationLink href="#" isActive={item === page} onClick={go(item)}>
                    {item}
                  </PaginationLink>
                )}
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href="#"
                aria-disabled={atEnd}
                tabIndex={atEnd ? -1 : undefined}
                className={atEnd ? disabledClass : undefined}
                onClick={go(page + 1)}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2 text-sm">
        <span id={labelId}>Per page</span>
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger size="sm" aria-labelledby={labelId}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizes.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
