import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw, X } from "lucide-react";
import { useStore } from "./store";
import { DEVICES } from "./data";
import { EASE, Switch, cx, useBox } from "./ui";
import { Frame, Screen } from "./render";

const TAB_KEYS = ["home", "explore", "insights", "profile"];

const slideVariants = {
  enter: (e) => ({
    x: e === "push" ? "100%" : e === "back" ? "-28%" : 0,
    opacity: e === "tab" ? 0 : 1,
    zIndex: e === "back" ? 0 : 2,
  }),
  center: {
    x: 0,
    opacity: 1,
    zIndex: 1,
  },
  exit: (e) => ({
    x: e === "push" ? "-28%" : e === "back" ? "100%" : 0,
    opacity: e === "tab" ? 0 : 1,
    zIndex: e === "back" ? 2 : 0,
  }),
};

const barButton =
  "rounded-lg px-3 h-9 text-sm font-medium text-white/85 hover:bg-white/10 inline-flex items-center gap-2";

export function Present({ project, startIdx = 0, onClose }) {
  const { s: r } = useStore();
  const [o, i] = useState(r.data.prefs.device || "iphone");
  const s = DEVICES.find((b) => b.k === o) || DEVICES[0];
  const [l, u] = useState(Math.min(startIdx, project.screens.length - 1));
  const [d, c] = useState([]);
  const [f, p] = useState("tab");
  const [h, x] = useState(true);
  const [S, v] = useState(null);
  const [g, m] = useBox();
  const kindIdx = (b) => project.screens.findIndex((M) => M.kind === b);
  const say = (b) =>
    v({
      t: b,
      id: Math.random(),
    });
  useEffect(() => {
    if (!S) {
      return;
    }
    const b = setTimeout(() => v(null), 2000);
    return () => clearTimeout(b);
  }, [S]);
  const navigate = (b) => {
    const [M, ...N] = b.split(":");
    const U = N.join(":");
    if (M === "kind") {
      const $ = kindIdx(U);
      if ($ < 0) {
        say(`This project has no ${U} screen yet`);
        return;
      }
      if ($ === l) {
        return;
      }
      c((re) => [...re, l]);
      p("push");
      u($);
    } else if (M === "tab") {
      const $ = TAB_KEYS[+U];
      const re = kindIdx($);
      if (re < 0) {
        say(`Add a ${$[0].toUpperCase() + $.slice(1)} screen to use this tab`);
        return;
      }
      if (re === l) {
        return;
      }
      c([]);
      p("tab");
      u(re);
    } else if (M === "back") {
      if (d.length) {
        const $ = d[d.length - 1];
        c(d.slice(0, -1));
        p("back");
        u($);
      } else {
        say("Nothing to go back to");
      }
    } else if (M === "toast") {
      say(U);
    }
  };
  const step = (b) => {
    const M = l + b;
    if (!(M < 0) && !(M >= project.screens.length)) {
      p(b > 0 ? "push" : "back");
      c([]);
      u(M);
    }
  };
  const restart = () => {
    c([]);
    p("tab");
    u(0);
  };
  useEffect(() => {
    const k = (M) => {
      if (M.key === "Escape") {
        M.preventDefault();
        onClose();
      } else if (M.key === "ArrowLeft") {
        step(-1);
      } else if (M.key === "ArrowRight") {
        step(1);
      } else if (M.key.toLowerCase() === "h") {
        x((N) => !N);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  const P = Math.max(
    0.2,
    Math.min((m.w - 40) / (s.w + 12), (m.h - 24) / (s.h + 12), 1.15),
  );
  const R = project.screens[l];
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
        duration: 0.2,
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Prototype player"
      className="fixed inset-0 z-50 flex flex-col bg-[#0F0F12] text-white"
    >
      <div className="flex h-14 shrink-0 items-center gap-2 px-3">
        <button
          onClick={onClose}
          aria-label="Exit prototype"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-white hover:bg-white/10"
        >
          <X size={18} />
        </button>
        <div className="min-w-0 flex-1 truncate text-sm">
          <span className="font-semibold">{project.name}</span>
          <span className="text-white/75"> · prototype · {R.title}</span>
        </div>
        <button onClick={restart} className={barButton}>
          <RotateCcw size={15} />
          <span className="hidden sm:inline">Restart</span>
        </button>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-white/85">
          <span className="hidden sm:inline">Show tappable areas</span>
          <Switch on={h} onChange={x} label="Show tappable areas" />
        </label>
        <select
          aria-label="Prototype device"
          value={o}
          onChange={(b) => i(b.target.value)}
          className="h-9 rounded-lg border border-white/15 bg-transparent px-2 text-sm text-white outline-none [&>option]:text-black"
        >
          {DEVICES.map((b) => (
            <option value={b.k} key={b.k}>
              {b.label}
            </option>
          ))}
        </select>
      </div>
      <div ref={g} className="relative min-h-0 flex-1">
        <div className="absolute inset-0 grid place-items-center">
          <Frame w={s.w} h={s.h} scale={P} bezel={6}>
            <div
              style={{
                position: "relative",
                width: s.w,
                height: s.h,
                overflow: "hidden",
              }}
              onClick={(b) => {
                const M = b.target.closest("[data-go]");
                if (M) {
                  navigate(M.getAttribute("data-go"));
                }
              }}
            >
              <AnimatePresence initial={false} custom={f}>
                <motion.div
                  custom={f}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    duration: 0.4,
                    ease: EASE,
                  }}
                  style={{
                    position: "absolute",
                    inset: 0,
                  }}
                  key={R.id + s.k}
                >
                  <Screen
                    screen={R}
                    theme={project.theme}
                    scroll={true}
                    width={s.w}
                    height={s.h}
                    platform={s.plat}
                    className={cx("play", h && "hints")}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </Frame>
        </div>
        <AnimatePresence>
          {S && (
            <motion.div
              initial={{
                y: 14,
                opacity: 0,
              }}
              animate={{
                y: 0,
                opacity: 1,
              }}
              exit={{
                y: 8,
                opacity: 0,
              }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-[#16161A] shadow-lg"
              key={S.id}
            >
              {S.t}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="flex h-12 shrink-0 items-center justify-center gap-4 text-sm text-white/75">
        <div className="flex gap-1.5" role="tablist" aria-label="Screens">
          {project.screens.map((b, M) => (
            <button
              aria-label={b.title}
              aria-selected={M === l}
              role="tab"
              onClick={() => {
                p(M > l ? "push" : "back");
                c([]);
                u(M);
              }}
              className={cx(
                "h-2 rounded-full transition-all",
                M === l ? "w-6 bg-white" : "w-2 bg-white/30 hover:bg-white/60",
              )}
              key={b.id}
            />
          ))}
        </div>
        <span className="hidden sm:inline">
          Tap tabs, cards and buttons · ← → switch screens · H toggles hints
        </span>
      </div>
    </motion.div>
  );
}
