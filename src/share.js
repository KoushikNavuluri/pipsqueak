import { supabase } from "./supabase";

// Share links, phone previews and comments. See the 20261103000000 migration
// for the tables and the functions people with a link can call.

export const DEVICE_LINK_HOURS = 12;

export const shareUrl = (token) => `${location.origin}/s/${token}`;

const friendly = (error, fallback) => {
  if (!error) return null;
  // The design row is written about half a second after a change; a share
  // or comment made before that can't point at it yet.
  if (error.code === "23503") return new Error("Your latest changes are still saving. Try again in a moment.");
  return new Error(error.message || fallback);
};

// ---------- Owner side ----------

export async function getShare(projectId, kind = "link") {
  const { data, error } = await supabase.from("shares").select("*").eq("project_id", projectId).eq("kind", kind).maybeSingle();
  if (error) throw friendly(error, "Couldn't load the share link.");
  return data;
}

export async function createShare(projectId, { kind = "link", allowComments = false, allowRemix = false, expiresAt = null } = {}) {
  const { data, error } = await supabase
    .from("shares")
    .insert({ project_id: projectId, kind, allow_comments: allowComments, allow_remix: allowRemix, expires_at: expiresAt })
    .select("*")
    .single();
  if (error) throw friendly(error, "Couldn't create the link.");
  return data;
}

export async function updateShare(token, patch) {
  const { data, error } = await supabase.from("shares").update(patch).eq("token", token).select("*").single();
  if (error) throw friendly(error, "Couldn't update the link.");
  return data;
}

export async function deleteShare(token) {
  const { error } = await supabase.from("shares").delete().eq("token", token);
  if (error) throw friendly(error, "Couldn't turn the link off.");
}

// A new address for the same share; the old one stops working.
export async function rotateShare(share) {
  await deleteShare(share.token);
  return createShare(share.project_id, { kind: share.kind, allowComments: share.allow_comments, allowRemix: share.allow_remix, expiresAt: share.expires_at });
}

// The phone-preview link: reused while it lasts, renewed for another
// DEVICE_LINK_HOURS each time it's shown.
export async function deviceShare(projectId) {
  const expiresAt = new Date(Date.now() + DEVICE_LINK_HOURS * 3600 * 1000).toISOString();
  const existing = await getShare(projectId, "device");
  if (existing && (!existing.expires_at || new Date(existing.expires_at) > new Date())) {
    return updateShare(existing.token, { expires_at: expiresAt });
  }
  if (existing) await deleteShare(existing.token);
  return createShare(projectId, { kind: "device", expiresAt });
}

export async function listComments(projectId) {
  const { data, error } = await supabase.from("comments").select("*").eq("project_id", projectId).order("created_at", { ascending: true });
  if (error) throw friendly(error, "Couldn't load comments.");
  return data;
}

export async function addComment({ projectId, screenId, anchor, body, authorName, authorId }) {
  const { data, error } = await supabase
    .from("comments")
    .insert({ project_id: projectId, screen_id: screenId, anchor: anchor || {}, body, author_id: authorId, author_name: authorName })
    .select("*")
    .single();
  if (error) throw friendly(error, "Couldn't add the comment.");
  return data;
}

export async function setResolved(ids, by) {
  const patch = by ? { resolved_at: new Date().toISOString(), resolved_by: by.slice(0, 60) } : { resolved_at: null, resolved_by: null };
  const { error } = await supabase.from("comments").update(patch).in("id", ids);
  if (error) throw friendly(error, "Couldn't update the comment.");
}

export async function deleteComment(id) {
  const { error } = await supabase.from("comments").delete().eq("id", id);
  if (error) throw friendly(error, "Couldn't delete the comment.");
}

// Calls onChange whenever a comment on this design is added, edited or removed.
export function watchComments(projectId, onChange) {
  const channel = supabase
    .channel(`comments:${projectId}:${Math.random().toString(36).slice(2, 8)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: `project_id=eq.${projectId}` }, () => onChange())
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ---------- Viewer side (works signed out) ----------

// { rev, kind, allowComments, allowRemix, owner, project } or { rev, unchanged }
// when knownRev is current, or null when the link is off or has expired.
export async function getShared(token, knownRev = null) {
  const { data, error } = await supabase.rpc("get_share", { p_token: token, p_known_rev: knownRev });
  if (error) throw friendly(error, "Couldn't open this link.");
  return data;
}

export async function getSharedComments(token) {
  const { data, error } = await supabase.rpc("get_share_comments", { p_token: token });
  if (error) throw friendly(error, "Couldn't load comments.");
  return data || [];
}

export async function addSharedComment(token, { screenId, anchor, body, author }) {
  const { data, error } = await supabase.rpc("add_share_comment", {
    p_token: token,
    p_screen_id: screenId,
    p_anchor: anchor || {},
    p_body: body,
    p_author: author,
  });
  if (error) throw friendly(error, "Couldn't add the comment.");
  return data;
}

// What a comment stores about the element it's pinned to. Kept small: the
// database caps it at 2 KB.
export function anchorFrom(info) {
  if (!info?.path) return {};
  return {
    path: info.path.slice(0, 40),
    tag: info.tag,
    text: (info.text || "").slice(0, 80),
    outer: (info.outer || "").slice(0, 400),
    rect: info.doc ? { x: Math.round(info.doc.x), y: Math.round(info.doc.y), w: Math.round(info.doc.w), h: Math.round(info.doc.h) } : null,
  };
}

export function anchorLabel(anchor, screenName) {
  if (!anchor?.tag) return screenName ? `${screenName} (whole screen)` : "Whole screen";
  const text = (anchor.text || "").replace(/\s+/g, " ").trim();
  const what = text ? `${anchor.tag} “${text.length > 32 ? text.slice(0, 31) + "…" : text}”` : anchor.tag;
  return screenName ? `${what} on ${screenName}` : what;
}

// A remixable copy of a shared design for the signed-in viewer's account.
export function remixFromShare(shared, newId) {
  const p = shared.project;
  const now = Date.now();
  return {
    ...p,
    id: newId,
    name: `${p.name || "Design"} remix`.slice(0, 40),
    kind: "canvas",
    created: now,
    fav: false,
    chat: [],
    review: null,
    remixOf: "share",
    screens: (p.screens || []).map((sc) => ({ ...sc, versions: [], changedAt: now })),
  };
}
