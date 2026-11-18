import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Dashboard, Health } from "../lib/types";
export function useDashboard() {
  const [data, setData] = useState<Dashboard | null>(null),
    [health, setHealth] = useState<Health | null>(null),
    [error, setError] = useState(""),
    [refreshing, setRefreshing] = useState(false);
  const reload = useCallback(async () => {
    try {
      setData(await api<Dashboard>("/api/dashboard"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void reload();
    const poll = setInterval(reload, 15000);
    const check = () =>
      api<Health>("/api/health")
        .then(setHealth)
        .catch(() => setHealth(null));
    void check();
    const status = setInterval(check, 30000);
    return () => {
      clearInterval(poll);
      clearInterval(status);
    };
  }, [reload]);
  async function refresh() {
    setRefreshing(true);
    try {
      await api("/api/refresh", { method: "POST" });
      await reload();
    } finally {
      setRefreshing(false);
    }
  }
  return { data, health, error, refreshing, reload, refresh };
}
