import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Plus, RotateCcw, Users, Wand, X } from "lucide-react";
import { Button, EASE, IconButton, cx } from "../ui";
import { PipGlyph } from "../brand";
import { askAi } from "./client";

// What the user chose for each idea, kept for the session: closing the panel,
// leaving the page or backing out of a design loses nothing.
const drafts = new Map();
const blank = () => ({ brief: null, pitch: "", audience: "", name: null, ownNames: [], picks: {}, own: {}, notes: "" });

function remember(prompt, draft) {
  drafts.delete(prompt);
  drafts.set(prompt, draft);
  if (drafts.size > 12) drafts.delete(drafts.keys().next().value);
}

// The brief for an idea as the generator takes it, or null before Pip has
// asked its questions. Answers mix Pip's options with the user's own.
export const briefOf = (prompt) => briefFrom(drafts.get(prompt));

function briefFrom(d) {
  if (!d?.brief) return null;
  return {
    pitch: d.pitch.trim() || d.brief.pitch,
    audience: d.audience.trim() || d.brief.audience,
    name: d.name,
    answers: (d.brief.questions || [])
      .map((q, i) => ({ question: q.question, answer: (d.picks[i] || []).join("; "), picks: d.picks[i] || [] }))
      .filter((a) => a.answer),
    notes: d.notes.trim(),
  };
}

function Chip({ on, onClick, onRemove, children }) {
  return (
    <motion.span
      layout="position"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: EASE }}
      className={cx(
        "inline-flex max-w-full items-center rounded-full border transition-colors duration-200",
        on ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-2 hover:border-ink/40 hover:text-ink",
      )}
    >
      <button type="button" onClick={onClick} aria-pressed={on} className={cx("inline-flex min-h-9 min-w-0 items-center gap-1.5 rounded-full py-1.5 pl-3.5 text-left text-[13.5px] leading-snug", onRemove ? "pr-1" : "pr-3.5")}>
        {on && <Check size={13} strokeWidth={3} className="shrink-0" />}
        <span className="min-w-0">{children}</span>
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove “${children}”`}
          className={cx("mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors", on ? "text-white/70 hover:bg-white/15 hover:text-white" : "text-faint hover:bg-sunken hover:text-ink")}
        >
          <X size={12} />
        </button>
      )}
    </motion.span>
  );
}

// "+ Your own": a chip that turns into a field; Enter (or leaving it) adds.
function AddOwn({ label, placeholder, onAdd }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const cancelled = useRef(false);
  const close = () => {
    const t = text.trim();
    if (t && !cancelled.current) onAdd(t);
    cancelled.current = false;
    setText("");
    setOpen(false);
  };
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3.5 text-[13.5px] text-mute transition-colors hover:border-ink/50 hover:bg-wash hover:text-ink"
      >
        <Plus size={13} strokeWidth={2.4} /> {label}
      </button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        close();
      }}
      className="inline-flex"
    >
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={close}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            cancelled.current = true;
            e.currentTarget.blur();
          }
        }}
        maxLength={80}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-64 max-w-full rounded-full border border-ink/50 bg-surface px-3.5 text-[13.5px] shadow-glow outline-none placeholder:text-faint"
      />
    </form>
  );
}

function Field({ n, label, hint, children }) {
  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {n && <span className="font-mono text-[11px] text-faint">{n}</span>}
        <span className="text-[14px] font-medium text-ink">{label}</span>
        {hint && <span className="text-xs text-faint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-7 px-5 py-6 sm:px-6" aria-label="Pip is reading your idea">
      <div className="flex items-center gap-2 text-sm text-mute">
        <PipGlyph size={14} pulse /> <span className="shine-text">Reading your idea and working out what to ask</span>
      </div>
      <div className="grid gap-2">
        <div className="skel h-6 w-4/5 rounded-md" />
        <div className="skel h-4 w-1/2 rounded-md" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="grid gap-2.5">
          <div className="skel h-4 w-2/5 rounded-md" />
          <div className="flex flex-wrap gap-2">
            <div className="skel h-9 w-40 rounded-full" />
            <div className="skel h-9 w-32 rounded-full" />
            <div className="skel h-9 w-36 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

const without = (list, x) => list.filter((y) => y !== x);
const withOnce = (list, x) => (list.includes(x) ? list : [...list, x]);

// Pip sharpens a rough idea and asks the questions that matter most. Every
// question takes several answers and the user's own; nothing is required.
export function BriefPanel({ prompt, quality, onClose, onGenerate }) {
  const [d, setD] = useState(() => drafts.get(prompt) || blank());
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const root = useRef(null);
  const set = (patch) => setD((x) => ({ ...x, ...(typeof patch === "function" ? patch(x) : patch) }));

  useEffect(() => remember(prompt, d), [prompt, d]);

  useEffect(() => {
    if (drafts.get(prompt)?.brief) return;
    const controller = new AbortController();
    setError(null);
    askAi("brief", { prompt, quality }, { signal: controller.signal })
      .then(({ result }) => set((x) => ({ brief: result, pitch: x.pitch || result.pitch || "", audience: x.audience || result.audience || "" })))
      .catch((err) => err.name !== "AbortError" && setError(err.message));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, attempt]);

  useEffect(() => {
    const t = setTimeout(() => root.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 380);
    return () => clearTimeout(t);
  }, [!!d.brief]);

  const pick = (qi, option) => set((x) => ({ picks: { ...x.picks, [qi]: (x.picks[qi] || []).includes(option) ? without(x.picks[qi], option) : [...(x.picks[qi] || []), option] } }));
  // An answer that matches one of Pip's options just selects that option.
  const addOwn = (qi, text) =>
    set((x) => {
      const option = (x.brief.questions[qi].options || []).find((o) => o.toLowerCase() === text.toLowerCase());
      return option
        ? { picks: { ...x.picks, [qi]: withOnce(x.picks[qi] || [], option) } }
        : { own: { ...x.own, [qi]: withOnce(x.own[qi] || [], text) }, picks: { ...x.picks, [qi]: withOnce(x.picks[qi] || [], text) } };
    });
  const addOwnName = (text) =>
    set((x) => {
      const n = (x.brief.names || []).find((m) => m.toLowerCase() === text.toLowerCase()) || text.slice(0, 32);
      return { ownNames: (x.brief.names || []).includes(n) ? x.ownNames : withOnce(x.ownNames, n), name: n };
    });
  const removeOwn = (qi, text) => set((x) => ({ own: { ...x.own, [qi]: without(x.own[qi] || [], text) }, picks: { ...x.picks, [qi]: without(x.picks[qi] || [], text) } }));

  const questions = d.brief?.questions || [];
  const made = (d.name ? 1 : 0) + questions.filter((_, i) => d.picks[i]?.length).length + (d.notes.trim() ? 1 : 0);

  return (
    <motion.section
      ref={root}
      initial={{ opacity: 0, y: -8, height: 0 }}
      animate={{ opacity: 1, y: 0, height: "auto" }}
      exit={{ opacity: 0, y: -8, height: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="scroll-mb-6 scroll-mt-24 overflow-hidden"
      aria-label="Sharpen your idea"
    >
      <div className="mt-3 rounded-[24px] border border-line bg-surface text-left shadow-lift">
        <header className="flex items-start justify-between gap-4 border-b border-line-soft px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Wand size={16} />
            </span>
            <div>
              <div className="text-[15px] font-semibold leading-tight">Sharpen the idea</div>
              <p className="mt-0.5 text-[12.5px] leading-snug text-mute">Pick as many answers as fit, or write your own. Pip decides anything you leave open.</p>
            </div>
          </div>
          <IconButton icon={X} label="Close" size={32} iconSize={16} onClick={onClose} />
        </header>

        {error ? (
          <div className="flex flex-col items-start gap-3 px-5 py-6 sm:px-6">
            <p className="text-sm text-danger">{error}</p>
            <Button size="sm" variant="secondary" icon={RotateCcw} onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </Button>
          </div>
        ) : !d.brief ? (
          <Skeleton />
        ) : (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="grid gap-7 px-5 py-6 sm:px-6">
              <div>
                <textarea
                  value={d.pitch}
                  onChange={(e) => set({ pitch: e.target.value })}
                  rows={2}
                  maxLength={200}
                  aria-label="The pitch"
                  className="display -mx-2 block w-[calc(100%+1rem)] resize-none rounded-xl border border-transparent bg-transparent px-2 py-1 text-[21px] leading-snug outline-none transition-colors hover:border-line focus:border-ink/40 focus:bg-wash sm:text-[23px]"
                />
                <label className="-mx-2 mt-1 flex items-center gap-2 rounded-lg border border-transparent px-2 py-1 text-sm text-mute transition-colors focus-within:border-ink/40 focus-within:bg-wash hover:border-line">
                  <Users size={14} className="shrink-0" />
                  <input value={d.audience} onChange={(e) => set({ audience: e.target.value })} maxLength={120} aria-label="Who it's for" className="min-w-0 flex-1 bg-transparent outline-none" />
                </label>
              </div>

              <Field label="Name it" hint="Pick one, or name it yourself">
                <div className="flex flex-wrap gap-2">
                  {(d.brief.names || []).map((n) => (
                    <Chip key={n} on={d.name === n} onClick={() => set((x) => ({ name: x.name === n ? null : n }))}>
                      {n}
                    </Chip>
                  ))}
                  {d.ownNames.map((n) => (
                    <Chip key={"own" + n} on={d.name === n} onClick={() => set((x) => ({ name: x.name === n ? null : n }))} onRemove={() => set((x) => ({ ownNames: without(x.ownNames, n), name: x.name === n ? null : x.name }))}>
                      {n}
                    </Chip>
                  ))}
                  <AddOwn label="Your own name" placeholder="Type a name, then Enter" onAdd={addOwnName} />
                </div>
              </Field>

              {questions.map((q, qi) => (
                <Field key={q.question} n={String(qi + 1).padStart(2, "0")} label={q.question} hint="Pick any that fit">
                  <div className="flex flex-wrap gap-2">
                    {(q.options || []).map((o) => (
                      <Chip key={o} on={(d.picks[qi] || []).includes(o)} onClick={() => pick(qi, o)}>
                        {o}
                      </Chip>
                    ))}
                    {(d.own[qi] || []).map((o) => (
                      <Chip key={"own" + o} on={(d.picks[qi] || []).includes(o)} onClick={() => pick(qi, o)} onRemove={() => removeOwn(qi, o)}>
                        {o}
                      </Chip>
                    ))}
                    <AddOwn label="Your own answer" placeholder="Type an answer, then Enter" onAdd={(t) => addOwn(qi, t)} />
                  </div>
                </Field>
              ))}

              <Field label="Anything else?" hint="Optional">
                <textarea
                  value={d.notes}
                  onChange={(e) => set({ notes: e.target.value })}
                  rows={2}
                  maxLength={400}
                  placeholder="Must-haves, things to avoid, a reference you love…"
                  aria-label="Anything else"
                  className="block w-full resize-none rounded-2xl border border-line bg-wash px-4 py-3 text-sm leading-relaxed outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-ink/40 focus:bg-surface focus:shadow-glow"
                />
              </Field>
            </motion.div>

            <footer className="flex flex-wrap items-center justify-between gap-3 rounded-b-[24px] border-t border-line-soft bg-wash/70 px-5 py-4 sm:px-6">
              <p className="text-[12.5px] text-mute" aria-live="polite">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span key={made} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="inline-block font-medium text-ink">
                    {made ? `${made} decision${made > 1 ? "s" : ""} made` : "Nothing chosen yet"}
                  </motion.span>
                </AnimatePresence>
                <span> · Pip decides the rest</span>
              </p>
              <Button iconRight={ArrowRight} onClick={() => onGenerate(briefFrom(d))}>
                Design it
              </Button>
            </footer>
          </>
        )}
      </div>
    </motion.section>
  );
}
