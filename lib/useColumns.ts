import { useEffect, useState } from "react";
import { onDataChanged } from "./events";
import type { BoardColumn } from "./types";

export function useColumns() {
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/columns");
        if (!res.ok) return;
        const data: BoardColumn[] = await res.json();
        if (!cancelled) setColumns(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const unsubscribe = onDataChanged(load);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { columns, loading };
}
