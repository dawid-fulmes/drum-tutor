import { Link, type LinkProps } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

type NotFoundProps = {
  title: string;
  backTo: LinkProps["to"];
  backSearch?: LinkProps["search"];
  backLabel: string;
};

export function NotFound({ title, backTo, backSearch, backLabel }: NotFoundProps) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link to={backTo} search={backSearch}>
            {backLabel}
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
