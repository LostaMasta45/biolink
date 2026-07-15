"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchManagerResource } from "@/services/whatsapp-manager-client";

export function useManagerResource<T>(resource: string, query = "") {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchManagerResource<T>(resource, query));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [query, resource]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, setData, loading, error, refresh };
}

