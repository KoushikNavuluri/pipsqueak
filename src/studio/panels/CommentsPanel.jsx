import { useCallback, useEffect, useState } from "react";
import { Check, CornerDownRight, Link2, LoaderCircle, MessageSquare, MessageSquarePlus, RotateCcw, Trash2, Undo2, Wand } from "lucide-react";
import { Button, cx } from "../../ui";
import { addComment, anchorLabel, deleteComment, listComments, setResolved, watchComments } from "../../share";

const ago = (t) => {
  const s = Math.round((Date.now() - new Date(t).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

export function useComments(projectId, onError) {
  const [comments, setComments] = useState(null);
  const reload = useCallback(
    () =>
      listComments(projectId)
        .then(setComments)
        .catch((err) => {
          setComments((c) => c || []);
          onError?.(err.message);
        }),
    [projectId],
  );
  useEffect(() => {
    setComments(null);
    reload();
    const stop = watchComments(projectId, reload);
    const onFocus = () => reload();
    addEventListener("focus", onFocus);
    const poll = setInterval(() => document.visibilityState === "visible" && reload(), 30000);
    return () => {
      stop();
      removeEventListener("focus", onFocus);
      clearInterval(poll);
    };
  }, [projectId, reload]);
  return { comments: comments || [], loading: comments === null, reload, setComments };
}

export function commentsInstruction(list, screenName) {
  const lines = list.map((c, i) => {
    const a = c.anchor || {};
    const where = a.tag ? `About the ${a.tag}${a.text ? ` that read “${a.text.replace(/\s+/g, " ").trim().slice(0, 80)}”` : ""}` : "About the screen as a whole";
    return `${i + 1}. ${where}: ${c.body.replace(/\s+/g, " ").trim()}`;
  });
  return `Resolve these review comments on the ${screenName} screen. Make the change each comment asks for, keep everything else on the screen as it is, and stay within the design system. Return the complete screen.\n${lines.join("\n")}`;
}

function Composer({ target, placeholder, onPost, onCancel, autoFocus = true, compact = false }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      await onPost(body.trim());
      setBody("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className={cx("rounded-2xl border border-ink/80 bg-surface p-3 shadow-soft", compact && "p-2.5")}>
      {target && <div className="mb-2 truncate text-xs text-mute">On {target}</div>}
      <textarea
        autoFocus={autoFocus}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
          if (e.key === "Escape") onCancel?.();
        }}
        maxLength={1000}
        rows={compact ? 2 : 3}
        placeholder={placeholder || "Leave a note for yourself or Pip…"}
        aria-label="Comment"
        className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-faint"
      />
      <div className="mt-2 flex justify-end gap-2">
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" disabled={!body.trim() || busy}>
          {busy ? "Posting…" : compact ? "Reply" : "Comment"}
        </Button>
      </div>
    </form>
  );
}

export function CommentsPanel({ project, state, target, focusId, onPost, onCancelDraft, onGo, onAskPip, onToast }) {
  const { comments, loading, setComments } = state;
  const [showResolved, setShowResolved] = useState(false);
  const [working, setWorking] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [lastDeleted, setLastDeleted] = useState(null);

  const screenName = (id) => project.screens.find((sc) => sc.id === id)?.name;

  // Threading: parent comments vs replies
  const parents = comments.filter((c) => !c.parent_id);
  const repliesByParent = new Map();
  for (const c of comments) {
    if (c.parent_id) {
      const arr = repliesByParent.get(c.parent_id) || [];
      arr.push(c);
      repliesByParent.set(c.parent_id, arr);
    }
  }

  const openParents = parents.filter((c) => !c.resolved_at);
  const resolvedParents = parents.filter((c) => c.resolved_at);
  const number = new Map(openParents.map((c, i) => [c.id, i + 1]));

  const actionable = openParents.filter((c) => project.screens.some((sc) => sc.id === c.screen_id && sc.html));
  const screensToFix = new Set(actionable.map((c) => c.screen_id)).size;

  const act = async (key, fn) => {
    setWorking(key);
    try {
      await fn();
    } catch (err) {
      onToast?.(err.message || "That didn't work. Try again.", "error");
    } finally {
      setWorking(null);
    }
  };

  const resolveThread = (parent, by) =>
    act(parent.id, async () => {
      const replies = repliesByParent.get(parent.id) || [];
      const ids = [parent.id, ...replies.map((r) => r.id)];
      await setResolved(ids, by);
      setComments((list) =>
        list.map((x) =>
          ids.includes(x.id) ? { ...x, resolved_at: by ? new Date().toISOString() : null, resolved_by: by || null } : x,
        ),
      );
    });

  const removeComment = (c) =>
    act(c.id, async () => {
      const backup = { ...c };
      await deleteComment(c.id);
      setComments((list) => list.filter((x) => x.id !== c.id && x.parent_id !== c.id));
      setLastDeleted(backup);
      setTimeout(() => setLastDeleted((cur) => (cur?.id === backup.id ? null : cur)), 6000);
    });

  const undoDelete = async () => {
    if (!lastDeleted) return;
    const backup = lastDeleted;
    setLastDeleted(null);
    try {
      const restored = await addComment({
        projectId: backup.project_id,
        screenId: backup.screen_id,
        anchor: backup.anchor,
        body: backup.body,
        authorName: backup.author_name,
        authorId: backup.author_id,
        parentId: backup.parent_id,
      });
      setComments((list) => [...list, restored]);
      onToast?.("Comment restored");
    } catch (err) {
      onToast?.("Couldn't restore comment", "error");
    }
  };

  const postReply = async (parentId, body) => {
    const parent = comments.find((c) => c.id === parentId);
    if (!parent) return;
    const author = "You";
    const res = await addComment({
      projectId: parent.project_id,
      screenId: parent.screen_id,
      anchor: parent.anchor,
      body,
      authorName: author,
      authorId: parent.author_id,
      parentId,
    });
    setComments((list) => [...list, res]);
    setReplyingTo(null);
  };

  const Item = ({ c, isReply = false }) => (
    <div id={`comment-${c.id}`} className={cx("transition-colors", isReply ? "mt-2 pl-3 border-l-2 border-line-soft" : "")}>
      <button onClick={() => onGo(c)} className="block w-full text-left">
        <div className="flex items-baseline gap-2 text-xs">
          {!c.resolved_at && !isReply && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
              {number.get(c.id)}
            </span>
          )}
          {isReply && <CornerDownRight size={11} className="text-mute" />}
          <span className="font-semibold">{c.author_name}</span>
          {c.source === "share" && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-sunken px-1.5 py-0.5 text-[10px] font-medium text-mute" title="Left through your share link">
              <Link2 size={9} /> link
            </span>
          )}
          <span className="ml-auto shrink-0 text-faint">{ago(c.created_at)}</span>
        </div>
        {!isReply && (
          <div className="mt-1 truncate text-[11px] text-mute">{anchorLabel(c.anchor, screenName(c.screen_id) || "a deleted screen")}</div>
        )}
        <p className="mt-1 whitespace-pre-wrap break-words text-sm">{c.body}</p>
        {c.resolved_at && <div className="mt-1 text-[11px] text-faint">Resolved{c.resolved_by ? ` by ${c.resolved_by}` : ""}</div>}
      </button>

      <div className="mt-2 flex items-center gap-1.5">
        {!isReply && (
          <>
            {c.resolved_at ? (
              <button onClick={() => resolveThread(c, null)} disabled={!!working} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-semibold hover:border-ink disabled:opacity-40">
                <RotateCcw size={11} /> Reopen thread
              </button>
            ) : (
              <>
                <button onClick={() => resolveThread(c, "You")} disabled={!!working} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-semibold hover:border-ink disabled:opacity-40">
                  <Check size={11} /> Resolve
                </button>
                <button onClick={() => setReplyingTo((cur) => (cur === c.id ? null : c.id))} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-semibold hover:border-ink">
                  <MessageSquare size={11} /> Reply
                </button>
                {screenName(c.screen_id) && (
                  <button onClick={() => act("pip", () => onAskPip([c]))} disabled={!!working} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-semibold hover:border-ink disabled:opacity-40">
                    <Wand size={11} /> Ask Pip
                  </button>
                )}
              </>
            )}
          </>
        )}
        <button onClick={() => removeComment(c)} disabled={!!working} aria-label="Delete comment" className="ml-auto rounded-md p-1 text-faint hover:text-danger disabled:opacity-40">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );

  const Thread = ({ parent }) => {
    const replies = repliesByParent.get(parent.id) || [];
    return (
      <li className={cx("rounded-xl border p-3 transition-colors", focusId === parent.id ? "border-accent bg-accent-soft/40" : "border-line")}>
        <Item c={parent} />
        {replies.length > 0 && (
          <div className="mt-2 space-y-2">
            {replies.map((rep) => (
              <Item key={rep.id} c={rep} isReply />
            ))}
          </div>
        )}
        {replyingTo === parent.id && (
          <div className="mt-3 pl-3">
            <Composer
              compact
              placeholder={`Reply to ${parent.author_name}…`}
              onPost={(text) => postReply(parent.id, text)}
              onCancel={() => setReplyingTo(null)}
            />
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="sb flex h-full flex-col overflow-y-auto p-4">
      {target ? (
        <Composer target={target.label} onPost={onPost} onCancel={target.draft ? onCancelDraft : null} />
      ) : (
        <div className="flex items-start gap-2.5 rounded-2xl bg-wash p-3 text-xs text-mute">
          <MessageSquarePlus size={15} className="mt-0.5 shrink-0 text-ink-2" />
          <span>
            Choose the comment tool (<b>C</b>) and click any element to pin a note. Leave replies and resolve threads directly.
          </span>
        </div>
      )}

      {lastDeleted && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-ink px-3 py-2 text-xs text-white shadow-soft">
          <span>Comment deleted</span>
          <button onClick={undoDelete} className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
            <Undo2 size={12} /> Undo
          </button>
        </div>
      )}

      {openParents.length > 0 && (
        <div className="mt-4 rounded-2xl border border-line p-3">
          <div className="text-sm font-semibold">
            {openParents.length} open thread{openParents.length === 1 ? "" : "s"}
          </div>
          <p className="mt-0.5 text-xs text-mute">
            {screensToFix
              ? `Pip reworks ${screensToFix} screen${screensToFix === 1 ? "" : "s"} to address them and resolves what it handled.`
              : "None of them are on a screen Pip can edit."}
          </p>
          <Button
            size="sm"
            icon={working === "pip" ? LoaderCircle : Wand}
            className="mt-2.5"
            disabled={!!working || !screensToFix}
            onClick={() => act("pip", () => onAskPip(actionable))}
          >
            {working === "pip" ? "Pip is on it…" : "Ask Pip to resolve all"}
          </Button>
        </div>
      )}

      {loading ? (
        <LoaderCircle size={16} className="mx-auto mt-6 animate-spin text-mute" />
      ) : (
        <>
          <ul className="mt-4 grid gap-3">
            {openParents.map((c) => (
              <Thread key={c.id} parent={c} />
            ))}
          </ul>
          {!openParents.length && <p className="mt-4 text-center text-sm text-mute">No open comments.</p>}
          {resolvedParents.length > 0 && (
            <div className="mt-5">
              <button onClick={() => setShowResolved((v) => !v)} className="text-xs font-semibold text-mute hover:text-ink">
                {showResolved ? "Hide" : "Show"} {resolvedParents.length} resolved thread{resolvedParents.length === 1 ? "" : "s"}
              </button>
              {showResolved && (
                <ul className="mt-2 grid gap-3 opacity-80">
                  {resolvedParents.map((c) => (
                    <Thread key={c.id} parent={c} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
