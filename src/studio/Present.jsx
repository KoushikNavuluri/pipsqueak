import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Eye, EyeOff, Sparkles, X } from "lucide-react";
import { Frame } from "./Frame";
import { VIEWPORTS } from "../design/engine.js";
import { cx } from "../ui";

// Full-screen clickable prototype. Taps on data-nav elements move between
// screens; taps on unlinked buttons offer to design the screen they'd open.
export function Present({ project, startId, onClose, onDesignNext }) {
  const screens = project.screens.filter((s) => s.html);
  const [current, setCurrent] = useState(startId && screens.some((s) => s.id === startId) ? startId : screens[0]?.id);
  const [stack, setStack] = useState([]);
  const [dir, setDir] = useState(1);
  const [hints, setHints] = useState(false);
  const [unlinked, setUnlinked] = useState(null);
  const frame = useRef(null);
  const platform = project.spec?.platform || "mobile";
  const [device, setDevice] = useState(platform === "mobile" ? "mobile" : "desktop");
  const vp = VIEWPORTS[device];
  const [box, setBox] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setBox({ w: window.innerWidth, h: window.innerHeight });
    addEventListener("resize", on);
    return () => removeEventListener("resize", on);
  }, []);
  const chrome = device === "mobile" ? 47 + 24 : 0;
  const scale = Math.min(1, (box.h - 150) / (vp.h + chrome), (box.w - 80) / (vp.w + 24));
  const screen = screens.find((s) => s.id === current);
  const index = screens.findIndex((s) => s.id === current);

  const go = (id, back = false) => {
    if (!id || id === current || !screens.some((s) => s.id === id)) {
      return false;
    }
    setDir(back ? -1 : 1);
    setStack((st) => (back ? st.slice(0, -1) : [...st, current]));
    setCurrent(id);
    setUnlinked(null);
    return true;
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(screens[Math.min(screens.length - 1, index + 1)]?.id);
      else if (e.key === "ArrowLeft") go(screens[Math.max(0, index - 1)]?.id, true);
      else if (e.key.toLowerCase() === "h") setHints((h) => !h);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    frame.current?.post({ type: "hints", on: hints });
  }, [hints, current]);

  const onMessage = (m) => {
    if (m.type === "ready") {
      frame.current?.post({ type: "hints", on: hints });
    } else if (m.type === "navigate") {
      if (!go(m.to)) {
        setUnlinked({ text: m.to, missing: true });
      }
    } else if (m.type === "tap") {
      setUnlinked({ text: m.text });
    } else if (m.type === "key" && m.key === "Escape") {
      onClose();
    }
  };

  const mobile = device === "mobile";
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] flex flex-col bg-night text-white" role="dialog" aria-label="Prototype">
      <div className="flex h-14 shrink-0 items-center gap-3 px-4">
        <button onClick={onClose} aria-label="Close prototype" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10">
          <X size={18} />
        </button>
        <div className="min-w-0 text-sm">
          <span className="font-semibold">{project.name}</span>
          <span className="text-white/50"> · {screen?.name}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {stack.length > 0 && (
            <button onClick={() => go(stack[stack.length - 1], true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm hover:bg-white/10">
              <ArrowLeft size={15} /> Back
            </button>
          )}
          <button onClick={() => setHints((h) => !h)} className={cx("inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm", hints ? "bg-white text-night" : "hover:bg-white/10")}>
            {hints ? <EyeOff size={15} /> : <Eye size={15} />} Hotspots
          </button>
          {platform !== "mobile" && (
            <div className="flex rounded-lg bg-white/10 p-0.5">
              {["desktop", "tablet", "mobile"].map((d) => (
                <button key={d} onClick={() => setDevice(d)} className={cx("rounded-md px-3 py-1.5 text-xs font-semibold capitalize", device === d ? "bg-white text-night" : "text-white/70")}>
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <div style={{ width: (vp.w + (mobile ? 24 : 0)) * scale, height: (vp.h + chrome) * scale }}>
          <div
            style={{ width: vp.w + (mobile ? 24 : 0), height: vp.h + chrome, transform: `scale(${scale})`, transformOrigin: "0 0" }}
            className={cx("relative overflow-hidden bg-black shadow-[0_40px_120px_-30px_rgba(0,0,0,.8)]", mobile ? "rounded-[56px] p-3" : "rounded-xl")}
          >
            <div className={cx("relative h-full w-full overflow-hidden", mobile && "rounded-[44px]")} style={{ background: project.system.colors.bg }}>
              {mobile && (
                <div className="flex h-[47px] items-end justify-between px-7 pb-2" style={{ color: project.system.colors.ink, font: "600 15px/1 system-ui" }}>
                  <span>9:41</span>
                  <span className="h-3 w-6 rounded-sm border" style={{ borderColor: project.system.colors.ink }} />
                </div>
              )}
              <AnimatePresence initial={false} custom={dir} mode="popLayout">
                <motion.div
                  key={current}
                  custom={dir}
                  initial={{ x: dir > 0 ? "100%" : "-30%", opacity: dir > 0 ? 1 : 0.6 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: dir > 0 ? "-30%" : "100%", opacity: dir > 0 ? 0.6 : 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 40 }}
                  className="absolute inset-x-0 bottom-0"
                  style={{ top: mobile ? 47 : 0 }}
                >
                  {screen && <Frame ref={frame} id={"play-" + screen.id} html={screen.html} system={project.system} kit={project.kit} mode="play" width={vp.w} height={vp.h} onMessage={onMessage} />}
                </motion.div>
              </AnimatePresence>
              {mobile && <div className="pointer-events-none absolute bottom-2 left-1/2 z-10 h-[5px] w-[134px] -translate-x-1/2 rounded-full" style={{ background: project.system.colors.ink, opacity: 0.4 }} />}
            </div>
          </div>
        </div>
        <AnimatePresence>
          {unlinked && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-ink shadow-xl">
              <span>
                {unlinked.missing ? "That screen doesn't exist yet." : <>“{unlinked.text || "That"}” isn't linked to a screen.</>}
              </span>
              <button
                onClick={() => {
                  onDesignNext(current, unlinked.text);
                  setUnlinked(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white"
              >
                <Sparkles size={13} /> Design what it opens
              </button>
              <button onClick={() => setUnlinked(null)} aria-label="Dismiss" className="text-mute">
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="flex h-14 shrink-0 items-center justify-center gap-2 text-xs text-white/55">
        {screens.map((s) => (
          <button key={s.id} onClick={() => go(s.id, screens.findIndex((x) => x.id === s.id) < index)} aria-label={s.name} className={cx("h-1.5 rounded-full transition-all", s.id === current ? "w-6 bg-white" : "w-1.5 bg-white/30 hover:bg-white/60")} />
        ))}
        <span className="ml-3">Tap to navigate · ← → · H for hotspots</span>
      </div>
    </motion.div>
  );
}
