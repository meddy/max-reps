import { useCallback, useEffect, useRef, useState } from "react";

type PaginatedResult<T> = {
  items: T[];
  loadMore: () => void;
  hasMore: boolean;
  loading: boolean;
};

/**
 * Cursor-based pagination hook. queryFn receives lastDoc (or null) and returns
 * { docs, lastDoc, hasMore }. loadMore is called when sentinel is visible (infinite scroll).
 */
export function usePagination<T>(
  queryFn: (
    lastDoc: unknown
  ) => Promise<{ docs: T[]; lastDoc: unknown; hasMore: boolean }>,
  _pageSize: number,
  deps: unknown[] = []
): PaginatedResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [lastDoc, setLastDoc] = useState<unknown>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadPage = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const result = await queryFn(lastDoc);
      setItems((prev) =>
        lastDoc == null ? result.docs : [...prev, ...result.docs]
      );
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [queryFn, lastDoc, hasMore]);

  useEffect(() => {
    void loadPage();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps -- loadPage depends on lastDoc

  const loadMore = useCallback(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "100px", threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  return { items, loadMore, hasMore, loading };
}
