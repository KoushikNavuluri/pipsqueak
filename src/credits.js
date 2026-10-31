import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export const DAILY_CREDITS = 150;

// Today's runs (UTC), newest first. Credits used = cost of runs that didn't fail.
export function useCredits(refreshKey) {
  const [runs, setRuns] = useState(null);
  useEffect(() => {
    let live = true;
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    supabase
      .from("ai_runs")
      .select("action, status, cost, latency_ms, created_at")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(300)
      .then(({ data }) => live && setRuns(data || []));
    return () => {
      live = false;
    };
  }, [refreshKey]);
  const used = (runs || []).filter((r) => r.status !== "error").reduce((n, r) => n + r.cost, 0);
  return { runs, used, limit: DAILY_CREDITS, left: Math.max(0, DAILY_CREDITS - used) };
}
