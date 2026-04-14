"use client";

import { useCallback, useEffect, useState } from "react";

/** Zajednički izbor za tabele Reklamacije i Statistika — čuva se u localStorage. */
export const TABLE_PAGE_SIZE_STORAGE_KEY = "mr-warranty-table-page-size";

export const TABLE_PAGE_SIZE_OPTIONS = [10, 20, 25, 30, 50, 100] as const;
export type TablePageSize = (typeof TABLE_PAGE_SIZE_OPTIONS)[number];

function parseStoredPageSize(raw: string | null): TablePageSize {
  const n = parseInt(raw ?? "", 10);
  if (Number.isFinite(n) && (TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) {
    return n as TablePageSize;
  }
  return 10;
}

export function usePersistentTablePageSize(): [number, (size: number) => void] {
  const [pageSize, setPageSizeState] = useState(10);

  useEffect(() => {
    try {
      setPageSizeState(parseStoredPageSize(localStorage.getItem(TABLE_PAGE_SIZE_STORAGE_KEY)));
    } catch {
      /* ignore */
    }
  }, []);

  const setPageSize = useCallback((size: number) => {
    const next = parseStoredPageSize(String(size));
    setPageSizeState(next);
    try {
      localStorage.setItem(TABLE_PAGE_SIZE_STORAGE_KEY, String(next));
    } catch {
      /* ignore */
    }
  }, []);

  return [pageSize, setPageSize];
}
