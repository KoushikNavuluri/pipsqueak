import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import { SKILLS, skillById } from "../design/skills.js";
import { SPECIMEN_FONTS, specimen } from "../design/specimen.js";
import { buildFrameDoc } from "../design/frameDoc.js";
import { VIEWPORTS } from "../design/engine.js";
import { cachedCss, loadCss, saveCss } from "../design/cssCache.js";
import { Popover, cx } from "../ui";

// A compact picker for the prompt bar: "Any direction" lets the engine pick three.
export function DirectionPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef(null);
  const skill = value && value !== "auto" ? skillById(value) : null;
  const [bg, ink, accent] = skill ? specimen(skill.id) : [];
  return (
    <>
      {open && SPECIMEN_FONTS && <link rel="stylesheet" href={SPECIMEN_FONTS} />}
      <button
        ref={anchor}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface pl-1.5 pr-3 text-[13px] font-medium transition-colors hover:border-line-strong hover:bg-wash"
      >
        {skill ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: bg, color: ink, fontFamily: `"${skill.defaults.fonts.display}"`, boxShadow: `inset 0 0 0 1px ${ink}22, inset -6px -6px 0 -3px ${accent}` }}>
            Aa
          </span>
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft">
            <Sparkles size={13} className="text-accent" />
          </span>
        )}
        {skill ? skill.name : "Any direction"}
        <ChevronDown size={14} className={cx("text-mute transition-transform duration-200", open && "rotate-180")} />
      </button>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} role="listbox" label="Direction" className="w-[312px]">
        {[null, ...SKILLS].map((s) => {
          const active = s ? value === s.id : !skill;
          const [b, i, a] = s ? specimen(s.id) : [];
          return (
            <button
              key={s?.id || "auto"}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => {
                onChange(s ? s.id : "auto");
                setOpen(false);
              }}
              className={cx("flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-wash", active && "bg-sunken")}
            >
              {s ? (
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg text-[14px]" style={{ background: b, color: i, fontFamily: `"${s.defaults.fonts.display}"`, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08)" }}>
                  Aa
                  <span className="absolute bottom-0 right-0 h-2 w-2" style={{ background: a }} />
                </span>
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: "conic-gradient(from 200deg, #FF4D1A, #FFB08F, #C4B2FF, #FF4D1A)" }}>
                  <Sparkles size={14} strokeWidth={2.2} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{s ? s.name : "Any direction"}</span>
                <span className="block truncate text-xs text-mute">{s ? s.tagline : "Three directions chosen for your idea"}</span>
              </span>
              {active && <Check size={14} strokeWidth={3} />}
            </button>
          );
        })}
      </Popover>
    </>
  );
}

// Thumbnails mount one at a time, yielding to the main thread in between, so
// a page of them never freezes the dashboard. Those without cached CSS
// compile during their turn.
const waiting = [];
let busy = 0;
function pump() {
  while (busy < 1 && waiting.length) {
    busy++;
    waiting.shift()();
  }
}
function takeTurn(start) {
  waiting.push(start);
  pump();
  return () => {
    const i = waiting.indexOf(start);
    if (i >= 0) waiting.splice(i, 1);
  };
}
function endTurn() {
  busy = Math.max(0, busy - 1);
  setTimeout(pump, 16);
}

function useVisible(margin = "1000px") {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen || !ref.current) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { rootMargin: margin });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [seen, margin]);
  return [ref, seen];
}

function Thumb({ screen, project, vp, scale, height, mobile }) {
  const [box, visible] = useVisible();
  const frame = useRef(null);
  const [css, setCss] = useState(null);
  const [turn, setTurn] = useState(null);
  const [shown, setShown] = useState(false);
  const release = useRef(null);

  // Near the viewport: check the persistent cache, then queue for a turn.
  useEffect(() => {
    if (!visible) return;
    let live = true;
    loadCss([screen.html]).then(() => {
      if (!live) return;
      setCss(cachedCss(screen.html));
      setTurn("waiting");
    });
    return () => {
      live = false;
    };
  }, [visible, screen.html]);

  // During its turn the frame renders (and compiles, on a cache miss). The turn
  // ends when it has loaded, or once its compiled CSS has been kept.
  useEffect(() => {
    if (turn === null) return;
    let started = false;
    let done = false;
    const finish = () => {
      if (started && !done) {
        done = true;
        endTurn();
      }
    };
    release.current = finish;
    const cancel = takeTurn(() => {
      started = true;
      setTurn("go");
    });
    const onMsg = (e) => {
      if (e.source && e.source === frame.current?.contentWindow && e.data?.__pq && e.data.type === "css") {
        saveCss(screen.html, e.data.css);
        finish();
      }
    };
    window.addEventListener("message", onMsg);
    // A cached frame only has to lay out; don't let slow images hold the queue.
    const timeout = setTimeout(finish, cachedCss(screen.html) ? 1200 : 9000);
    return () => {
      cancel();
      window.removeEventListener("message", onMsg);
      clearTimeout(timeout);
      finish();
    };
  }, [turn === null, screen.html]);

  const doc = useMemo(() => {
    if (turn !== "go") return null;
    return buildFrameDoc({ html: screen.html, system: project.system, kit: project.kit, mode: css ? "export" : "thumb", width: vp.w, css, light: true });
  }, [turn === "go", css, screen.html, project.system, project.kit, vp.w]);

  return (
    <div
      ref={box}
      className={cx("relative shrink-0 overflow-hidden shadow-[0_14px_32px_-12px_rgba(0,0,0,.3)] ring-1 ring-black/5", mobile ? "rounded-[16px]" : "rounded-lg")}
      style={{ width: vp.w * scale, height, background: project.system?.colors?.bg || "#fff" }}
    >
      {doc && (
        <iframe
          ref={frame}
          title={screen.name}
          srcDoc={doc}
          sandbox={css ? "" : "allow-scripts"}
          tabIndex={-1}
          aria-hidden="true"
          onLoad={() => {
            setShown(true);
            if (css) release.current?.();
          }}
          className="transition-opacity duration-500"
          style={{ width: vp.w, height: vp.h, transform: `scale(${scale})`, transformOrigin: "0 0", border: 0, pointerEvents: "none", opacity: shown ? 1 : 0 }}
        />
      )}
      {!shown && <div className="skel absolute inset-0 opacity-50" />}
    </div>
  );
}

// Scaled previews of a design's screens, for the dashboard.
export function CanvasThumbs({ project, height = 156, limit }) {
  const mobile = project.spec?.platform === "mobile";
  const vp = mobile ? VIEWPORTS.mobile : VIEWPORTS.desktop;
  const screens = project.screens.filter((s) => s.html).slice(0, limit || (mobile ? 3 : 1));
  const scale = height / vp.h;
  if (!screens.length) {
    return (
      <div className="flex items-center justify-center text-xs text-mute" style={{ height: height * 0.6 }}>
        Still designing…
      </div>
    );
  }
  return (
    <div className="flex gap-3" style={{ height }}>
      {screens.map((s) => (
        <Thumb key={s.id} screen={s} project={project} vp={vp} scale={scale} height={height} mobile={mobile} />
      ))}
    </div>
  );
}
