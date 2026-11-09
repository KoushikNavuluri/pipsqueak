import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CornerDownRight, KeyRound, Lock, MessageCircle, MessageSquare, MessageSquarePlus, Radio, Shuffle, X } from "lucide-react";
import { Present } from "../studio/Present";
import { Notice, Splash, displayName, useSession } from "../session";
import { Button, cx, useMedia } from "../ui";
import { addSharedComment, anchorFrom, anchorLabel, getShared, getSharedComments, recordShareView } from "../share";

const NAME_KEY = "pq.commentName";
const PASSCODE_KEY_PREFIX = "pq.passcode.";

const ago = (t) => {
  const s = Math.round((Date.now() - new Date(t).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

export function SharedView() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useSession();
  const phone = useMedia("(max-width: 640px)");
  const [shared, setShared] = useState(null);
  const [status, setStatus] = useState("loading");
  const [updated, setUpdated] = useState(false);
  const [passcode, setPasscode] = useState(() => sessionStorage.getItem(PASSCODE_KEY_PREFIX + token) || "");
  const [passcodeDraft, setPasscodeDraft] = useState("");
  const [passcodeError, setPasscodeError] = useState(null);
  const [passcodeBusy, setPasscodeBusy] = useState(false);

  const [intro, setIntro] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setIntro(false), 3500);
    return () => clearTimeout(t);
  }, []);
  const rev = useRef(null);

  // Record visit once per session
  useEffect(() => {
    const dev = phone ? "mobile" : window.innerWidth < 1024 ? "tablet" : "desktop";
    recordShareView(token, dev, document.referrer);
  }, [token, phone]);

  // Load and poll
  useEffect(() => {
    let live = true;
    let timer;
    const load = async () => {
      try {
        const next = await getShared(token, rev.current, passcode || null);
        if (!live) return;
        if (!next) {
          setStatus("gone");
          return;
        }
        if (next.protected) {
          setShared(next);
          setStatus("locked");
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
  }, [token, shared?.kind, passcode]);

  // Open Graph & Page meta
  useEffect(() => {
    if (shared?.project?.name) {
      document.title = `${shared.project.name} · Pipsqueak`;
      const desc = shared.project.tagline || `Explore the interactive prototype of ${shared.project.name} designed in Pipsqueak.`;
      let mDesc = document.querySelector('meta[name="description"]');
      if (!mDesc) {
        mDesc = document.createElement("meta");
        mDesc.name = "description";
        document.head.appendChild(mDesc);
      }
      mDesc.content = desc;
    }
  }, [shared?.project?.name, shared?.project?.tagline]);

  // ----- comments & threads -----
  const [comments, setComments] = useState([]);
  const [commenting, setCommenting] = useState(false);
  const [showList, setShowList] = useState(false);
  const [draft, setDraft] = useState(null);
  const [replyParent, setReplyParent] = useState(null);
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

  const unlockWithPasscode = async (e) => {
    e.preventDefault();
    if (!passcodeDraft.trim() || passcodeBusy) return;
    setPasscodeBusy(true);
    setPasscodeError(null);
    try {
      const next = await getShared(token, null, passcodeDraft.trim());
      if (next?.protected) {
        setPasscodeError("Incorrect passcode. Try again.");
        return;
      }
      if (next?.project) {
        sessionStorage.setItem(PASSCODE_KEY_PREFIX + token, passcodeDraft.trim());
        setPasscode(passcodeDraft.trim());
        setShared(next);
        setStatus("ok");
      } else {
        setStatus("gone");
      }
    } catch (err) {
      setPasscodeError(err.message || "Couldn't unlock prototype.");
    } finally {
      setPasscodeBusy(false);
    }
  };

  if (status === "loading") return <Splash />;

  if (status === "locked") {
    return (
      <div className="grid min-h-screen place-items-center bg-paper p-6 text-ink">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm rounded-3xl border border-line bg-surface p-7 text-center shadow-soft">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-sunken text-ink">
            <Lock size={22} />
          </div>
          <h1 className="display mt-4 text-2xl font-bold">{shared?.title || "Protected Design"}</h1>
          <p className="mt-1.5 text-sm text-mute">This prototype is password protected. Enter the passcode to view it.</p>
          <form onSubmit={unlockWithPasscode} className="mt-5 space-y-3">
            <input
              type="password"
              autoFocus
              value={passcodeDraft}
              onChange={(e) => setPasscodeDraft(e.target.value)}
              placeholder="Enter passcode"
              className="h-11 w-full rounded-xl border border-line bg-wash px-3.5 text-center font-mono text-sm tracking-wider text-ink outline-none focus:border-ink"
            />
            {passcodeError && <p className="text-xs text-danger">{passcodeError}</p>}
            <Button type="submit" className="w-full" disabled={!passcodeDraft.trim() || passcodeBusy}>
              {passcodeBusy ? "Checking…" : "Unlock Prototype"}
            </Button>
          </form>
        </motion.div>
      </div>
    );
  }

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

  // Comments & Threading
  const parents = comments.filter((c) => !c.parentId);
  const repliesByParent = new Map();
  for (const c of comments) {
    if (c.parentId) {
      const arr = repliesByParent.get(c.parentId) || [];
      arr.push(c);
      repliesByParent.set(c.parentId, arr);
    }
  }

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
              setReplyParent(null);
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

  const commentListContent = (
    <ul className="sb flex-1 divide-y divide-line-soft overflow-y-auto">
      {parents.length === 0 && (
        <li className="p-4 text-sm text-mute">No comments yet. Choose Comment, then tap the part of the design you want to talk about.</li>
      )}
      {parents.map((c) => {
        const replies = repliesByParent.get(c.id) || [];
        return (
          <li key={c.id} className="p-3">
            <button
              onClick={() => {
                setNavigateTo({ id: c.screenId, n: Date.now() });
                setHighlight({ screenId: c.screenId, path: c.anchor?.path || null });
              }}
              className={cx("w-full rounded-xl p-2 text-left transition-colors hover:bg-wash", c.screenId === screenId && "bg-wash/60")}
            >
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-semibold">{c.author}</span>
                <span className="text-faint">{ago(c.at)}</span>
              </div>
              <div className="mt-0.5 text-[11px] text-mute">{anchorLabel(c.anchor, screenName(c.screenId))}</div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
            </button>
            {replies.length > 0 && (
              <div className="mt-2 space-y-1.5 pl-4 border-l-2 border-line-soft">
                {replies.map((r) => (
                  <div key={r.id} className="rounded-lg bg-wash/50 p-2 text-xs">
                    <div className="flex items-baseline justify-between gap-1 text-[11px]">
                      <span className="font-semibold">{r.author}</span>
                      <span className="text-faint">{ago(r.at)}</span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-[13px]">{r.body}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-1.5 pl-2">
              <button
                onClick={() => setReplyParent(c)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-mute hover:text-ink"
              >
                <CornerDownRight size={11} /> Reply
              </button>
            </div>
          </li>
        );
      })}
    </ul>
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
            <>
              <button
                onClick={() => setShowList((v) => !v)}
                aria-label="View comments"
                className="flex h-11 items-center gap-1.5 rounded-full bg-black/60 px-3.5 text-sm font-semibold text-white backdrop-blur"
              >
                <MessageCircle size={16} /> {comments.length || ""}
              </button>
              <button
                onClick={() => {
                  setCommenting((v) => !v);
                  setDraft(null);
                  setReplyParent(null);
                }}
                aria-label={commenting ? "Stop commenting" : "Comment"}
                className={cx(
                  "flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-white backdrop-blur",
                  commenting ? "bg-accent" : "bg-black/60",
                )}
              >
                <MessageSquarePlus size={16} /> {commenting ? "Tap an element" : "Comment"}
              </button>
            </>
          )}
          {shared.allowRemix && (
            <button onClick={remix} aria-label="Remix" className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur">
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

        {replyParent && (
          <Composer
            key="reply-composer"
            target={`reply to ${replyParent.author}`}
            placeholder={`Reply to ${replyParent.author}…`}
            defaultName={localStorage.getItem(NAME_KEY) || (user ? displayName(user, profile) : "")}
            onCancel={() => setReplyParent(null)}
            onPost={async (body, author) => {
              localStorage.setItem(NAME_KEY, author);
              const c = await addSharedComment(token, {
                screenId: replyParent.screenId,
                anchor: replyParent.anchor,
                body,
                author,
                parentId: replyParent.id,
              });
              setComments((list) => [...list, c]);
              setReplyParent(null);
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
              <span>Comments & Threads ({comments.length})</span>
              <button onClick={() => setShowList(false)} aria-label="Close comments" className="text-mute hover:text-ink">
                <X size={15} />
              </button>
            </div>
            {commentListContent}
          </motion.aside>
        )}

        {showList && allow && fullBleed && (
          <motion.div
            key="mobile-drawer"
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed inset-x-0 bottom-0 top-20 z-40 flex flex-col rounded-t-3xl bg-white text-ink shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5 text-sm font-semibold">
              <span>Comments ({comments.length})</span>
              <button onClick={() => setShowList(false)} className="rounded-full bg-wash p-1 text-mute hover:text-ink">
                <X size={18} />
              </button>
            </div>
            {commentListContent}
          </motion.div>
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

function Composer({ target, placeholder, defaultName, onCancel, onPost }) {
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
        placeholder={placeholder || "What should change here?"}
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
