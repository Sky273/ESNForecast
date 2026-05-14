import { useCallback, useEffect, useState } from "react";
import { api } from "../api";

export function useApiList<T>(path: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api<T[]>(path));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erreur API");
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}

export function useProjection(horizon: number) {
  const [projection, setProjection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api(`/projections/monthly?horizon=${horizon}`)
      .then(setProjection)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Erreur projection"))
      .finally(() => setLoading(false));
  }, [horizon]);

  return { projection, loading, error };
}
