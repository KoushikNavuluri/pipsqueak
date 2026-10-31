import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, LoaderCircle, RotateCcw, Shuffle, X } from "lucide-react";
import { Button, Segmented, cx } from "../ui";
import { Frame } from "./Frame";
import { writeScreen } from "../design/engine.js";
import { specOf, styleReference } from "./useStudio";

const RANGES = {
  refine: "Keep the composition and structure. Improve craft: spacing rhythm, hierarchy, typographic detail and copy.",
  explore: "Keep the screen's job and content. Try a noticeably different composition and focal point within the same design system.",
  reimagine: "Keep only the screen's job. Reimagine it boldly, with a different composition pattern and a fresh signature move, still in the same design system.",
};
const ASPECTS = [
  ["layout", "Layout"],
  ["copy", "Copy"],
  ["imagery", "Imagery"],
  ["emphasis", "Emphasis"],
];
const FLAVORS = ["Lead with the most important number or object.", "Lead with imagery and a strong editorial moment.", "Lead with the main action, as compact and fast as possible."];

function instructionFor(range, aspects, i) {
  const locked = ASPECTS.filter(([k]) => !aspects.includes(k)).map(([, l]) => l.toLowerCase());
  return [
    `VARIATION ${i + 1} of 3. ${RANGES[range]}`,
    range !== "refine" ? FLAVORS[i] : "",
    locked.length ? `Do not change: ${locked.join(", ")}.` : "",
    "Make it clearly different from the other variations.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function Variations({ project, screenId, viewport, quality, onPick, onClose }) {
  const screen = project.screens.find((s) => s.id === screenId);
  const [range, setRange] = useState("explore");
  const [aspects, setAspects] = useState(["layout", "copy", "emphasis"]);
  const [results, setResults] = useState(null);
  const ctrls = useRef([]);

  useEffect(() => () => ctrls.current.forEach((c) => c.abort()), []);

  const run = () => {
    ctrls.current.forEach((c) => c.abort());
    ctrls.current = [0, 1, 2].map(() => new AbortController());
    setResults([0, 1, 2].map(() => ({ html: "", status: "running" })));
    [0, 1, 2].forEach((i) =>
      writeScreen({
        spec: specOf(project),
        system: project.system,
        screen,
        kit: project.kit,
        shell: project.shell && screenId !== project.shellSourceId ? project.shell : null,
        reference: styleReference(project, screenId),
        first: screenId === project.shellSourceId,
        instruction: instructionFor(range, aspects, i),
        quality,
        signal: ctrls.current[i].signal,
        onHtml: (h) => setResults((r) => r && r.map((x, j) => (j === i ? { ...x, html: h } : x))),
      })
        .then(({ html }) => setResults((r) => r && r.map((x, j) => (j === i ? { html, status: "done" } : x))))
        .catch((err) => {
          if (err.name !== "AbortError") {
            setResults((r) => r && r.map((x, j) => (j === i ? { ...x, status: "error", error: err.message } : x)));
          }
        }),
    );
  };

  const scale = Math.min(0.42, (window.innerHeight - 260) / viewport.h, (window.innerWidth - 160) / 4 / viewport.w);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex flex-col bg-paper/96 backdrop-blur" role="dialog" aria-label="Variations">
      <div className="flex items-center gap-3 border-b border-line px-5 py-3">
        <Shuffle size={16} />
        <div className="font-semibold">Variations of {screen?.name}</div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <Segmented
            id="var-range"
            value={range}
            onChange={setRange}
            options={[
              { value: "refine", label: "Refine" },
              { value: "explore", label: "Explore" },
              { value: "reimagine", label: "Reimagine" },
            ]}
          />
          <div className="flex gap-1">
            {ASPECTS.map(([k, label]) => (
              <button
                key={k}
                onClick={() => setAspects((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]))}
                aria-pressed={aspects.includes(k)}
                className={cx("rounded-full border px-3 py-1 text-xs font-medium", aspects.includes(k) ? "border-ink bg-ink text-white" : "border-line bg-white")}
              >
                {label}
              </button>
            ))}
          </div>
          <Button size="sm" icon={results ? RotateCcw : Shuffle} onClick={run}>
            {results ? "Generate again" : "Generate 3"}
          </Button>
          <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-sunken">
            <X size={17} />
          </button>
        </div>
      </div>
      <div className="flex flex-1 items-start justify-center gap-6 overflow-auto p-8">
        {[{ html: screen?.html, status: "current" }, ...(results || [])].map((r, i) => (
          <div key={i} className="flex flex-col items-center gap-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-mute">{i === 0 ? "Current" : `Option ${i}`}</div>
            <div className={cx("overflow-hidden rounded-[22px] bg-white shadow-[0_0_0_1px_rgba(20,20,26,.08),0_24px_60px_-24px_rgba(20,20,26,.35)]", i === 0 && "opacity-70")} style={{ width: viewport.w * scale, height: viewport.h * scale }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0" }}>
                {r.html || r.status === "running" ? (
                  <Frame id={"var-" + i} html={r.status === "running" ? "" : r.html} streaming={r.status === "running" ? r.html : null} system={project.system} kit={project.kit} width={viewport.w} height={viewport.h} />
                ) : (
                  <div className="skel" style={{ width: viewport.w, height: viewport.h }} />
                )}
              </div>
            </div>
            {i > 0 &&
              (r.status === "done" ? (
                <Button size="sm" icon={Check} onClick={() => onPick(r.html, `Variation (${range})`)}>
                  Use this one
                </Button>
              ) : r.status === "error" ? (
                <span className="max-w-[200px] text-center text-xs text-danger">{r.error}</span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-mute">
                  <LoaderCircle size={13} className="animate-spin" /> Designing…
                </span>
              ))}
          </div>
        ))}
        {!results && (
          <div className="max-w-xs self-center text-sm text-mute">
            <p className="font-semibold text-ink">Pick a creative range</p>
            <p className="mt-1">Refine polishes what's there. Explore tries new compositions. Reimagine starts again from the screen's job. Toggle what may change, then generate three options side by side.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function Compare({ project, screen, version, viewport, onRestore, onClose }) {
  const scale = Math.min(0.62, (window.innerHeight - 200) / viewport.h, (window.innerWidth - 200) / 2 / viewport.w);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex flex-col bg-paper/96 backdrop-blur" role="dialog" aria-label="Compare versions">
      <div className="flex items-center gap-3 border-b border-line px-5 py-3">
        <div className="font-semibold">{screen.name}: compare versions</div>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="secondary" icon={RotateCcw} onClick={() => onRestore(version)}>
            Restore “{version.label}”
          </Button>
          <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-sunken">
            <X size={17} />
          </button>
        </div>
      </div>
      <div className="flex flex-1 items-start justify-center gap-10 overflow-auto p-8">
        {[
          [version.html, version.label],
          [screen.html, `Current: ${screen.changeLabel || "first draft"}`],
        ].map(([html, label], i) => (
          <div key={i} className="flex flex-col items-center gap-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-mute">{label}</div>
            <div className="overflow-hidden rounded-[22px] bg-white shadow-[0_0_0_1px_rgba(20,20,26,.08),0_24px_60px_-24px_rgba(20,20,26,.35)]" style={{ width: viewport.w * scale, height: viewport.h * scale }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0" }}>
                <Frame id={"cmp-" + i} html={html} system={project.system} kit={project.kit} width={viewport.w} height={viewport.h} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
