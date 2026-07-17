/* eslint-disable */

import type { InfiniteData, QueryFilters, QueryKey } from "@tanstack/react-query";
import { queryClient } from "@/query-client";

export default class CacheUtils {
  public static setInCache<T>(queryKey: QueryKey, data: T | ((old: T | undefined) => T)) {
    queryClient.setQueryData<T>(queryKey, (old) => (typeof data === "function" ? (data as (o: T | undefined) => T)(old) : data));
  }

  public static async invalidateQueries(queryKeys: QueryKey[]): Promise<void> {
    await Promise.all(queryKeys.map((q) => queryClient.invalidateQueries({ queryKey: q })));
  }

  public static updatePaginatedQueryCache<TItem, TResult extends Record<string, any> = any>(
    filter: QueryFilters,
    transformItem: (item: TItem) => TItem,
    options?: { itemsKey?: string }
  ) {
    const itemsKey = options?.itemsKey ?? "items";

    const hits = queryClient.getQueryCache().findAll(filter);

    for (const q of hits) {
      CacheUtils.setInCache<TResult>(q.queryKey, (old) => {
        if (!old) return old as any;

        const items = (old as any)[itemsKey] as TItem[] | undefined;
        if (!Array.isArray(items) || items.length === 0) return old as any;

        let changed = false;
        const nextItems = items.map((it) => {
          const next = transformItem(it);
          if (next !== it) changed = true;
          return next;
        });

        if (!changed) return old as any;

        return {
          ...(old as any), // preserves meta and other fields
          [itemsKey]: nextItems
        } as TResult;
      });
    }
  }
}
