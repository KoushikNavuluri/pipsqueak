import { supabase } from "./supabase";

export async function loadCloud() {
  const [projects, settings] = await Promise.all([
    supabase
      .from("projects")
      .select("data")
      .order("created_at", { ascending: false }),
    supabase
      .from("user_settings")
      .select("prefs, active_project_id")
      .maybeSingle(),
  ]);
  if (projects.error) throw projects.error;
  if (settings.error) throw settings.error;
  return {
    projects: projects.data.map((row) => row.data),
    settings: settings.data,
  };
}

// A load started early (as soon as the user is known) that the app can take
// over when it mounts, instead of starting from scratch. Used once, and only
// while fresh, so it never hands back stale data.
let early = null;
let taken = null;
export function prefetchCloud(userId) {
  if (early?.userId === userId && Date.now() - early.at < 30000) return;
  if (taken?.userId === userId && Date.now() - taken.at < 30000) return;
  early = { userId, at: Date.now(), promise: loadCloud() };
  early.promise.catch(() => {
    early = null;
  });
}
export function takeCloud(userId) {
  const hit = early?.userId === userId && Date.now() - early.at < 30000 ? early.promise : null;
  early = null;
  taken = { userId, at: Date.now() };
  return hit || loadCloud();
}

// Writes the difference between two snapshots of the store's data.
// `prev` is null when nothing has been saved yet, which saves everything.
export async function saveCloud(userId, prev, next) {
  const before = new Map((prev?.projects || []).map((p) => [p.id, p]));
  const changed = next.projects.filter((p) => before.get(p.id) !== p);
  const ids = new Set(next.projects.map((p) => p.id));
  const removed = [...before.keys()].filter((id) => !ids.has(id));

  const ops = [];
  if (changed.length) {
    ops.push(
      supabase.from("projects").upsert(
        changed.map((p) => ({
          user_id: userId,
          id: p.id,
          data: p,
          created_at: new Date(p.created || Date.now()).toISOString(),
        })),
      ),
    );
  }
  if (removed.length) {
    ops.push(supabase.from("projects").delete().in("id", removed));
  }
  if (!prev || prev.prefs !== next.prefs || prev.activeId !== next.activeId) {
    ops.push(
      supabase.from("user_settings").upsert({
        user_id: userId,
        prefs: next.prefs,
        active_project_id: next.activeId,
      }),
    );
  }
  for (const { error } of await Promise.all(ops)) {
    if (error) throw error;
  }
}
