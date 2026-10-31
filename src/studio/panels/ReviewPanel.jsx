import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, Check, LoaderCircle, RotateCcw, ScanLine, ThumbsUp, Wand } from "lucide-react";
import { Button, EASE, cx } from "../../ui";

const SEVERITY = {
  high: "bg-danger-soft text-danger",
  medium: "bg-warn-soft text-warn",
  low: "bg-sunken text-ink-2",
};

function Ring({ value }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const color = value >= 80 ? "#12B76A" : value >= 65 ? "#F79009" : "#F04438";
  return (
    <div className="relative h-[72px] w-[72px] shrink-0">
      <svg viewBox="0 0 72 72" className="h-[72px] w-[72px] -rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#EFEEE9" strokeWidth="6" />
        <motion.circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value / 100) }} transition={{ duration: 1, ease: EASE }} />
      </svg>
      <div className="display absolute inset-0 grid place-items-center text-xl font-semibold">{value}</div>
    </div>
  );
}

export function ReviewPanel({ project, onRun, onFix, onFixAutomated, onGo }) {
  const [running, setRunning] = useState(false);
  const [fixing, setFixing] = useState(null);
  const review = project.review;
  const name = (id) => project.screens.find((s) => s.id === id)?.name;

  const run = async () => {
    setRunning(true);
    try {
      await onRun();
    } finally {
      setRunning(false);
    }
  };
  const fix = async (key, fn) => {
    setFixing(key);
    try {
      await fn();
    } finally {
      setFixing(null);
    }
  };

  if (!review) {
    return (
      <div className="p-4">
        <div className="rounded-2xl border border-line bg-gradient-to-br from-accent-soft to-white p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-white">
              <ScanLine size={14} />
            </span>
            Design review
          </div>
          <p className="mt-2 text-sm leading-relaxed text-mute">
            Pipsqueak renders every screen and checks contrast, overflow, tap targets and off-system styling, then Pip critiques craft, hierarchy, consistency, originality and copy. Every issue comes with a fix.
          </p>
          <Button className="mt-3" full={true} icon={running ? undefined : ScanLine} onClick={run} disabled={running}>
            {running ? "Reviewing every screen…" : "Review this design"}
          </Button>
        </div>
      </div>
    );
  }

  const automated = Object.entries(review.audits || {}).filter(([, list]) => list.length);

  return (
    <div className="sb h-full overflow-y-auto p-4">
      <div className="rounded-2xl border border-line bg-white p-4">
        <div className="flex items-center gap-4">
          <Ring value={Math.max(0, Math.min(100, review.overall | 0))} />
          <p className="text-sm font-medium leading-snug">{review.headline}</p>
        </div>
        <div className="mt-4 grid gap-2.5">
          {(review.scores || []).map((sc) => (
            <div key={sc.dimension}>
              <div className="flex justify-between text-xs">
                <span className="font-semibold">{sc.dimension}</span>
                <span className="tabular-nums text-mute">{sc.score}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line-soft">
                <motion.div className="h-full rounded-full bg-ink" initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, sc.score))}%` }} transition={{ duration: 0.8, ease: EASE }} />
              </div>
              <p className="mt-1 text-xs text-mute">{sc.note}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-line-soft pt-3">
          <span className="text-xs text-faint">Reviewed {new Date(review.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
          <Button size="sm" variant="secondary" icon={running ? undefined : RotateCcw} onClick={run} disabled={running}>
            {running ? "Reviewing…" : "Re-run"}
          </Button>
        </div>
      </div>

      {review.strengths?.length > 0 && (
        <div className="mt-3 rounded-2xl border border-line bg-white p-4">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-mute">
            <ThumbsUp size={12} /> Working well
          </div>
          <ul className="grid gap-1.5 text-sm">
            {review.strengths.map((s) => (
              <li key={s} className="flex items-start gap-2">
                <Check size={14} strokeWidth={3} className="mt-0.5 shrink-0 text-success" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(review.issues || []).map((issue, i) => {
        const done = (review.fixed || []).includes(i);
        return (
          <div key={i} className={cx("mt-3 rounded-2xl border bg-white p-4", done ? "border-[#ABEFC6]" : "border-line")}>
            <div className="flex items-center gap-2">
              <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", SEVERITY[issue.severity] || SEVERITY.low)}>{issue.severity}</span>
              {name(issue.screenId) && (
                <button onClick={() => onGo(issue.screenId)} className="inline-flex items-center gap-0.5 text-xs font-medium text-mute hover:text-ink">
                  {name(issue.screenId)} <ArrowRight size={11} />
                </button>
              )}
            </div>
            <div className="mt-2 text-sm font-semibold">{issue.title}</div>
            <p className="mt-1 text-sm leading-relaxed text-mute">{issue.detail}</p>
            <div className="mt-3">
              {done ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-success-deep">
                  <Check size={13} strokeWidth={3} /> Fixed
                </span>
              ) : (
                <Button size="sm" variant="secondary" icon={fixing === i ? undefined : Wand} disabled={fixing !== null || !name(issue.screenId)} onClick={() => fix(i, () => onFix(issue, i))}>
                  {fixing === i ? "Fixing…" : "Fix it"}
                </Button>
              )}
            </div>
          </div>
        );
      })}

      {automated.length > 0 && (
        <div className="mt-3 rounded-2xl border border-line bg-white p-4">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-mute">
            <AlertTriangle size={12} /> Automated checks
          </div>
          {automated.map(([id, list]) => (
            <div key={id} className="border-t border-line-soft py-2.5 first:border-0 first:pt-0">
              <div className="flex items-center justify-between">
                <button onClick={() => onGo(id)} className="text-sm font-semibold hover:underline">
                  {name(id) || id}
                </button>
                <button
                  disabled={fixing !== null}
                  onClick={() => fix("auto-" + id, () => onFixAutomated(id, list))}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-ink-2 hover:text-ink disabled:opacity-40"
                >
                  {fixing === "auto-" + id ? <LoaderCircle size={12} className="animate-spin" /> : <Wand size={12} />} Fix {list.length}
                </button>
              </div>
              <ul className="mt-1 grid gap-0.5 text-xs text-mute">
                {list.slice(0, 5).map((it, j) => (
                  <li key={j} className="truncate">
                    {it.message}
                    {it.text ? ` — “${it.text}”` : ""}
                  </li>
                ))}
                {list.length > 5 && <li>and {list.length - 5} more</li>}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
