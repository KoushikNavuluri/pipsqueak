import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, MessageSquarePlus, Radio, Shuffle, X } from "lucide-react";
import { Present } from "../studio/Present";
import { Notice, Splash, displayName, useSession } from "../session";
import { Button, cx, useMedia } from "../ui";
import { addSharedComment, anchorFrom, anchorLabel, getShared, getSharedComments } from "../share";

const NAME_KEY = "pq.commentName";

const ago = (t) => {
  const s = Math.round((Date.now() - new Date(t).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

// /s/:token — a shared design as a clickable prototype, for anyone with the
// link. Phone-preview links fill the phone's screen and follow the designer's
// edits live; share links can also take comments and offer a remix.
export function SharedView() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useSession();
  const phone = useMedia("(max-width: 640px)");
  const [shared, setShared] = useState(null);
  const [status, setStatus] = useState("loading");
  const [updated, setUpdated] = useState(false);
  // The "Live preview" badge shows briefly on open, then only after updates.
  const [intro, setIntro] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setIntro(false), 3500);
    return () => clearTimeout(t);
  }, []);
  const rev = useRef(null);

  // Load, then poll for changes while the page is visible: every few seconds
  // for a phone preview, less often for a share link.
  useEffect(() => {
    let live = true;
    let timer;
    const load = async () => {
      try {
        const next = await getShared(token, rev.current);
        if (!live) return;
        if (!next) {
          setStatus("gone");
          return;
        }
        if (!next.unchanged) {
          if (rev.current !== null) {
            setUpdated(true);
            setTimeout(() => live && setUpdated(false), 2500);
          }
          rev.current = next.rev;
          setShared(next);
          setStatus("ok");
        }
      } catch (err) {
        if (live && rev.current === null) setStatus("error");
      }
      if (live) timer = setTimeout(tick, rev.current !== null && shared?.kind === "device" ? 3000 : 15000);
    };
    const tick = () => (document.visibilityState === "visible" ? load() : (timer = setTimeout(tick, 2000)));
    load();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [token, shared?.kind]);

  useEffect(() => {
    if (shared?.project?.name) document.title = `${shared.project.name} · Pipsqueak`;
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, [shared?.project?.name]);

  // ----- comments -----
  const [comments, setComments] = useState([]);
  const [commenting, setCommenting] = useState(false);
  const [showList, setShowList] = useState(false);
  const [draft, setDraft] = useState(null);
  const [highlight, setHighlight] = useState(null);
  const [navigateTo, setNavigateTo] = useState(null);
  const [screenId, setScreenId] = useState(null);
  const allow = shared?.allowComments;
  useEffect(() => {
    if (!allow) return;
    let live = true;
    const load = () => getSharedComments(token).then((list) => live && setComments(list)).catch(() => {});
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 20000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [allow, token]);

  const screenName = (id) => shared?.project?.screens?.find((s) => s.id === id)?.name;

  if (status === "loading") return <Splash />;
  if (status === "gone" || status === "error" || !shared?.project) {
    return (
      <Notice
        title={status === "error" ? "Couldn't open this link" : "This link isn't active"}
        action={
          <div className="mt-6 flex justify-center">
            <Link to="/" className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-medium text-white">
              Go to Pipsqueak
            </Link>
          </div>
        }
      >
        {status === "error" ? "Check your connection and try again." : "The designer turned this link off, or it has expired. Ask them for a new one."}
      </Notice>
    );
  }

  const project = shared.project;
  const device = shared.kind === "device";
  const fullBleed = phone && !!project.screens?.length;
  const remix = () => {
    const next = `/app?remix=${token}`;
    navigate(user ? next : `/signin?next=${encodeURIComponent(next)}`);
  };

  const actions = (
    <>
      {allow && (
        <>
          <button
            onClick={() => setShowList((v) => !v)}
            className={cx("inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm", showList ? "bg-white text-night" : "hover:bg-white/10")}
          >
            <MessageCircle size={15} /> {comments.length}
          </button>
          <button
            onClick={() => {
              setCommenting((v) => !v);
              setDraft(null);
            }}
            className={cx("inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm", commenting ? "bg-accent text-white" : "hover:bg-white/10")}
          >
            <MessageSquarePlus size={15} /> {commenting ? "Pick an element" : "Comment"}
          </button>
        </>
      )}
      {shared.allowRemix && (
        <button onClick={remix} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-semibold text-night">
          <Shuffle size={15} /> Remix
        </button>
      )}
    </>
  );

  const overlay = (
    <>
      <AnimatePresence>
        {((device && intro) || updated) && (
          <motion.div
            key={updated ? "updated" : "live"}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cx(
              "pointer-events-none absolute z-20 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur",
              fullBleed ? "right-3 top-[max(10px,env(safe-area-inset-top))]" : "left-1/2 top-16 -translate-x-1/2",
            )}
          >
            <Radio size={11} className={updated ? "" : "animate-pulse"} /> {updated ? "Updated" : "Live preview"}
          </motion.div>
        )}
      </AnimatePresence>
      {fullBleed && (allow || shared.allowRemix) && (
        <div className="absolute bottom-[max(16px,env(safe-area-inset-bottom))] right-4 z-20 flex gap-2">
          {allow && (
            <button
              onClick={() => {
                setCommenting((v) => !v);
                setDraft(null);
              }}
              aria-label={commenting ? "Stop commenting" : "Comment"}
              className={cx("flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-white backdrop-blur", commenting ? "bg-accent" : "bg-black/55")}
            >
              <MessageSquarePlus size={16} /> {commenting ? "Tap an element" : comments.length || ""}
            </button>
          )}
          {shared.allowRemix && (
            <button onClick={remix} aria-label="Remix" className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur">
              <Shuffle size={16} />
            </button>
          )}
        </div>
      )}
      <AnimatePresence>
        {draft && (
          <Composer
            key="composer"
            target={anchorLabel(draft.info, screenName(draft.screenId))}
            defaultName={localStorage.getItem(NAME_KEY) || (user ? displayName(user, profile) : "")}
            onCancel={() => setDraft(null)}
            onPost={async (body, author) => {
              localStorage.setItem(NAME_KEY, author);
              const c = await addSharedComment(token, { screenId: draft.screenId, anchor: anchorFrom(draft.info), body, author });
              setComments((list) => [...list, c]);
              setDraft(null);
              setCommenting(false);
            }}
          />
        )}
        {showList && allow && !fullBleed && (
          <motion.aside
            key="list"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            className="absolute bottom-16 right-4 top-16 z-20 flex w-80 flex-col overflow-hidden rounded-2xl bg-white text-ink shadow-xl"
            aria-label="Comments"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3 text-sm font-semibold">
              Comments
              <button onClick={() => setShowList(false)} aria-label="Close comments" className="text-mute hover:text-ink">
                <X size={15} />
              </button>
            </div>
            <ul className="sb flex-1 divide-y divide-line-soft overflow-y-auto">
              {comments.length === 0 && <li className="p-4 text-sm text-mute">No comments yet. Choose Comment, then click the part of the design you want to talk about.</li>}
              {comments.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => {
                      setNavigateTo({ id: c.screenId, n: Date.now() });
                      setHighlight({ screenId: c.screenId, path: c.anchor?.path || null });
                    }}
                    className={cx("w-full px-4 py-3 text-left hover:bg-wash", c.screenId === screenId && "bg-wash/60")}
                  >
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="font-semibold">{c.author}</span>
                      <span className="text-faint">{ago(c.at)}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-mute">{anchorLabel(c.anchor, screenName(c.screenId))}</div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
                  </button>
                </li>
              ))}
            </ul>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );

  return (
    <>
      <Present
        project={project}
        fullBleed={fullBleed}
        initialDevice={fullBleed ? "mobile" : undefined}
        commenting={commenting}
        onElement={(id, info) => commenting && info && setDraft({ screenId: id, info })}
        onScreen={setScreenId}
        highlight={draft ? { screenId: draft.screenId, path: draft.info.path } : highlight}
        navigateTo={navigateTo}
        actions={actions}
        overlay={overlay}
      />
      {!fullBleed && (
        <div className="pointer-events-none fixed bottom-4 left-4 z-[85] text-xs text-white/50">
          Shared by {shared.owner} ·{" "}
          <Link to="/" className="pointer-events-auto underline hover:text-white">
            Made with Pipsqueak
          </Link>
        </div>
      )}
    </>
  );
}

function Composer({ target, defaultName, onCancel, onPost }) {
  const [name, setName] = useState(defaultName || "");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onPost(body.trim(), name.trim() || "Guest");
    } catch (err) {
      setError(err.message || "Couldn't post that. Try again.");
      setBusy(false);
    }
  };
  return (
    <motion.form
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      onSubmit={submit}
      className="absolute inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-30 mx-auto max-w-md rounded-2xl bg-white p-3 text-ink shadow-2xl"
      aria-label="New comment"
    >
      <div className="mb-2 truncate px-1 text-xs text-mute">On {target}</div>
      <textarea
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder="What should change here?"
        aria-label="Comment"
        className="w-full resize-none rounded-xl border border-line px-3 py-2 text-[15px] outline-none focus:border-ink"
      />
      <div className="mt-2 flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="Your name"
          aria-label="Your name"
          className="h-9 min-w-0 flex-1 rounded-lg border border-line px-3 text-sm outline-none focus:border-ink"
        />
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!body.trim() || busy}>
          {busy ? "Posting…" : "Post"}
        </Button>
      </div>
      {error && <p className="mt-2 px-1 text-xs text-danger">{error}</p>}
    </motion.form>
  );
}
