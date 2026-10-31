import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Check, LoaderCircle } from "lucide-react";
import { cx } from "../../ui";
import { PipGlyph } from "../../brand";

const STARTERS = [
  "Make the whole app feel more premium",
  "Switch to a dark theme",
  "Add an empty state for first-time users",
  "Translate everything to Hindi",
  "Add a settings screen",
];

export function ChatPanel({ project, onSend, busy }) {
  const end = useRef(null);
  const chat = project.chat || [];
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [chat.length, chat[chat.length - 1]?.ops?.length, chat[chat.length - 1]?.status]);
  const last = [...chat].reverse().find((m) => m.role === "ai");

  return (
    <div className="sb flex h-full flex-col overflow-y-auto p-4">
      {chat.length === 0 && (
        <div className="rounded-2xl border border-line bg-gradient-to-br from-accent-soft to-white p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink">
              <PipGlyph size={14} />
            </span>
            Pip, your design partner
          </div>
          <p className="mt-2 text-sm leading-relaxed text-mute">
            Ask for anything: restyle the system, rework screens, add or remove screens. Pip plans the change, then carries it out across the app. Select an element first to aim at it.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {STARTERS.map((s) => (
              <button key={s} onClick={() => onSend(s)} disabled={busy} className="rounded-full border border-line bg-white px-3 py-1.5 text-[13px] hover:border-ink disabled:opacity-40">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
        {chat.map((m) => (
          <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cx("max-w-[94%]", m.role === "user" ? "justify-self-end" : "justify-self-start")}>
            {m.role === "user" ? (
              <div className="rounded-2xl rounded-br-md bg-ink px-3.5 py-2.5 text-sm leading-relaxed text-white">
                {m.text}
                {m.focus && <div className="mt-1 text-[11px] text-white/55">On {m.focus}</div>}
              </div>
            ) : (
              <div className={cx("rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm leading-relaxed", m.status === "error" ? "border border-danger-line bg-danger-soft text-danger" : "bg-sunken")}>
                {m.status === "thinking" ? (
                  <span className="inline-flex items-center gap-2 text-mute">
                    <LoaderCircle size={14} className="animate-spin" /> Planning the change…
                  </span>
                ) : (
                  <>
                    {m.status === "error" && <AlertCircle size={14} className="mb-1" />}
                    {m.text}
                  </>
                )}
                {m.ops?.length > 0 && (
                  <ul className="mt-2 grid gap-1.5 border-t border-line pt-2 text-[13px]">
                    {m.ops.map((o, i) => (
                      <li key={i} className="flex items-center gap-2">
                        {o.done ? <Check size={13} strokeWidth={3} className="text-success" /> : <LoaderCircle size={13} className="animate-spin text-accent" />}
                        <span className={o.done ? "text-ink-2" : "text-ink"}>{o.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </motion.div>
        ))}
      </div>
      {last?.suggestions?.length > 0 && !busy && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {last.suggestions.map((s) => (
            <button key={s} onClick={() => onSend(s)} className="rounded-full border border-line bg-white px-3 py-1.5 text-[13px] hover:border-ink">
              {s}
            </button>
          ))}
        </div>
      )}
      <div ref={end} className="h-4 shrink-0" />
    </div>
  );
}
