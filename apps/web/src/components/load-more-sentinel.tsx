import { useEffect, useRef } from "react";

type LoadMoreSentinelProps = {
  onLoadMore: () => void;
  enabled: boolean;
  root?: Element | null;
};

export function LoadMoreSentinel({ onLoadMore, enabled, root = null }: LoadMoreSentinelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMoreRef.current();
      },
      { root },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, root]);

  return <div ref={ref} aria-hidden className="h-px" />;
}
