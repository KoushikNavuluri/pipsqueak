import { supabase } from "./supabase";

// How designs are stored:
// - `data` holds a design without its screens' version history.
// - `versions` holds that history, keyed by screen id. It's left out of the
//   sign-in load and fetched when a design is opened ("hydrated"), and it's
//   written only when a version is added or removed.
// - `rev` goes up on every update. Saves only apply on top of the rev they
//   last saw, so a save from another tab or device is never overwritten.

export const MAX_VERSIONS = 24;

export const stripVersions = (p) => ({
  ...p,
  screens: (p.screens || []).map(({ versions, ...sc }) => sc),
});

export const versionsOf = (p) => Object.fromEntries((p.screens || []).filter((sc) => sc.versions?.length).map((sc) => [sc.id, sc.versions]));

const hasInlineVersions = (data) => (data?.screens || []).some((sc) => sc.versions?.length);

// Newest first, no duplicates, at most MAX_VERSIONS.
export function mergeVersions(local = [], remote = []) {
  const seen = new Set();
  const out = [];
  for (const v of [...(local || []), ...(remote || [])]) {
    if (v?.id && !seen.has(v.id)) {
      seen.add(v.id);
      out.push(v);
    }
  }
  return out.sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, MAX_VERSIONS);
}

export function mergeVersionMaps(local = {}, remote = {}) {
  const out = {};
  for (const id of new Set([...Object.keys(local || {}), ...Object.keys(remote || {})])) {
    const merged = mergeVersions(local?.[id], remote?.[id]);
    if (merged.length) out[id] = merged;
  }
  return out;
}

// A design with remote history folded into its screens.
export function withRemoteVersions(p, remote) {
  return {
    ...p,
    screens: (p.screens || []).map((sc) => ({ ...sc, versions: mergeVersions(sc.versions, remote?.[sc.id]) })),
  };
}

// True when the screens' history differs between two copies of a design.
export function versionsChanged(a, b) {
  const as = a?.screens || [];
  const bs = b?.screens || [];
  if (as.length !== bs.length) return true;
  const byId = new Map(as.map((sc) => [sc.id, sc.versions]));
  return bs.some((sc) => !byId.has(sc.id) || byId.get(sc.id) !== sc.versions);
}

// What has to be written to get from `prev` (what's saved) to `next`.
// `skip` holds ids not to touch (unresolved conflicts); `same(saved, current)`
// can declare two different objects equal (history merged in on open).
export function planSave(prev, next, skip = new Set(), same = () => false) {
  const before = new Map((prev?.projects || []).map((p) => [p.id, p]));
  const ids = new Set(next.projects.map((p) => p.id));
  const changed = next.projects.filter((p) => !skip.has(p.id) && before.get(p.id) !== p && !(before.has(p.id) && same(before.get(p.id), p)));
  const removed = [...before.keys()].filter((id) => !ids.has(id) && !skip.has(id));
  const settings = !prev || prev.prefs !== next.prefs || prev.activeId !== next.activeId;
  // Copies that count as saved; the caller records them as the saved copy.
  const adopted = next.projects.filter((p) => !skip.has(p.id) && before.has(p.id) && before.get(p.id) !== p && same(before.get(p.id), p));
  return { changed, removed, settings, adopted, before, empty: !changed.length && !removed.length && !settings };
}

export async function loadCloud(db = supabase) {
  const [projects, settings] = await Promise.all([
    db.from("projects").select("data, rev").order("created_at", { ascending: false }),
    db.from("user_settings").select("prefs, active_project_id").maybeSingle(),
  ]);
  if (projects.error) throw projects.error;
  if (settings.error) throw settings.error;
  return {
    projects: projects.data.map((row) => row.data),
    revs: Object.fromEntries(projects.data.map((row) => [row.data.id, row.rev])),
    // Designs saved before history had its own column still carry it inline;
    // their next save moves it.
    legacy: projects.data.filter((row) => hasInlineVersions(row.data)).map((row) => row.data.id),
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

export async function fetchVersions(id, db = supabase) {
  const { data, error } = await db.from("projects").select("versions").eq("id", id).maybeSingle();
  if (error) throw error;
  return data?.versions || {};
}

// The saved copy of one design: { project, rev } or null when it's gone.
export async function fetchProject(id, { withVersions = false } = {}, db = supabase) {
  const { data, error } = await db
    .from("projects")
    .select(withVersions ? "data, rev, versions" : "data, rev")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { project: withVersions ? withRemoteVersions(data.data, data.versions || {}) : data.data, rev: data.rev };
}

export async function fetchRevs(db = supabase) {
  const { data, error } = await db.from("projects").select("id, rev");
  if (error) throw error;
  return new Map(data.map((r) => [r.id, r.rev]));
}

const insertRow = (db, userId, p, row) =>
  db
    .from("projects")
    .insert({ user_id: userId, id: p.id, created_at: new Date(p.created || Date.now()).toISOString(), ...row, versions: row.versions ?? versionsOf(p) })
    .select("rev");

// Writes one design. Resolves to { rev } or { conflict: "changed" | "deleted" }.
// `force` overwrites whatever is saved (the user chose to keep their copy).
// ctx: { revs: Map, hydrated: Set, legacy: Set, onRemoteVersions? }.
export async function saveProject(userId, p, prevP, ctx, { force = false } = {}, db = supabase) {
  const isNew = !ctx.revs.has(p.id);
  const needVersions = isNew || force || ctx.legacy.has(p.id) || versionsChanged(prevP, p);
  const row = { data: stripVersions(p) };
  if (needVersions) {
    let versions = versionsOf(p);
    // Never replace history that hasn't been loaded yet: fold it in first.
    if (!isNew && !ctx.hydrated.has(p.id)) {
      const remote = await fetchVersions(p.id, db);
      versions = mergeVersionMaps(versions, remote);
      ctx.onRemoteVersions?.(p.id, p, remote);
    }
    row.versions = versions;
  }

  let res;
  if (isNew) {
    res = await insertRow(db, userId, p, row);
    if (res.error?.code === "23505") return { conflict: "changed" };
  } else {
    let q = db.from("projects").update(row).eq("id", p.id);
    if (!force) q = q.eq("rev", ctx.revs.get(p.id));
    res = await q.select("rev");
    // Deleted elsewhere, and the user wants their copy back.
    if (!res.error && !res.data.length && force) res = await insertRow(db, userId, p, row);
  }
  if (res.error) throw res.error;
  if (!res.data.length) {
    const { data, error } = await db.from("projects").select("rev").eq("id", p.id).maybeSingle();
    if (error) throw error;
    return { conflict: data ? "changed" : "deleted" };
  }
  ctx.revs.set(p.id, res.data[0].rev);
  if (needVersions) {
    ctx.hydrated.add(p.id);
    ctx.legacy.delete(p.id);
  }
  return { rev: res.data[0].rev };
}

// Carries out a plan from planSave. Resolves to a Map of conflicts by id.
export async function saveCloud(userId, plan, next, ctx, db = supabase) {
  const conflicts = new Map();
  const ops = plan.changed.map(async (p) => {
    const out = await saveProject(userId, p, plan.before.get(p.id), ctx, {}, db);
    if (out.conflict) conflicts.set(p.id, out.conflict);
  });
  if (plan.removed.length) {
    ops.push(
      db
        .from("projects")
        .delete()
        .in("id", plan.removed)
        .then(({ error }) => {
          if (error) throw error;
          for (const id of plan.removed) {
            ctx.revs.delete(id);
            ctx.hydrated.delete(id);
            ctx.legacy.delete(id);
          }
        }),
    );
  }
  if (plan.settings) {
    ops.push(
      db
        .from("user_settings")
        .upsert({ user_id: userId, prefs: next.prefs, active_project_id: next.activeId })
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }
  await Promise.all(ops);
  return conflicts;
}
