import { useEffect, useState } from "react";
import { Check, Copy, LoaderCircle, Plus, Shield, Trash2, UserPlus, Users, X } from "lucide-react";
import { Dialog, Button, Segmented, cx } from "../ui";
import {
  createWorkspace,
  inviteUrl,
  inviteWorkspaceMember,
  listWorkspaceMembers,
  removeWorkspaceMember,
  updateMemberRole,
} from "../share";
import { useSession } from "../session";

const ROLES = [
  { value: "editor", label: "Editor" },
  { value: "commenter", label: "Commenter" },
  { value: "viewer", label: "Viewer" },
];

export function WorkspaceModal({ workspace, onClose, onCreated, toast }) {
  const { user } = useSession();
  const [tab, setTab] = useState(workspace ? "members" : "create");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  // Members state
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [inviting, setInviting] = useState(false);
  const [copiedToken, setCopiedToken] = useState(null);

  const loadMembers = () => {
    if (!workspace?.id) return;
    setLoadingMembers(true);
    listWorkspaceMembers(workspace.id)
      .then(setMembers)
      .catch((err) => toast(err.message, "error"))
      .finally(() => setLoadingMembers(false));
  };

  useEffect(() => {
    if (workspace?.id) loadMembers();
  }, [workspace?.id]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const ws = await createWorkspace(name.trim());
      toast("Workspace created!");
      onCreated?.(ws);
      onClose();
    } catch (err) {
      toast(err.message || "Couldn't create workspace", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim() || inviting || !workspace?.id) return;
    setInviting(true);
    try {
      const m = await inviteWorkspaceMember(workspace.id, inviteEmail.trim(), inviteRole);
      setMembers([...members, m]);
      setInviteEmail("");
      toast("Invite sent!");
    } catch (err) {
      toast(err.message || "Couldn't invite member", "error");
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberId, role) => {
    try {
      await updateMemberRole(memberId, role);
      setMembers((list) => list.map((m) => (m.id === memberId ? { ...m, role } : m)));
      toast("Role updated");
    } catch (err) {
      toast(err.message || "Couldn't update role", "error");
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!confirm("Remove this member from the workspace?")) return;
    try {
      await removeWorkspaceMember(memberId);
      setMembers((list) => list.filter((m) => m.id !== memberId));
      toast("Member removed");
    } catch (err) {
      toast(err.message || "Couldn't remove member", "error");
    }
  };

  const copyInvite = async (token) => {
    try {
      await navigator.clipboard.writeText(inviteUrl(token));
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 1600);
      toast("Invite link copied!");
    } catch {}
  };

  return (
    <Dialog title={workspace ? `${workspace.name} Workspace` : "Create Workspace"} onClose={onClose} size="md">
      {workspace && (
        <Segmented
          id="ws-tabs"
          className="mb-5"
          value={tab}
          onChange={setTab}
          options={[
            { value: "members", label: "Team Members" },
            { value: "invite", label: "Invite Collaborator" },
          ]}
        />
      )}

      {tab === "create" && (
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-ink">Workspace Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Design Studio or Marketing Team"
              maxLength={60}
              className="mt-1.5 h-10 w-full rounded-xl border border-line bg-wash px-3.5 text-sm outline-none focus:border-ink"
              required
            />
          </div>
          <p className="text-xs text-mute">
            Workspaces let you collaborate with editors, commenters, and clients in a shared environment.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!name.trim() || busy}>
              {busy ? "Creating…" : "Create Workspace"}
            </Button>
          </div>
        </form>
      )}

      {tab === "members" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-mute">
            <span>{members.length} {members.length === 1 ? "member" : "members"}</span>
            <Button size="sm" variant="secondary" icon={UserPlus} onClick={() => setTab("invite")}>
              Invite
            </Button>
          </div>

          {loadingMembers ? (
            <LoaderCircle size={18} className="mx-auto my-6 animate-spin text-mute" />
          ) : (
            <ul className="divide-y divide-line-soft max-h-60 overflow-y-auto">
              {members.map((m) => {
                const isOwner = m.role === "owner";
                const isSelf = m.user_id === user?.id;
                return (
                  <li key={m.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-semibold text-ink truncate flex items-center gap-1.5">
                        <span>{m.email}</span>
                        {isSelf && <span className="text-[10px] text-faint">(you)</span>}
                        {m.status === "pending" && (
                          <span className="rounded-full bg-amber-100 text-amber-800 px-1.5 py-0.2 text-[9px] font-bold">
                            Pending
                          </span>
                        )}
                      </div>
                      <div className="text-mute capitalize mt-0.5">{m.role}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.invite_token && (
                        <button
                          onClick={() => copyInvite(m.invite_token)}
                          className="inline-flex items-center gap-1 rounded-lg border border-line bg-wash px-2 py-1 text-[11px] font-medium text-mute hover:text-ink"
                        >
                          {copiedToken === m.invite_token ? <Check size={11} className="text-accent" /> : <Copy size={11} />}
                          <span>Link</span>
                        </button>
                      )}
                      {!isOwner && (
                        <>
                          <select
                            value={m.role}
                            onChange={(e) => handleRoleChange(m.id, e.target.value)}
                            className="h-7 rounded-lg border border-line bg-surface px-2 text-[11px] outline-none"
                          >
                            <option value="editor">Editor</option>
                            <option value="commenter">Commenter</option>
                            <option value="viewer">Viewer</option>
                          </select>
                          <button
                            onClick={() => handleRemoveMember(m.id)}
                            className="p-1 text-faint hover:text-danger rounded-md"
                            aria-label="Remove member"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {tab === "invite" && (
        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-ink">Member Email</label>
            <input
              type="email"
              autoFocus
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="collaborator@company.com"
              className="mt-1.5 h-10 w-full rounded-xl border border-line bg-wash px-3.5 text-sm outline-none focus:border-ink"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink">Role & Permissions</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {ROLES.map((r) => (
                <button
                  type="button"
                  key={r.value}
                  onClick={() => setInviteRole(r.value)}
                  className={cx(
                    "rounded-xl border p-2.5 text-center text-xs transition-colors",
                    inviteRole === r.value ? "border-ink bg-surface font-semibold shadow-xs" : "border-line bg-wash opacity-70",
                  )}
                >
                  <div className="font-semibold">{r.label}</div>
                  <div className="text-[10px] text-mute mt-0.5">
                    {r.value === "editor" ? "Can edit" : r.value === "commenter" ? "Can comment" : "View only"}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setTab("members")}>
              Back
            </Button>
            <Button type="submit" size="sm" disabled={!inviteEmail.trim() || inviting}>
              {inviting ? "Inviting…" : "Send Invite"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
