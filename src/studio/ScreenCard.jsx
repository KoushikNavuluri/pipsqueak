import { forwardRef, memo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Copy, History, LoaderCircle, Play, RotateCcw, Shuffle, Trash2 } from "lucide-react";
import { cx } from "../ui";
import { Frame } from "./Frame";

function StatusBar({ system }) {
  const ink = system.colors.ink;
  return (
    <div className="flex h-[47px] items-end justify-between px-7 pb-2" style={{ background: system.colors.bg, color: ink }}>
      <span style={{ font: "600 15px/1 -apple-system, system-ui, sans-serif" }}>9:41</span>
      <span className="flex items-center gap-1.5">
        <svg width="18" height="11" viewBox="0 0 18 11" fill={ink} aria-hidden="true">
          <rect x="0" y="7" width="3" height="4" rx="1" />
          <rect x="5" y="5" width="3" height="6" rx="1" />
          <rect x="10" y="2.5" width="3" height="8.5" rx="1" />
          <rect x="15" y="0" width="3" height="11" rx="1" />
        </svg>
        <svg width="16" height="11" viewBox="0 0 16 11" fill="none" stroke={ink} strokeWidth="1.6" aria-hidden="true">
          <path d="M1 4a10 10 0 0 1 14 0M3.5 6.5a6.5 6.5 0 0 1 9 0M6 9a3 3 0 0 1 4 0" strokeLinecap="round" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12" fill="none" aria-hidden="true">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.5" stroke={ink} strokeOpacity=".4" />
          <rect x="2" y="2" width="17" height="8" rx="2" fill={ink} />
          <path d="M24 4v4" stroke={ink} strokeOpacity=".4" strokeLinecap="round" />
        </svg>
      </span>
    </div>
  );
}

function BrowserBar({ name, screenId, system }) {
  return (
    <div className="flex h-10 items-center gap-3 border-b px-4" style={{ background: system.colors.surface2, borderColor: system.colors.line }}>
      <span className="flex gap-1.5">
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <span key={c} className="h-3 w-3 rounded-full" style={{ background: c }} />
        ))}
      </span>
      <span className="mx-auto truncate rounded-md px-12 py-1 text-xs" style={{ background: system.colors.surface, color: system.colors.muted }}>
        {name.toLowerCase().replace(/\s+/g, "")}.app/{screenId}
      </span>
    </div>
  );
}

const ACTIONS = [
  ["play", Play, "Play from here"],
  ["variations", Shuffle, "Variations"],
  ["regenerate", RotateCcw, "Regenerate"],
  ["history", History, "History"],
  ["duplicate", Copy, "Duplicate"],
  ["delete", Trash2, "Delete"],
];

// Memoized: the studio re-renders often (zoom readout, heights, panels), and
// a card only needs to when its own props change.
export const ScreenCard = memo(forwardRef(function ScreenCard(
  { project, screen, viewport, height, zoom, selected, mode, streaming, busy, issues, deferred, onSelect, onMessage, onAction, onRename },
  ref,
) {
  const { system, kit = [] } = project;
  const mobile = viewport.w < 600;
  const pending = screen.status === "pending" || screen.status === "error";
  const inverse = 1 / zoom;
  return (
    <div className="absolute" style={{ left: screen._x, top: screen._y, width: viewport.w }}>
      {/* Label: constant on-screen size regardless of zoom. */}
      <div
        className="group/label absolute bottom-full left-0 flex items-center gap-2 pb-2"
        style={{ transform: `scale(${inverse})`, transformOrigin: "bottom left", width: viewport.w * zoom }}
      >
        <button
          onClick={() => onSelect(screen.id)}
          onDoubleClick={() => onRename(screen.id)}
          className={cx("min-w-0 truncate text-[13px] font-semibold", selected ? "text-accent" : "text-ink-2")}
        >
          {screen.name}
        </button>
        {busy && (
          <span className="inline-flex shrink-0 items-center gap-1 text-[12px] text-mute">
            <LoaderCircle size={12} className="animate-spin" />
            {busy}
          </span>
        )}
        {!busy && issues > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warn-soft px-1.5 text-[11px] font-semibold text-warn" title="Automated checks found issues">
            <AlertTriangle size={11} /> {issues}
          </span>
        )}
        {!pending && !busy && (
          <span
            className={cx(
              "absolute bottom-1.5 right-0 flex gap-0.5 rounded-lg bg-canvas/95 pl-1 transition-opacity group-hover/label:pointer-events-auto group-hover/label:opacity-100",
              selected ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            {ACTIONS.map(([key, Icon, label]) => (
              <button
                key={key}
                onClick={() => onAction(key, screen.id)}
                aria-label={label}
                title={label}
                className="flex h-6 w-6 items-center justify-center rounded-md text-mute hover:bg-white hover:text-ink"
              >
                <Icon size={13} />
              </button>
            ))}
          </span>
        )}
      </div>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        onPointerDown={() => onSelect(screen.id)}
        className={cx(
          "relative overflow-hidden bg-white transition-shadow duration-200",
          mobile ? "rounded-[44px]" : "rounded-xl",
          selected ? "shadow-[0_0_0_3px_#FF4D1A,0_30px_80px_-30px_rgba(20,20,26,.45)]" : "shadow-[0_0_0_1px_rgba(20,20,26,.08),0_30px_80px_-30px_rgba(20,20,26,.35)]",
        )}
      >
        {mobile ? <StatusBar system={system} /> : <BrowserBar name={project.name} screenId={screen.id} system={system} />}
        <div className="relative" style={{ height: height || viewport.h }}>
          {(screen.html || streaming) && !deferred ? (
            <Frame
              ref={ref}
              id={screen.id}
              html={screen.html || ""}
              system={system}
              kit={kit}
              mode={mode}
              width={viewport.w}
              height={height || viewport.h}
              viewportHeight={viewport.h}
              canvas={true}
              streaming={streaming ?? null}
              onMessage={onMessage}
              title={screen.name}
            />
          ) : (
            <div className="skel h-full w-full" />
          )}
          {busy && (
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 overflow-hidden">
              <div className="h-full w-1/3 bg-accent" style={{ animation: "pqbar 1.3s ease-in-out infinite" }} />
            </div>
          )}
          {screen.status === "error" && !busy && (
            <div className="absolute inset-0 grid place-items-center bg-white/80 p-6 text-center backdrop-blur-sm">
              <div>
                <div className="text-sm font-semibold text-ink">This screen didn't come together</div>
                <button onClick={() => onAction("regenerate", screen.id)} className="mt-3 rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white">
                  Try again
                </button>
              </div>
            </div>
          )}
        </div>
        {mobile && <div className="pointer-events-none absolute bottom-2 left-1/2 h-[5px] w-[134px] -translate-x-1/2 rounded-full" style={{ background: system.colors.ink, opacity: 0.35 }} />}
      </motion.div>
    </div>
  );
}));
