import { useCallback, useEffect, useState } from "react";
import { Check, Link2, LoaderCircle, MessageSquarePlus, RotateCcw, Trash2, Wand } from "lucide-react";
import { Button, cx } from "../../ui";
import { anchorLabel, deleteComment, listComments, setResolved, watchComments } from "../../share";

const ago = (t) => {
  const s = Math.round((Date.now() - new Date(t).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

// A design's comments, kept current: new ones from share links arrive live.
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
    return () => {
      stop();
      removeEventListener("focus", onFocus);
    };
  }, [projectId, reload]);
  return { comments: comments || [], loading: comments === null, reload, setComments };
}

// The instruction Pip gets for one screen's open comments.
export function commentsInstruction(list, screenName) {
  const lines = list.map((c, i) => {
    const a = c.anchor || {};
    const where = a.tag ? `On the <${a.tag}>${a.text ? ` “${a.text.replace(/\s+/g, " ").trim().slice(0, 80)}”` : ""}${a.outer ? ` (currently: ${a.outer.replace(/\s+/g, " ").slice(0, 300)})` : ""}` : "On the screen as a whole";
    return `${i + 1}. ${where}: ${c.body.replace(/\s+/g, " ").trim()}`;
  });
  return `Resolve these review comments on the ${screenName} screen. Make the change each comment asks for, keep everything else as it is, and stay within the design system.\n${lines.join("\n")}`;
}

function Composer({ target, onPost, onCancel }) {
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
    <form onSubmit={submit} className="rounded-2xl border border-ink/80 bg-surface p-3 shadow-soft">
      <div className="mb-2 truncate text-xs text-mute">On {target}</div>
      <textarea
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
          if (e.key === "Escape") onCancel?.();
        }}
        maxLength={1000}
        rows={3}
        placeholder="Leave a note for yourself or Pip…"
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
          {busy ? "Posting…" : "Comment"}
        </Button>
      </div>
    </form>
  );
}

export function CommentsPanel({ project, state, target, focusId, onPost, onCancelDraft, onGo, onAskPip, onToast }) {
  const { comments, loading, setComments } = state;
  const [showResolved, setShowResolved] = useState(false);
  const [working, setWorking] = useState(null);
  const screenName = (id) => project.screens.find((sc) => sc.id === id)?.name;
  const open = comments.filter((c) => !c.resolved_at);
  const resolved = comments.filter((c) => c.resolved_at);
  const number = new Map(open.map((c, i) => [c.id, i + 1]));
  const actionable = open.filter((c) => project.screens.some((sc) => sc.id === c.screen_id && sc.html));
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
  const resolve = (c, by) =>
    act(c.id, async () => {
      await setResolved([c.id], by);
      setComments((list) => list.map((x) => (x.id === c.id ? { ...x, resolved_at: by ? new Date().toISOString() : null, resolved_by: by || null } : x)));
    });
  const remove = (c) =>
    act(c.id, async () => {
      await deleteComment(c.id);
      setComments((list) => list.filter((x) => x.id !== c.id));
    });

  const Item = ({ c }) => (
    <li id={`comment-${c.id}`} className={cx("rounded-xl border p-3 transition-colors", focusId === c.id ? "border-accent bg-accent-soft/40" : "border-line")}>
      <button onClick={() => onGo(c)} className="block w-full text-left">
        <div className="flex items-baseline gap-2 text-xs">
          {!c.resolved_at && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">{number.get(c.id)}</span>}
          <span className="font-semibold">{c.author_name}</span>
          {c.source === "share" && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-sunken px-1.5 py-0.5 text-[10px] font-medium text-mute" title="Left through your share link">
              <Link2 size={9} /> link
            </span>
          )}
          <span className="ml-auto shrink-0 text-faint">{ago(c.created_at)}</span>
        </div>
        <div className="mt-1 truncate text-[11px] text-mute">{anchorLabel(c.anchor, screenName(c.screen_id) || "a deleted screen")}</div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm">{c.body}</p>
        {c.resolved_at && <div className="mt-1 text-[11px] text-faint">Resolved{c.resolved_by ? ` by ${c.resolved_by}` : ""}</div>}
      </button>
      <div className="mt-2 flex gap-1.5">
        {c.resolved_at ? (
          <button onClick={() => resolve(c, null)} disabled={!!working} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-semibold hover:border-ink disabled:opacity-40">
            <RotateCcw size={11} /> Reopen
          </button>
        ) : (
          <>
            <button onClick={() => resolve(c, "You")} disabled={!!working} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-semibold hover:border-ink disabled:opacity-40">
              <Check size={11} /> Resolve
            </button>
            {screenName(c.screen_id) && (
              <button onClick={() => act("pip", () => onAskPip([c]))} disabled={!!working} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-semibold hover:border-ink disabled:opacity-40">
                <Wand size={11} /> Ask Pip
              </button>
            )}
          </>
        )}
        <button onClick={() => remove(c)} disabled={!!working} aria-label="Delete comment" className="ml-auto rounded-md p-1 text-faint hover:text-danger disabled:opacity-40">
          <Trash2 size={13} />
        </button>
      </div>
    </li>
  );

  return (
    <div className="sb flex h-full flex-col overflow-y-auto p-4">
      {target ? (
        <Composer target={target.label} onPost={onPost} onCancel={target.draft ? onCancelDraft : null} />
      ) : (
        <div className="flex items-start gap-2.5 rounded-2xl bg-wash p-3 text-xs text-mute">
          <MessageSquarePlus size={15} className="mt-0.5 shrink-0 text-ink-2" />
          <span>
            Choose the comment tool (<b>C</b>) and click any element to pin a note to it. People you share a link with can comment too.
          </span>
        </div>
      )}

      {open.length > 0 && (
        <div className="mt-4 rounded-2xl border border-line p-3">
          <div className="text-sm font-semibold">
            {open.length} open comment{open.length === 1 ? "" : "s"}
          </div>
          <p className="mt-0.5 text-xs text-mute">
            {screensToFix ? `Pip reworks ${screensToFix} screen${screensToFix === 1 ? "" : "s"} to address them (about ${screensToFix} credit${screensToFix === 1 ? "" : "s"}) and resolves the ones it handled.` : "None of them are on a screen Pip can edit."}
          </p>
          <Button size="sm" icon={working === "pip" ? LoaderCircle : Wand} className="mt-2.5" disabled={!!working || !screensToFix} onClick={() => act("pip", () => onAskPip(actionable))}>
            {working === "pip" ? "Pip is on it…" : "Ask Pip to resolve all"}
          </Button>
        </div>
      )}

      {loading ? (
        <LoaderCircle size={16} className="mx-auto mt-6 animate-spin text-mute" />
      ) : (
        <>
          <ul className="mt-4 grid gap-2">
            {open.map((c) => (
              <Item key={c.id} c={c} />
            ))}
          </ul>
          {!open.length && <p className="mt-4 text-center text-sm text-mute">No open comments.</p>}
          {resolved.length > 0 && (
            <div className="mt-5">
              <button onClick={() => setShowResolved((v) => !v)} className="text-xs font-semibold text-mute hover:text-ink">
                {showResolved ? "Hide" : "Show"} {resolved.length} resolved
              </button>
              {showResolved && (
                <ul className="mt-2 grid gap-2 opacity-80">
                  {resolved.map((c) => (
                    <Item key={c.id} c={c} />
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
