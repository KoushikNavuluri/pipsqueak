import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export const DAILY_CREDITS = 150;

// Credits reset at midnight UTC. These say when that is on the user's clock,
// e.g. "5:30 AM" in India.
export function nextReset(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}
export function resetTimeLabel(now = new Date(), locale) {
  return nextReset(now).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}
export function resetInLabel(now = new Date()) {
  const mins = Math.max(1, Math.round((nextReset(now) - now) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

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
