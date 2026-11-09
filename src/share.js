import { supabase } from "./supabase";

// Share links, phone previews, comments, polls, workspaces, and analytics.

export const DEVICE_LINK_HOURS = 12;

export const shareUrl = (token) => `${location.origin}/s/${token}`;
export const pollUrl = (token) => `${location.origin}/poll/${token}`;
export const inviteUrl = (token) => `${location.origin}/invite/${token}`;

const friendly = (error, fallback) => {
  if (!error) return null;
  if (error.code === "23503") return new Error("Your latest changes are still saving. Try again in a moment.");
  return new Error(error.message || fallback);
};

// ---------- Share links & controls ----------

export async function getShare(projectId, kind = "link") {
  const { data, error } = await supabase.from("shares").select("*").eq("project_id", projectId).eq("kind", kind).maybeSingle();
  if (error) throw friendly(error, "Couldn't load the share link.");
  return data;
}

export async function createShare(projectId, { kind = "link", allowComments = false, allowRemix = false, expiresAt = null, passcode = null } = {}) {
  const { data, error } = await supabase
    .from("shares")
    .insert({
      project_id: projectId,
      kind,
      allow_comments: allowComments,
      allow_remix: allowRemix,
      expires_at: expiresAt,
      passcode: passcode ? passcode.trim() : null,
    })
    .select("*")
    .single();
  if (error) throw friendly(error, "Couldn't create the link.");
  return data;
}

export async function updateShare(token, patch) {
  const clean = { ...patch };
  if ("passcode" in clean) clean.passcode = clean.passcode ? clean.passcode.trim() : null;
  const { data, error } = await supabase.from("shares").update(clean).eq("token", token).select("*").single();
  if (error) throw friendly(error, "Couldn't update the link.");
  return data;
}

export async function deleteShare(token) {
  const { error } = await supabase.from("shares").delete().eq("token", token);
  if (error) throw friendly(error, "Couldn't turn the link off.");
}

export async function rotateShare(share) {
  await deleteShare(share.token);
  return createShare(share.project_id, {
    kind: share.kind,
    allowComments: share.allow_comments,
    allowRemix: share.allow_remix,
    expiresAt: share.expires_at,
    passcode: share.passcode,
  });
}

export async function deviceShare(projectId) {
  const expiresAt = new Date(Date.now() + DEVICE_LINK_HOURS * 3600 * 1000).toISOString();
  const existing = await getShare(projectId, "device");
  if (existing && (!existing.expires_at || new Date(existing.expires_at) > new Date())) {
    return updateShare(existing.token, { expires_at: expiresAt });
  }
  if (existing) await deleteShare(existing.token);
  return createShare(projectId, { kind: "device", expiresAt });
}

// ---------- Share stats & view tracking ----------

export async function getShareStats(token) {
  const { data, error } = await supabase.rpc("get_share_stats", { p_token: token });
  if (error) return { total: 0, mobile: 0, tablet: 0, desktop: 0, lastViewed: null, screens: [] };
  return data || { total: 0, mobile: 0, tablet: 0, desktop: 0, lastViewed: null, screens: [] };
}

export async function recordShareView(token, device = "desktop", referrer = null, screenId = null, screenName = null, dwellMs = 0) {
  try {
    await supabase.rpc("record_share_view", {
      p_token: token,
      p_device: device,
      p_referrer: referrer ? referrer.slice(0, 255) : null,
      p_screen_id: screenId || null,
      p_screen_name: screenName ? screenName.slice(0, 64) : null,
      p_dwell_ms: dwellMs || 0,
    });
  } catch {}
}

// ---------- Comments & Threaded replies ----------

export async function listComments(projectId) {
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw friendly(error, "Couldn't load comments.");
  return data || [];
}

export async function addComment({ projectId, screenId, anchor, body, authorName, authorId, parentId = null }) {
  const { data, error } = await supabase
    .from("comments")
    .insert({
      project_id: projectId,
      screen_id: screenId,
      anchor: anchor || {},
      body,
      author_id: authorId,
      author_name: authorName,
      parent_id: parentId,
    })
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

export function watchComments(projectId, onChange) {
  const channel = supabase
    .channel(`comments:${projectId}:${Math.random().toString(36).slice(2, 8)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: `project_id=eq.${projectId}` }, () => onChange())
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ---------- Viewer side (works signed out) ----------

export async function getShared(token, knownRev = null, passcode = null) {
  const { data, error } = await supabase.rpc("get_share", {
    p_token: token,
    p_known_rev: knownRev,
    p_passcode: passcode,
  });
  if (error) throw friendly(error, "Couldn't open this link.");
  return data;
}

export async function getSharedComments(token) {
  const { data, error } = await supabase.rpc("get_share_comments", { p_token: token });
  if (error) throw friendly(error, "Couldn't load comments.");
  return data || [];
}

export async function addSharedComment(token, { screenId, anchor, body, author, parentId = null }) {
  const { data, error } = await supabase.rpc("add_share_comment", {
    p_token: token,
    p_screen_id: screenId,
    p_anchor: anchor || {},
    p_body: body,
    p_author: author,
    p_parent_id: parentId,
  });
  if (error) throw friendly(error, "Couldn't add the comment.");
  return data;
}

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

// ---------- In-app Notifications ----------

export async function listNotifications(userId) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return [];
  return data || [];
}

export async function markNotificationRead(id) {
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
}

export async function markAllNotificationsRead(userId) {
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
}

export function watchNotifications(userId, onChange) {
  const channel = supabase
    .channel(`notifications:${userId}:${Math.random().toString(36).slice(2, 8)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => onChange())
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ---------- Team Workspaces ----------

export async function listWorkspaces() {
  const { data, error } = await supabase.from("workspaces").select("*").order("created_at", { ascending: true });
  if (error) throw friendly(error, "Couldn't load workspaces.");
  return data || [];
}

export async function createWorkspace(name) {
  const { data, error } = await supabase.from("workspaces").insert({ name: name.trim() }).select("*").single();
  if (error) throw friendly(error, "Couldn't create workspace.");
  // Add creator as owner member
  const user = (await supabase.auth.getUser()).data.user;
  if (user) {
    await supabase.from("workspace_members").insert({
      workspace_id: data.id,
      user_id: user.id,
      email: user.email,
      role: "owner",
      status: "accepted",
    });
  }
  return data;
}

export async function listWorkspaceMembers(workspaceId) {
  const { data, error } = await supabase.from("workspace_members").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: true });
  if (error) throw friendly(error, "Couldn't load workspace members.");
  return data || [];
}

export async function inviteWorkspaceMember(workspaceId, email, role = "editor") {
  const { data, error } = await supabase
    .from("workspace_members")
    .insert({
      workspace_id: workspaceId,
      email: email.trim().toLowerCase(),
      role,
      status: "pending",
    })
    .select("*")
    .single();
  if (error) throw friendly(error, "Couldn't invite member. They may already be in this workspace.");
  return data;
}

export async function removeWorkspaceMember(memberId) {
  const { error } = await supabase.from("workspace_members").delete().eq("id", memberId);
  if (error) throw friendly(error, "Couldn't remove member.");
}

export async function updateMemberRole(memberId, role) {
  const { data, error } = await supabase.from("workspace_members").update({ role }).eq("id", memberId).select("*").single();
  if (error) throw friendly(error, "Couldn't update role.");
  return data;
}

export async function acceptWorkspaceInvite(token) {
  const { data, error } = await supabase.rpc("accept_workspace_invite", { p_token: token });
  if (error) throw friendly(error, "Couldn't join workspace.");
  return data;
}

// ---------- Design Polls ----------

export async function createPoll({ projectId, title, question, options, showResults = true, expiresAt = null }) {
  const { data, error } = await supabase
    .from("polls")
    .insert({
      project_id: projectId,
      title: title.trim(),
      question: question ? question.trim() : "Which design do you prefer?",
      options,
      show_results: showResults,
      expires_at: expiresAt,
    })
    .select("*")
    .single();
  if (error) throw friendly(error, "Couldn't create the poll.");
  return data;
}

export async function getPoll(token, voterKey = null) {
  const { data, error } = await supabase.rpc("get_poll", { p_token: token, p_voter_key: voterKey });
  if (error) throw friendly(error, "Couldn't open this poll.");
  return data;
}

export async function castPollVote(token, optionId, voterKey, feedback = null) {
  const { data, error } = await supabase.rpc("cast_poll_vote", {
    p_token: token,
    p_option_id: optionId,
    p_voter_key: voterKey,
    p_feedback: feedback,
  });
  if (error) throw friendly(error, "Couldn't record your vote.");
  return data;
}

export async function listProjectPolls(projectId) {
  const { data, error } = await supabase.from("polls").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
  if (error) return [];
  return data || [];
}

export function watchPollVotes(pollId, onChange) {
  const channel = supabase
    .channel(`poll_votes:${pollId}:${Math.random().toString(36).slice(2, 8)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes", filter: `poll_id=eq.${pollId}` }, () => onChange())
    .subscribe();
  return () => supabase.removeChannel(channel);
}
