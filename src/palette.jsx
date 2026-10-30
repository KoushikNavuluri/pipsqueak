import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Search as SearchIcon } from "lucide-react";
import { EASE, Kbd, cx } from "./ui";

export function CommandPalette({
  actions,
  onClose,
  placeholder = "Type a command or search…",
}) {
  const [r, o] = useState("");
  const [i, s] = useState(0);
  const l = useRef(null);
  const u = useMemo(() => {
    const f = r.trim().toLowerCase();
    if (!f) {
      return actions;
    }
    const p = f.split(/\s+/);
    return actions.filter((h) => {
      const x = (
        h.label +
        " " +
        (h.group || "") +
        " " +
        (h.keywords || "")
      ).toLowerCase();
      return p.every((S) => x.includes(S));
    });
  }, [r, actions]);
  useEffect(() => s(0), [r]);
  useEffect(() => {
    l.current?.querySelector('[data-active="true"]')?.scrollIntoView({
      block: "nearest",
    });
  }, [i, u]);
  const run = (f) => {
    onClose();
    setTimeout(f.run, 0);
  };
  const onKey = (f) => {
    if (f.key === "ArrowDown") {
      f.preventDefault();
      s((p) => Math.min(u.length - 1, p + 1));
    } else if (f.key === "ArrowUp") {
      f.preventDefault();
      s((p) => Math.max(0, p - 1));
    } else if (f.key === "Enter") {
      f.preventDefault();
      if (u[i]) {
        run(u[i]);
      }
    } else if (f.key === "Escape") {
      f.preventDefault();
      onClose();
    }
  };
  return (
    <motion.div
      initial={{
        opacity: 0,
      }}
      animate={{
        opacity: 1,
      }}
      exit={{
        opacity: 0,
      }}
      transition={{
        duration: 0.12,
      }}
      onClick={onClose}
      className="fixed inset-0 z-[55] flex items-start justify-center bg-[#16161A]/40 px-4 pt-[12vh]"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(f) => f.stopPropagation()}
        initial={{
          y: -12,
          opacity: 0,
          scale: 0.98,
        }}
        animate={{
          y: 0,
          opacity: 1,
          scale: 1,
        }}
        exit={{
          y: -8,
          opacity: 0,
        }}
        transition={{
          duration: 0.2,
          ease: EASE,
        }}
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-[0_24px_64px_-12px_rgba(20,20,26,.4)]"
      >
        <div className="flex items-center gap-3 border-b border-[#E6E5E0] px-4">
          <SearchIcon size={18} className="shrink-0 text-[#62626A]" />
          <input
            autoFocus={true}
            aria-label="Search commands"
            value={r}
            onChange={(f) => o(f.target.value)}
            onKeyDown={onKey}
            placeholder={placeholder}
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-[#9A9AA2]"
          />
          <Kbd>Esc</Kbd>
        </div>
        <div
          ref={l}
          role="listbox"
          className="sb max-h-[50vh] overflow-y-auto p-2"
        >
          {u.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-[#62626A]">
              No matches for “{r}”
            </div>
          )}
          {u.map((f, p) => {
            const h = f.group && (p === 0 || u[p - 1].group !== f.group);
            return (
              <div key={f.id}>
                {h && (
                  <div className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-[#62626A]">
                    {f.group}
                  </div>
                )}
                <button
                  role="option"
                  aria-selected={p === i}
                  data-active={p === i}
                  onMouseMove={() => s(p)}
                  onClick={() => run(f)}
                  className={cx(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium",
                    p === i ? "bg-[#F2F1ED]" : "",
                  )}
                >
                  {f.icon && (
                    <f.icon
                      size={16}
                      strokeWidth={2}
                      className="shrink-0 text-[#62626A]"
                    />
                  )}
                  <span className="flex-1 truncate">{f.label}</span>
                  {f.hint && (
                    <span className="shrink-0 text-xs text-[#62626A]">
                      {f.hint}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
