const SHOW_ALL_UP_TO = 5;

export type PageItem = number | "ellipsis";

/** Page 1, the last page and page ± 1; a one-page gap shows that page, a longer gap an ellipsis. */
export function pageItems(page: number, totalPages: number): PageItem[] {
  if (totalPages < 1) return [];
  // Short ranges are listed in full (an ellipsis would hide at most two pages).
  if (totalPages <= SHOW_ALL_UP_TO) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const shown = new Set<number>();
  for (const candidate of [1, page - 1, page, page + 1, totalPages]) {
    if (candidate >= 1 && candidate <= totalPages) shown.add(candidate);
  }

  const sorted = [...shown].sort((a, b) => a - b);
  const items: PageItem[] = [];
  for (const [index, current] of sorted.entries()) {
    const previous = sorted[index - 1];
    if (previous !== undefined) {
      const gap = current - previous - 1;
      if (gap === 1) items.push(previous + 1);
      else if (gap > 1) items.push("ellipsis");
    }
    items.push(current);
  }
  return items;
}
