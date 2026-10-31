import { Columns2, History, RotateCcw } from "lucide-react";
import { cx } from "../../ui";
import { Frame } from "../Frame";

const ago = (t) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

function Thumb({ html, project, viewport }) {
  const scale = 96 / viewport.w;
  return (
    <div className="pointer-events-none shrink-0 overflow-hidden rounded-md border border-line" style={{ width: 96, height: Math.min(140, viewport.h * scale) }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0" }}>
        <Frame id={"thumb"} html={html} system={project.system} kit={project.kit} width={viewport.w} height={viewport.h} />
      </div>
    </div>
  );
}

export function HistoryPanel({ project, screen, viewport, onRestore, onCompare }) {
  if (!screen) {
    return <div className="p-6 text-center text-sm text-mute">Select a screen to see its history.</div>;
  }
  const versions = screen.versions || [];
  return (
    <div className="sb h-full overflow-y-auto p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <History size={15} /> {screen.name}
      </div>
      <div className="flex items-center gap-3 rounded-xl border-2 border-ink p-2.5">
        {screen.html && <Thumb html={screen.html} project={project} viewport={viewport} />}
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider text-accent">Current</div>
          <div className="mt-0.5 text-sm font-medium">{screen.changeLabel || "First draft"}</div>
          <div className="text-xs text-mute">{screen.changedAt ? ago(screen.changedAt) : ""}</div>
        </div>
      </div>
      {versions.length === 0 ? (
        <p className="mt-4 text-sm text-mute">Every change you or Pip make is saved here, so you can always go back.</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {versions.map((v, i) => (
            <li key={v.id} className={cx("flex items-center gap-3 rounded-xl border border-line p-2.5")}>
              {i < 6 ? <Thumb html={v.html} project={project} viewport={viewport} /> : null}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{v.label}</div>
                <div className="text-xs text-mute">{ago(v.at)}</div>
                <div className="mt-2 flex gap-1.5">
                  <button onClick={() => onRestore(v)} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-semibold hover:border-ink">
                    <RotateCcw size={11} /> Restore
                  </button>
                  <button onClick={() => onCompare(v)} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-semibold hover:border-ink">
                    <Columns2 size={11} /> Compare
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
